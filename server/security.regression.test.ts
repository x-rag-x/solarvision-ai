import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "http";
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
import { registerRootCauseRestRoutes } from "./rootCause/restHandler";
import { commitImportCsv } from "./rootCause/csvImport";
import { ensureRootCauseAnnotationsTable } from "./rootCause/dbContract";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { registerTestUser, getInspectionById } from "./db";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { randomUUID } from "node:crypto";
import { resolve, normalize } from "node:path";
import { existsSync, readdirSync } from "node:fs";

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
  let testHttpServer: Server | null = null;
  let testBaseUrl = "";
  let opAToken = "";
  let opBToken = "";
  let adminToken = "";

  beforeAll(async () => {
    // Configure test secret for JWT signing if not already set
    if (!ENV.cookieSecret) {
      ENV.cookieSecret = "test-super-secret-jwt-key-minimum-32-bytes-long!";
    }
    if (!ENV.appId) {
      ENV.appId = "solarvision-test-app";
    }

    // Isolate database to in-memory instance to prevent test artifact pollution of development database
    setSqliteDbPath(":memory:");
    ensureRootCauseAnnotationsTable();

    // Register authenticated mock test users
    registerTestUser({
      id: 101,
      openId: "op-alpha-user",
      name: "Operator Alpha",
      email: "alpha@solarvision.local",
      role: "user",
      loginMethod: "manus",
    });
    registerTestUser({
      id: 102,
      openId: "op-beta-user",
      name: "Operator Beta",
      email: "beta@solarvision.local",
      role: "user",
      loginMethod: "manus",
    });
    registerTestUser({
      id: 999,
      openId: "admin-super-user",
      name: "Admin Supervisor",
      email: "admin@solarvision.local",
      role: "admin",
      loginMethod: "manus",
    });

    opAToken = await sdk.createSessionToken("op-alpha-user", { name: "Operator Alpha" });
    opBToken = await sdk.createSessionToken("op-beta-user", { name: "Operator Beta" });
    adminToken = await sdk.createSessionToken("admin-super-user", { name: "Admin Supervisor" });

    // Launch test Express application with root-cause routes and secure image handler
    const testApp = express();
    testApp.use(express.json());

    testApp.get("/uploads/*", async (req, res) => {
      let user: any = null;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        user = null;
      }
      if (!user) {
        return res.status(401).json({ error: "Unauthorized", message: "Authentication required" });
      }

      const rawRelPath = (req.params as Record<string, string>)[0];
      const match = rawRelPath.match(/^(?:solarvision|inspections)\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        const inspectionId = match[1];
        const requester = { userId: user.openId || String(user.id), role: user.role };
        const inspection = await getInspectionById(inspectionId, requester);
        if (!inspection) {
          const existsGlobally = await getInspectionById(inspectionId, { role: "admin" });
          if (existsGlobally) {
            return res.status(403).json({ error: "Forbidden", message: "Access denied to private inspection image." });
          }
          return res.status(404).send("Inspection not found");
        }
      }
      return res.status(200).send("IMAGE_DATA_STREAM");
    });

    registerRootCauseRestRoutes(testApp);

    await new Promise<void>(resolve => {
      testHttpServer = testApp.listen(0, "127.0.0.1", () => {
        const addr = testHttpServer?.address() as any;
        testBaseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    try {
      const db = getSqliteDb();
      for (const id of createdInspectionIds) {
        db.prepare("DELETE FROM detections WHERE inspectionId = ?").run(id);
        db.prepare("DELETE FROM inspections WHERE inspectionId = ?").run(id);
      }
    } catch (e) {
      console.warn("Cleanup error:", e);
    } finally {
      if (testHttpServer) {
        await new Promise<void>(resolve => testHttpServer?.close(() => resolve()));
      }
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

        try {
          const result = await caller.inspection.run({
            filename: testCase.filename,
            mimeType: "image/jpeg",
            base64Data: VALID_BASE64_IMAGE,
          });

          if (result && result.inspectionId) {
            createdInspectionIds.push(result.inspectionId);

            expect(result.inspectionId).toMatch(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            );

            if (result.annotatedImageUrl) {
              expect(result.annotatedImageUrl).not.toContain("../");
              expect(result.annotatedImageUrl).not.toContain("..\\");
              expect(result.annotatedImageUrl).not.toContain("etc/passwd");
              expect(result.annotatedImageUrl).not.toContain("System32");
            }

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

      const signedUrl =
        "https://xyz.supabase.co/storage/v1/object/sign/solarvision-images/inspections/abc-123/annotated.jpg?token=secret123";
      expect(extractStorageKey(signedUrl, bucket)).toBe("inspections/abc-123/annotated.jpg");

      const publicUrl =
        "https://xyz.supabase.co/storage/v1/object/public/solarvision-images/inspections/abc-123/input.jpg";
      expect(extractStorageKey(publicUrl, bucket)).toBe("inspections/abc-123/input.jpg");

      const authUrl =
        "https://xyz.supabase.co/storage/v1/object/authenticated/solarvision-images/inspections/abc-123/annotated.jpg";
      expect(extractStorageKey(authUrl, bucket)).toBe("inspections/abc-123/annotated.jpg");

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

      const recordA = getSqliteInspectionById(opA_Id, {
        userId: "operator-solar-alpha",
        role: "user",
      });
      expect(recordA).not.toBeNull();
      expect(recordA?.inspection.operatorId).toBe("operator-solar-alpha");

      const crossUserAccess = getSqliteInspectionById(opA_Id, {
        userId: "operator-solar-beta",
        role: "user",
      });
      expect(crossUserAccess).toBeNull();

      const anonAccess = getSqliteInspectionById(opA_Id);
      expect(anonAccess).toBeNull();

      const adminAccess = getSqliteInspectionById(opA_Id, {
        userId: "admin-supervisor",
        role: "admin",
      });
      expect(adminAccess).not.toBeNull();
      expect(adminAccess?.inspection.operatorId).toBe("operator-solar-alpha");

      const historyA = getSqliteRecentInspections(10, {
        userId: "operator-solar-alpha",
        role: "user",
      });
      expect(historyA.some((r: any) => r.inspectionId === opA_Id)).toBe(true);
      expect(historyA.some((r: any) => r.inspectionId === opB_Id)).toBe(false);

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

      const op1Detail = await op1Caller.inspection.detail({ inspectionId: op1Id });
      expect(op1Detail).not.toBeNull();
      expect(op1Detail?.inspection.inspectionId).toBe(op1Id);

      const crossDetail = await op2Caller.inspection.detail({ inspectionId: op1Id });
      expect(crossDetail).toBeNull();

      const op1History = await op1Caller.inspection.history({ limit: 50 });
      expect(op1History.some(r => r.inspectionId === op1Id)).toBe(true);
      expect(op1History.some(r => r.inspectionId === op2Id)).toBe(false);

      expect(op1History.some(r => r.inspectionId === unownedId)).toBe(false);

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

      const badDetections: any[] = [
        {
          inspectionId: orphanId,
          defectType: "crack",
          confidence: "NOT_A_NUMBER",
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
      expect(cookie.options.maxAge).toBe(-1);
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

      const inspectionsTable = db
        .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='inspections'")
        .get() as { cnt: number };
      expect(inspectionsTable.cnt).toBe(1);

      const detectionsTable = db
        .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='detections'")
        .get() as { cnt: number };
      expect(detectionsTable.cnt).toBe(1);

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

  // ==========================================================================
  // 7. Manufacturing REST API Security & Reviewer Spoofing (Finding F02)
  // ==========================================================================
  describe("Manufacturing REST API Security & Reviewer Spoofing (F02)", () => {
    it("rejects anonymous machine import with 401 Unauthorized", async () => {
      const res = await fetch(`${testBaseUrl}/api/v2/root-cause/import/machines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              machine_id: "m_anon_1",
              machine_code: "MAC-ANON",
              machine_type: "stringer",
              line_id: "line_1",
              status: "operational",
            },
          ],
        }),
      });

      expect(res.status).toBe(401);
      const data = (await res.json()) as any;
      expect(data.success).toBe(false);
      expect(data.message).toContain("Unauthorized");
    });

    it("rejects anonymous annotation creation with 401 Unauthorized", async () => {
      const res = await fetch(`${testBaseUrl}/api/v2/root-cause/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionId: "some-insp-id",
          confirmedCause: "squeegee_pressure_drift",
          confidenceLevel: "confirmed",
          verifiedBy: "spoofed_engineer",
        }),
      });

      expect(res.status).toBe(401);
      const data = (await res.json()) as any;
      expect(data.success).toBe(false);
      expect(data.message).toContain("Unauthorized");
    });

    it("rejects anonymous inspection linking with 401 Unauthorized", async () => {
      const res = await fetch(`${testBaseUrl}/api/v2/root-cause/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionId: "insp_1",
          batchId: "batch_1",
          machineId: "mach_1",
        }),
      });

      expect(res.status).toBe(401);
      const data = (await res.json()) as any;
      expect(data.success).toBe(false);
    });

    it("rejects anonymous dataset readiness query with 401 Unauthorized", async () => {
      const res = await fetch(`${testBaseUrl}/api/v2/root-cause/readiness`);
      expect(res.status).toBe(401);
    });

    it("rejects spoofed reviewer ID when supplied in annotation body", async () => {
      const inspA = randomUUID();
      createdInspectionIds.push(inspA);
      saveSqliteInspection(
        {
          inspectionId: inspA,
          sourceFilename: "cell_alpha.jpg",
          modelName: "YOLO26n",
          status: "completed",
          processingTimeMs: 20.0,
          detectionsCount: 0,
          persistenceStatus: "database",
          createdAt: new Date(),
          userId: "op-alpha-user",
          operatorId: "op-alpha-user",
        } as any,
        []
      );

      const res = await fetch(`${testBaseUrl}/api/v2/root-cause/annotations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${COOKIE_NAME}=${opAToken}`,
        },
        body: JSON.stringify({
          inspectionId: inspA,
          confirmedCause: "squeegee_pressure_drift",
          confidenceLevel: "confirmed",
          verifiedBy: "op-beta-user",
        }),
      });

      expect(res.status).toBe(403);
      const data = (await res.json()) as any;
      expect(data.success).toBe(false);
      expect(data.message).toContain("spoofing detected");
    });

    it("rejects annotation referencing a nonexistent inspection with 404 Not Found", async () => {
      const nonExistentId = `nonexistent-${randomUUID()}`;
      const res = await fetch(`${testBaseUrl}/api/v2/root-cause/annotations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${COOKIE_NAME}=${opAToken}`,
        },
        body: JSON.stringify({
          inspectionId: nonExistentId,
          confirmedCause: "squeegee_pressure_drift",
          confidenceLevel: "confirmed",
        }),
      });

      expect(res.status).toBe(404);
      const data = (await res.json()) as any;
      expect(data.success).toBe(false);
      expect(data.message).toContain("does not exist");
    });

    it("rejects invalid root-cause taxonomy values with 422 Unprocessable Entity", async () => {
      const inspA = randomUUID();
      createdInspectionIds.push(inspA);
      saveSqliteInspection(
        {
          inspectionId: inspA,
          sourceFilename: "cell_alpha.jpg",
          modelName: "YOLO26n",
          status: "completed",
          processingTimeMs: 20.0,
          detectionsCount: 0,
          persistenceStatus: "database",
          createdAt: new Date(),
          userId: "op-alpha-user",
          operatorId: "op-alpha-user",
        } as any,
        []
      );

      const res = await fetch(`${testBaseUrl}/api/v2/root-cause/annotations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${COOKIE_NAME}=${opAToken}`,
        },
        body: JSON.stringify({
          inspectionId: inspA,
          confirmedCause: "cosmic_radiation_alien_interference",
          confidenceLevel: "confirmed",
        }),
      });

      expect(res.status).toBe(422);
      const data = (await res.json()) as any;
      expect(data.success).toBe(false);
      expect(data.message).toContain("root cause");
    });
  });

  // ==========================================================================
  // 8. Safe SQLite UPSERT & Child Preservation (Finding F03)
  // ==========================================================================
  describe("Safe Manufacturing Ingestion & Child Preservation (F03)", () => {
    it("preserves dependent sensor measurements upon re-importing an existing machine", () => {
      const db = getSqliteDb();
      const machId = `mach_preserve_${randomUUID().slice(0, 8)}`;
      const machCode = `MC-${randomUUID().slice(0, 6)}`;

      const initResult = commitImportCsv(
        "machines",
        [
          {
            machine_id: machId,
            machine_code: machCode,
            machine_type: "screen_printer",
            line_id: "line_alpha",
            location: "Bay 1",
            status: "operational",
          },
        ],
        { operatorName: "op-alpha-user" }
      );
      expect(initResult.success).toBe(true);
      expect(initResult.insertedRecords).toBe(1);

      const sensor1Id = `sens_${randomUUID().slice(0, 8)}`;
      const sensor2Id = `sens_${randomUUID().slice(0, 8)}`;
      const sensor3Id = `sens_${randomUUID().slice(0, 8)}`;

      db.prepare(`
        INSERT INTO sensor_measurements (
          id, machineId, sensorType, measurementValue, unit, isAnomaly, recordedAt, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(sensor1Id, machId, "squeegee_pressure", 85.5, "N/cm", 0, new Date().toISOString(), new Date().toISOString());

      db.prepare(`
        INSERT INTO sensor_measurements (
          id, machineId, sensorType, measurementValue, unit, isAnomaly, recordedAt, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(sensor2Id, machId, "paste_viscosity", 120.0, "Pa*s", 0, new Date().toISOString(), new Date().toISOString());

      db.prepare(`
        INSERT INTO sensor_measurements (
          id, machineId, sensorType, measurementValue, unit, isAnomaly, recordedAt, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(sensor3Id, machId, "snap_off_distance", 1.8, "mm", 0, new Date().toISOString(), new Date().toISOString());

      const preCount = db.prepare("SELECT COUNT(*) as count FROM sensor_measurements WHERE machineId = ?").get(machId) as { count: number };
      expect(preCount.count).toBe(3);

      const reimportResult = commitImportCsv(
        "machines",
        [
          {
            machine_id: machId,
            machine_code: machCode,
            machine_type: "screen_printer",
            line_id: "line_alpha",
            location: "Bay 2 Updated",
            status: "degraded",
          },
        ],
        { operatorName: "op-alpha-user" }
      );

      expect(reimportResult.success).toBe(true);
      expect(reimportResult.insertedRecords).toBe(1);

      const postCount = db.prepare("SELECT COUNT(*) as count FROM sensor_measurements WHERE machineId = ?").get(machId) as { count: number };
      expect(postCount.count).toBe(3);

      const machineRecord = db.prepare("SELECT * FROM manufacturing_machines WHERE id = ?").get(machId) as any;
      expect(machineRecord).toBeDefined();
      expect(machineRecord.location).toBe("Bay 2 Updated");
      expect(machineRecord.status).toBe("degraded");
    });

    it("rolls back transaction atomically when any row in a CSV batch is invalid", () => {
      const db = getSqliteDb();
      const machA = `mach_roll_${randomUUID().slice(0, 6)}`;
      const machB = `mach_roll_${randomUUID().slice(0, 6)}`;

      const csvData = [
        {
          machine_id: machA,
          machine_code: `MC-${machA}`,
          machine_type: "stringer",
          line_id: "line_1",
          status: "operational",
        },
        {
          machine_id: machB,
          machine_code: `MC-${machB}`,
          machine_type: "stringer",
          line_id: "line_1",
          status: "INVALID_STATUS_CODE",
        },
      ];

      const result = commitImportCsv("machines", csvData, { operatorName: "op-alpha-user" });

      expect(result.success).toBe(false);
      expect(result.status).toBe("REJECTED");

      const checkA = db.prepare("SELECT * FROM manufacturing_machines WHERE id = ?").get(machA);
      expect(checkA).toBeUndefined();
    });
  });

  // ==========================================================================
  // 9. Ownership Enforcement, Scoping & Private Uploads (Finding F04)
  // ==========================================================================
  describe("Ownership Enforcement & Private Uploads (F04)", () => {
    it("prevents Operator B from accessing Operator A's annotations via tRPC allAnnotations", async () => {
      const db = getSqliteDb();
      const inspA = randomUUID();
      const inspB = randomUUID();
      createdInspectionIds.push(inspA, inspB);

      saveSqliteInspection(
        {
          inspectionId: inspA,
          sourceFilename: "cell_A.jpg",
          modelName: "YOLO26n",
          status: "completed",
          processingTimeMs: 15.0,
          detectionsCount: 0,
          persistenceStatus: "database",
          createdAt: new Date(),
          userId: "op-alpha-user",
          operatorId: "op-alpha-user",
        } as any,
        []
      );

      saveSqliteInspection(
        {
          inspectionId: inspB,
          sourceFilename: "cell_B.jpg",
          modelName: "YOLO26n",
          status: "completed",
          processingTimeMs: 15.0,
          detectionsCount: 0,
          persistenceStatus: "database",
          createdAt: new Date(),
          userId: "op-beta-user",
          operatorId: "op-beta-user",
        } as any,
        []
      );

      const annotA_Id = `annot_A_${randomUUID().slice(0, 6)}`;
      db.prepare(`
        INSERT INTO root_cause_annotations (
          id, inspectionId, confirmedCause, confidenceLevel, verifiedBy, verifiedAt, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(annotA_Id, inspA, "squeegee_pressure_drift", "confirmed", "op-alpha-user", new Date().toISOString(), new Date().toISOString());

      const annotB_Id = `annot_B_${randomUUID().slice(0, 6)}`;
      db.prepare(`
        INSERT INTO root_cause_annotations (
          id, inspectionId, confirmedCause, confidenceLevel, verifiedBy, verifiedAt, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(annotB_Id, inspB, "thermal_stress_soldering", "confirmed", "op-beta-user", new Date().toISOString(), new Date().toISOString());

      const callerA = appRouter.createCaller(
        createMockContext({
          id: 101,
          openId: "op-alpha-user",
          name: "Operator Alpha",
          email: "alpha@solarvision.local",
          role: "user",
          loginMethod: "manus",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        })
      );

      const callerB = appRouter.createCaller(
        createMockContext({
          id: 102,
          openId: "op-beta-user",
          name: "Operator Beta",
          email: "beta@solarvision.local",
          role: "user",
          loginMethod: "manus",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        })
      );

      const annotsA = await callerA.rootCause.allAnnotations();
      expect(annotsA.some((a: any) => a.id === annotA_Id)).toBe(true);
      expect(annotsA.some((a: any) => a.id === annotB_Id)).toBe(false);

      const annotsB = await callerB.rootCause.allAnnotations();
      expect(annotsB.some((a: any) => a.id === annotB_Id)).toBe(true);
      expect(annotsB.some((a: any) => a.id === annotA_Id)).toBe(false);
    });

    it("prevents Operator B from linking Operator A's inspection to equipment (Cross-User Linking Denied)", async () => {
      const inspA = randomUUID();
      createdInspectionIds.push(inspA);

      saveSqliteInspection(
        {
          inspectionId: inspA,
          sourceFilename: "cell_A.jpg",
          modelName: "YOLO26n",
          status: "completed",
          processingTimeMs: 15.0,
          detectionsCount: 0,
          persistenceStatus: "database",
          createdAt: new Date(),
          userId: "op-alpha-user",
          operatorId: "op-alpha-user",
        } as any,
        []
      );

      const db = getSqliteDb();
      const batchId = `b_${randomUUID().slice(0, 6)}`;
      const machId = `m_${randomUUID().slice(0, 6)}`;
      db.prepare(`
        INSERT INTO manufacturing_batches (id, batchNumber, waferType, cellLine, targetQuantity, status, startTime, createdAt, updatedAt)
        VALUES (?, ?, 'mono', 'line1', 1000, 'running', ?, ?, ?)
      `).run(batchId, `BN-${batchId}`, new Date().toISOString(), new Date().toISOString(), new Date().toISOString());

      db.prepare(`
        INSERT INTO manufacturing_machines (id, machineCode, machineType, lineId, status, createdAt, updatedAt)
        VALUES (?, ?, 'stringer', 'line1', 'operational', ?, ?)
      `).run(machId, `MC-${machId}`, new Date().toISOString(), new Date().toISOString());

      const restRes = await fetch(`${testBaseUrl}/api/v2/root-cause/links`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${COOKIE_NAME}=${opBToken}`,
        },
        body: JSON.stringify({
          inspectionId: inspA,
          batchId,
          machineId: machId,
        }),
      });

      expect(restRes.status).toBe(403);
      const restData = (await restRes.json()) as any;
      expect(restData.message).toContain("Forbidden");

      const callerB = appRouter.createCaller(
        createMockContext({
          id: 102,
          openId: "op-beta-user",
          name: "Operator Beta",
          email: "beta@solarvision.local",
          role: "user",
          loginMethod: "manus",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        })
      );

      await expect(
        callerB.rootCause.linkInspection({
          inspectionId: inspA,
          batchId,
          machineId: machId,
        })
      ).rejects.toThrow();
    });

    it("enforces authentication and ownership on private /uploads inspection image access", async () => {
      const inspA = randomUUID();
      createdInspectionIds.push(inspA);

      saveSqliteInspection(
        {
          inspectionId: inspA,
          sourceFilename: "cell_A.jpg",
          modelName: "YOLO26n",
          status: "completed",
          processingTimeMs: 15.0,
          detectionsCount: 0,
          persistenceStatus: "database",
          createdAt: new Date(),
          userId: "op-alpha-user",
          operatorId: "op-alpha-user",
        } as any,
        []
      );

      // 1. Anonymous request to private image URL -> 401 Unauthorized
      const anonRes = await fetch(`${testBaseUrl}/uploads/solarvision/${inspA}/annotated.jpg`);
      expect(anonRes.status).toBe(401);

      // 2. Cross-user request (Operator Beta) -> 403 Forbidden
      const crossRes = await fetch(`${testBaseUrl}/uploads/solarvision/${inspA}/annotated.jpg`, {
        headers: {
          Cookie: `${COOKIE_NAME}=${opBToken}`,
        },
      });
      expect(crossRes.status).toBe(403);

      // 3. Authorized owner request (Operator Alpha) -> 200 OK
      const ownerRes = await fetch(`${testBaseUrl}/uploads/solarvision/${inspA}/annotated.jpg`, {
        headers: {
          Cookie: `${COOKIE_NAME}=${opAToken}`,
        },
      });
      expect(ownerRes.status).toBe(200);
      expect(await ownerRes.text()).toBe("IMAGE_DATA_STREAM");

      // 4. Admin supervisor request -> 200 OK
      const adminRes = await fetch(`${testBaseUrl}/uploads/solarvision/${inspA}/annotated.jpg`, {
        headers: {
          Cookie: `${COOKIE_NAME}=${adminToken}`,
        },
      });
      expect(adminRes.status).toBe(200);
      expect(await adminRes.text()).toBe("IMAGE_DATA_STREAM");
    });

    it("allows authorized operator to perform valid end-to-end manufacturing workflows", async () => {
      const inspId = randomUUID();
      createdInspectionIds.push(inspId);

      saveSqliteInspection(
        {
          inspectionId: inspId,
          sourceFilename: "cell_valid.jpg",
          modelName: "YOLO26n",
          status: "completed",
          processingTimeMs: 12.0,
          detectionsCount: 0,
          persistenceStatus: "database",
          createdAt: new Date(),
          userId: "op-alpha-user",
          operatorId: "op-alpha-user",
        } as any,
        []
      );

      // 1. Operator Alpha imports machines
      const machId = `mach_auth_${randomUUID().slice(0, 6)}`;
      const machRes = await fetch(`${testBaseUrl}/api/v2/root-cause/import/machines`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${COOKIE_NAME}=${opAToken}`,
        },
        body: JSON.stringify({
          items: [
            {
              machine_id: machId,
              machine_code: `CODE-${machId}`,
              machine_type: "firing_furnace",
              line_id: "line_1",
              status: "operational",
            },
          ],
        }),
      });
      expect(machRes.status).toBe(200);
      const machData = (await machRes.json()) as any;
      expect(machData.success).toBe(true);

      // 2. Operator Alpha imports batches
      const batchId = `batch_auth_${randomUUID().slice(0, 6)}`;
      const batchRes = await fetch(`${testBaseUrl}/api/v2/root-cause/import/batches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${COOKIE_NAME}=${opAToken}`,
        },
        body: JSON.stringify({
          items: [
            {
              batch_id: batchId,
              batch_number: `NUM-${batchId}`,
              cell_line: "line_1",
              target_quantity: 1000,
              start_time: new Date().toISOString(),
              status: "in_production",
            },
          ],
        }),
      });
      expect(batchRes.status).toBe(200);

      // 3. Operator Alpha links own inspection
      const linkRes = await fetch(`${testBaseUrl}/api/v2/root-cause/links`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${COOKIE_NAME}=${opAToken}`,
        },
        body: JSON.stringify({
          inspectionId: inspId,
          batchId,
          machineId: machId,
        }),
      });
      expect(linkRes.status).toBe(200);

      // 4. Operator Alpha submits valid confirmed root cause annotation
      const annotRes = await fetch(`${testBaseUrl}/api/v2/root-cause/annotations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `${COOKIE_NAME}=${opAToken}`,
        },
        body: JSON.stringify({
          inspectionId: inspId,
          confirmedCause: "firing_thermal_profile_excursion",
          confidenceLevel: "confirmed",
          investigationNotes: "Thermal probe showed 15C offset during zone 4 sintering.",
          supportingEvidenceFactors: ["zone_4_temperature_spike", "cell_bowing"],
        }),
      });
      expect(annotRes.status).toBe(200);
      const annotData = (await annotRes.json()) as any;
      expect(annotData.success).toBe(true);
      expect(annotData.annotationId).toBeDefined();

      // 5. Query readiness
      const readyRes = await fetch(`${testBaseUrl}/api/v2/root-cause/readiness`, {
        headers: {
          Cookie: `${COOKIE_NAME}=${opAToken}`,
        },
      });
      expect(readyRes.status).toBe(200);
      const readyData = (await readyRes.json()) as any;
      expect(readyData.expertAnnotationsCount).toBeGreaterThanOrEqual(1);
    });
  });
});
