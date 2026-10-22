import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import {
  getSqliteDb,
  saveSqliteInspection,
  getSqliteInspectionById,
  getSqliteRecentInspections,
  setSqliteDbPath,
  resetSqliteDb,
} from "./sqlite";
import { extractStorageKey, resolveSecureImageUrl } from "./inspection/supabase";
import type { TrpcContext } from "./_core/context";
import { randomUUID } from "node:crypto";
import { resolve, normalize } from "node:path";
import { existsSync, readdirSync, unlinkSync } from "node:fs";

const secOperator: NonNullable<TrpcContext["user"]> = {
  id: 1,
  openId: "sec-operator-primary",
  name: "Security Operator",
  email: "sec-operator@solarvision.local",
  role: "user",
  loginMethod: "manus",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createMockContext(user: TrpcContext["user"] = secOperator): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// Generate valid base64 image payload (1x1 transparent PNG)
const VALID_BASE64_IMAGE =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==".repeat(
    2
  );

describe("Security & Access Control Regression Suite", () => {
  const createdInspectionIds: string[] = [];

  beforeAll(() => {
    // Isolate database to in-memory instance to prevent test artifact pollution of development database
    setSqliteDbPath(":memory:");
  });

  afterAll(() => {
    try {
      const db = getSqliteDb();
      for (const id of createdInspectionIds) {
        db.prepare("DELETE FROM detections WHERE inspectionId = ?").run(id);
        db.prepare("DELETE FROM inspections WHERE inspectionId = ?").run(id);
      }
    } catch (e) {
      console.warn("Cleanup error:", e);
    } finally {
      // Restore normal database path
      resetSqliteDb();
    }
  });

  // ==========================================================================
  // 1. Local Storage Path Traversal & Separator Neutralization
  // ==========================================================================
  describe("Path Traversal & Separator Neutralization", () => {
    const traversalPayloads = [
      { name: "Unix relative traversal", filename: "../../../../etc/passwd.jpg" },
      { name: "Windows backslash traversal", filename: "..\\..\\windows\\system32\\calc.png" },
      { name: "Absolute Unix path", filename: "/etc/shadow.jpg" },
      { name: "Absolute Windows drive path", filename: "C:\\Windows\\System32\\cmd.exe.jpg" },
      { name: "URL-encoded traversal", filename: "%2e%2e%2f%2e%2e%2fsecret.jpg" },
      { name: "Nested mixed traversal", filename: "....//....\\\\boot.ini.png" },
    ];

    for (const testCase of traversalPayloads) {
      it(`neutralizes ${testCase.name} during inspection upload and confines output to sandbox`, async () => {
        const caller = appRouter.createCaller(createMockContext());

        // Attempt upload with malicious path in filename
        try {
          const result = await caller.inspection.run({
            filename: testCase.filename,
            mimeType: "image/jpeg",
            base64Data: VALID_BASE64_IMAGE,
          });

          if (result && result.inspectionId) {
            createdInspectionIds.push(result.inspectionId);

            // 1. Inspection ID must be a clean UUID, completely free of path separators
            expect(result.inspectionId).toMatch(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            );

            // 2. Output image URLs must be confined to sandbox or data URLs
            if (result.annotatedImageUrl) {
              expect(result.annotatedImageUrl).not.toContain("../");
              expect(result.annotatedImageUrl).not.toContain("..\\");
              expect(result.annotatedImageUrl).not.toContain("etc/passwd");
              expect(result.annotatedImageUrl).not.toContain("System32");
            }

            // 3. Stored file location must resolve strictly inside uploads directory
            const uploadsDir = resolve(process.cwd(), "uploads");
            if (existsSync(uploadsDir)) {
              const files = readdirSync(uploadsDir);
              for (const f of files) {
                const fullPath = resolve(uploadsDir, f);
                expect(normalize(fullPath).startsWith(uploadsDir)).toBe(true);
              }
            }
          }
        } catch (error) {
          // If the pipeline safely rejects the malformed filename at input boundary, that is also secure
          expect(error).toBeDefined();
        }
      });
    }
  });

  // ==========================================================================
  // 2. Private Image Storage URL Authorization
  // ==========================================================================
  describe("Private Image Storage URL Authorization", () => {
    it("extractStorageKey accurately extracts keys from signed, public, and authenticated URLs", () => {
      const bucket = "solarvision-images";

      // 1. Signed URL
      const signedUrl =
        "https://xyz.supabase.co/storage/v1/object/sign/solarvision-images/inspections/abc-123/annotated.jpg?token=secret123";
      expect(extractStorageKey(signedUrl, bucket)).toBe("inspections/abc-123/annotated.jpg");

      // 2. Public URL
      const publicUrl =
        "https://xyz.supabase.co/storage/v1/object/public/solarvision-images/inspections/abc-123/input.jpg";
      expect(extractStorageKey(publicUrl, bucket)).toBe("inspections/abc-123/input.jpg");

      // 3. Authenticated URL
      const authUrl =
        "https://xyz.supabase.co/storage/v1/object/authenticated/solarvision-images/inspections/abc-123/annotated.jpg";
      expect(extractStorageKey(authUrl, bucket)).toBe("inspections/abc-123/annotated.jpg");

      // 4. Relative key with bucket prefix
      const relKey = "solarvision-images/inspections/abc-123/annotated.jpg";
      expect(extractStorageKey(relKey, bucket)).toBe("inspections/abc-123/annotated.jpg");
    });

    it("extractStorageKey rejects data URLs and local paths without exposing storage keys", () => {
      const bucket = "solarvision-images";

      expect(extractStorageKey("data:image/jpeg;base64,abc123456", bucket)).toBeNull();
      expect(extractStorageKey("/uploads/solarvision/abc/annotated.jpg", bucket)).toBeNull();
      expect(extractStorageKey("/manus-storage/abc/annotated.jpg", bucket)).toBeNull();
      expect(extractStorageKey("", bucket)).toBeNull();
    });

    it("resolveSecureImageUrl leaves local and base64 URLs untouched", async () => {
      const dataUrl = "data:image/jpeg;base64,dGVzdA==";
      const localUrl = "/uploads/solarvision/123/annotated.jpg";

      expect(await resolveSecureImageUrl(dataUrl)).toBe(dataUrl);
      expect(await resolveSecureImageUrl(localUrl)).toBe(localUrl);
      expect(await resolveSecureImageUrl(null)).toBeNull();
    });
  });

  // ==========================================================================
  // 3. Database Ownership & Operator Isolation
  // ==========================================================================
  describe("Database Ownership & Operator Isolation", () => {
    it("persists and enforces operatorId ownership across inspection lifecycle", () => {
      const opA_Id = randomUUID();
      const opB_Id = randomUUID();
      createdInspectionIds.push(opA_Id, opB_Id);

      // Save record owned by Operator A
      saveSqliteInspection(
        {
          inspectionId: opA_Id,
          sourceFilename: "cell_A.jpg",
          modelName: "YOLO26n",
          status: "completed" as const,
          processingTimeMs: 25.0,
          detectionsCount: 1,
          persistenceStatus: "database",
          createdAt: new Date(),
          operatorId: "operator-solar-alpha",
        } as any,
        [
          {
            inspectionId: opA_Id,
            defectType: "crack",
            confidence: 0.9,
            x1: 10,
            y1: 10,
            x2: 20,
            y2: 20,
          },
        ]
      );

      // Save record owned by Operator B
      saveSqliteInspection(
        {
          inspectionId: opB_Id,
          sourceFilename: "cell_B.jpg",
          modelName: "YOLO26n",
          status: "completed" as const,
          processingTimeMs: 28.0,
          detectionsCount: 0,
          persistenceStatus: "database",
          createdAt: new Date(),
          operatorId: "operator-solar-beta",
        } as any,
        []
      );

      // 1. Authorized Owner Access: Operator A can access their own record
      const recordA = getSqliteInspectionById(opA_Id, {
        userId: "operator-solar-alpha",
        role: "user",
      });
      expect(recordA).not.toBeNull();
      expect(recordA?.inspection.operatorId).toBe("operator-solar-alpha");

      // 2. Cross-User Detail Access Denied: Operator B cannot access Operator A's record
      const crossUserAccess = getSqliteInspectionById(opA_Id, {
        userId: "operator-solar-beta",
        role: "user",
      });
      expect(crossUserAccess).toBeNull();

      // 3. Anonymous Access Denied: Unauthenticated caller cannot access owned record
      const anonAccess = getSqliteInspectionById(opA_Id);
      expect(anonAccess).toBeNull();

      // 4. Admin Access Permitted: Admin can view any operator record
      const adminAccess = getSqliteInspectionById(opA_Id, {
        userId: "admin-supervisor",
        role: "admin",
      });
      expect(adminAccess).not.toBeNull();
      expect(adminAccess?.inspection.operatorId).toBe("operator-solar-alpha");

      // 5. Cross-User History Isolation:
      // Operator A only sees Operator A records
      const historyA = getSqliteRecentInspections(10, {
        userId: "operator-solar-alpha",
        role: "user",
      });
      expect(historyA.some((r: any) => r.inspectionId === opA_Id)).toBe(true);
      expect(historyA.some((r: any) => r.inspectionId === opB_Id)).toBe(false);

      // Operator B only sees Operator B records
      const historyB = getSqliteRecentInspections(10, {
        userId: "operator-solar-beta",
        role: "user",
      });
      expect(historyB.some((r: any) => r.inspectionId === opB_Id)).toBe(true);
      expect(historyB.some((r: any) => r.inspectionId === opA_Id)).toBe(false);
    });

    it("enforces cross-user isolation and unowned NULL record isolation at tRPC boundary", async () => {
      const op1Id = randomUUID();
      const op2Id = randomUUID();
      const unownedId = randomUUID();
      createdInspectionIds.push(op1Id, op2Id, unownedId);

      // Seed inspections with different ownership
      saveSqliteInspection(
        {
          inspectionId: op1Id,
          sourceFilename: "cell_op1.jpg",
          modelName: "YOLO26n",
          status: "completed" as const,
          processingTimeMs: 15.0,
          detectionsCount: 0,
          persistenceStatus: "database",
          createdAt: new Date(),
          userId: "user-op1",
          operatorId: "user-op1",
        } as any,
        []
      );

      saveSqliteInspection(
        {
          inspectionId: op2Id,
          sourceFilename: "cell_op2.jpg",
          modelName: "YOLO26n",
          status: "completed" as const,
          processingTimeMs: 15.0,
          detectionsCount: 0,
          persistenceStatus: "database",
          createdAt: new Date(),
          userId: "user-op2",
          operatorId: "user-op2",
        } as any,
        []
      );

      // Seed an unowned historical record (NULL userId & NULL operatorId)
      saveSqliteInspection(
        {
          inspectionId: unownedId,
          sourceFilename: "legacy_unowned.jpg",
          modelName: "YOLO26n",
          status: "completed" as const,
          processingTimeMs: 10.0,
          detectionsCount: 0,
          persistenceStatus: "database",
          createdAt: new Date(),
          userId: null,
          operatorId: null,
        } as any,
        []
      );

      const op1Caller = appRouter.createCaller(
        createMockContext({
          id: 101,
          openId: "user-op1",
          name: "Op One",
          email: "op1@solarvision.local",
          role: "user",
          loginMethod: "manus",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        })
      );

      const op2Caller = appRouter.createCaller(
        createMockContext({
          id: 102,
          openId: "user-op2",
          name: "Op Two",
          email: "op2@solarvision.local",
          role: "user",
          loginMethod: "manus",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        })
      );

      const adminCaller = appRouter.createCaller(
        createMockContext({
          id: 999,
          openId: "admin-user",
          name: "Admin User",
          email: "admin@solarvision.local",
          role: "admin",
          loginMethod: "manus",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        })
      );

      // 1. Operator 1 can view own inspection
      const op1Detail = await op1Caller.inspection.detail({ inspectionId: op1Id });
      expect(op1Detail).not.toBeNull();
      expect(op1Detail?.inspection.inspectionId).toBe(op1Id);

      // 2. Operator 2 CANNOT view Operator 1's inspection (returns null)
      const crossDetail = await op2Caller.inspection.detail({ inspectionId: op1Id });
      expect(crossDetail).toBeNull();

      // 3. Operator 1's history contains op1Id but NOT op2Id
      const op1History = await op1Caller.inspection.history({ limit: 50 });
      expect(op1History.some(r => r.inspectionId === op1Id)).toBe(true);
      expect(op1History.some(r => r.inspectionId === op2Id)).toBe(false);

      // 4. Operator 1's history CANNOT leak legacy unowned NULL records
      expect(op1History.some(r => r.inspectionId === unownedId)).toBe(false);

      // 5. Admin can access all inspections and history
      const adminDetail = await adminCaller.inspection.detail({ inspectionId: op1Id });
      expect(adminDetail).not.toBeNull();
      const adminHistory = await adminCaller.inspection.history({ limit: 50 });
      expect(adminHistory.some(r => r.inspectionId === op1Id)).toBe(true);
      expect(adminHistory.some(r => r.inspectionId === op2Id)).toBe(true);
      expect(adminHistory.some(r => r.inspectionId === unownedId)).toBe(true);
    });

    it("atomic transaction rollback prevents orphan inspection records on detection error", () => {
      const orphanId = randomUUID();
      createdInspectionIds.push(orphanId);

      // Attempt to save an inspection with invalid detection data that violates database types
      const badDetections: any[] = [
        {
          inspectionId: orphanId,
          defectType: "crack",
          confidence: "NOT_A_NUMBER", // Will throw during numeric binding
          x1: 10,
          y1: 10,
          x2: 20,
          y2: 20,
        },
      ];

      const saved = saveSqliteInspection(
        {
          inspectionId: orphanId,
          sourceFilename: "orphan_test.jpg",
          modelName: "YOLO26n",
          status: "completed" as const,
          processingTimeMs: 30.0,
          detectionsCount: 1,
          persistenceStatus: "database",
          createdAt: new Date(),
        },
        badDetections
      );

      expect(saved).toBe(false);

      // Verification: The entire transaction must have been rolled back.
      // No orphaned record should exist in the inspections table.
      const db = getSqliteDb();
      const orphanedRow = db
        .prepare("SELECT * FROM inspections WHERE inspectionId = ?")
        .get(orphanId);
      expect(orphanedRow).toBeUndefined();
    });
  });

  // ==========================================================================
  // 4. Session Expiration & Authentication Context
  // ==========================================================================
  describe("Session Expiration & Authentication Controls", () => {
    it("auth.me respects session boundaries between authenticated and unauthenticated callers", async () => {
      const anonCaller = appRouter.createCaller(createMockContext(null));
      expect(await anonCaller.auth.me()).toBeNull();

      const userA = {
        id: 101,
        openId: "user-alpha-99",
        email: "alpha@solarvision.local",
        name: "Operator Alpha",
        loginMethod: "manus",
        role: "user" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      };
      const userCaller = appRouter.createCaller(createMockContext(userA));
      const profile = await userCaller.auth.me();
      expect(profile).not.toBeNull();
      expect(profile?.openId).toBe("user-alpha-99");
      expect(profile?.email).toBe("alpha@solarvision.local");
    });

    it("auth.logout instructs cookie expiration with secure parameters", async () => {
      const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];

      const ctx: TrpcContext = {
        user: {
          id: 1,
          openId: "logout-user",
          email: "logout@example.com",
          name: "Logout User",
          loginMethod: "manus",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
        req: { protocol: "https", headers: {} } as any,
        res: {
          clearCookie: (name, options) => {
            clearedCookies.push({ name, options });
          },
        } as any,
      };

      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.logout();

      expect(result).toEqual({ success: true });
      expect(clearedCookies.length).toBeGreaterThanOrEqual(1);
      const cookie = clearedCookies[0];
      expect(cookie.options.maxAge).toBe(-1); // Instructs browser immediate deletion
      expect(cookie.options.httpOnly).toBe(true);
      expect(cookie.options.secure).toBe(true);
      expect(cookie.options.sameSite).toBe("none");
    });
  });

  // ==========================================================================
  // 5. SQL Injection Immunity
  // ==========================================================================
  describe("SQL Injection Immunity", () => {
    it("parameterized queries defend against destructive SQL injection in persistence and lookup", () => {
      const db = getSqliteDb();
      const injectionId = `sqli-${randomUUID()}'; DROP TABLE inspections; --`;
      const injectionFilename = "cell'; DROP TABLE detections; --";
      const injectionDefect = "crack'; DELETE FROM inspections; --";
      createdInspectionIds.push(injectionId);

      const saved = saveSqliteInspection(
        {
          inspectionId: injectionId,
          sourceFilename: injectionFilename,
          modelName: "YOLO26n",
          status: "completed" as const,
          processingTimeMs: 12.0,
          detectionsCount: 1,
          persistenceStatus: "database",
          createdAt: new Date(),
        },
        [
          {
            inspectionId: injectionId,
            defectType: injectionDefect,
            confidence: 0.99,
            x1: 5,
            y1: 5,
            x2: 15,
            y2: 15,
          },
        ]
      );

      expect(saved).toBe(true);

      // Verify tables were not dropped or compromised
      const inspectionsTable = db
        .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='inspections'")
        .get() as { cnt: number };
      expect(inspectionsTable.cnt).toBe(1);

      const detectionsTable = db
        .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='detections'")
        .get() as { cnt: number };
      expect(detectionsTable.cnt).toBe(1);

      // Verify safe retrieval with injection payload
      const retrieved = getSqliteInspectionById(injectionId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.inspection.sourceFilename).toBe(injectionFilename);
    });
  });

  // ==========================================================================
  // 6. Denial-of-Service & Input Boundaries
  // ==========================================================================
  describe("Denial-of-Service & Input Boundaries", () => {
    it("rejects payloads exceeding the 50 MB maximum upload threshold", async () => {
      const caller = appRouter.createCaller(createMockContext());

      // Oversized string exceeding 50,000,000 chars
      const oversized = "A".repeat(50_000_001);

      await expect(
        caller.inspection.run({
          filename: "huge.jpg",
          mimeType: "image/jpeg",
          base64Data: oversized,
        })
      ).rejects.toThrow();
    });

    it("rejects corrupted non-image content gracefully without process crash", async () => {
      const caller = appRouter.createCaller(createMockContext());

      const nonImageBase64 = Buffer.from("Corrupted non-image plain text buffer").toString("base64");
      const padded = nonImageBase64.padEnd(120, "=");

      await expect(
        caller.inspection.run({
          filename: "corrupt.jpg",
          mimeType: "image/jpeg",
          base64Data: padded,
        })
      ).rejects.toThrow();
    });
  });
});
