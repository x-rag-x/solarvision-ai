import { describe, expect, it, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getSqliteDb } from "./sqlite";
import type { TrpcContext } from "./_core/context";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const e2eOperator: NonNullable<TrpcContext["user"]> = {
  id: 1,
  openId: "e2e-operator",
  name: "E2E Operator",
  email: "e2e-operator@solarvision.local",
  role: "user",
  loginMethod: "manus",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createMockContext(user: TrpcContext["user"] = e2eOperator): TrpcContext {
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

describe("End-to-End Workflow Verification", () => {
  const caller = appRouter.createCaller(createMockContext(e2eOperator));
  const realTestImagePath = resolve(process.cwd(), "data/dataset/images/test/img003707.jpg");
  const testInspectionIds: string[] = [];

  afterAll(() => {
    try {
      const db = getSqliteDb();
      for (const id of testInspectionIds) {
        db.prepare("DELETE FROM detections WHERE inspectionId = ?").run(id);
        db.prepare("DELETE FROM inspections WHERE inspectionId = ?").run(id);
      }
    } catch (e) {
      console.warn("Cleanup warning:", e);
    }
  });

  it(
    "executes full E2E pipeline: Image -> tRPC -> Python CLI (YOLO26n) -> SQLite -> History -> Detail -> Analytics",
    async () => {
      if (!existsSync(realTestImagePath)) {
        console.warn("Test image missing, skipping live inference check");
        return;
      }

      // 1. Read real image bytes and convert to base64
      const imageBuffer = await readFile(realTestImagePath);
      const base64Data = imageBuffer.toString("base64");

      // 2. Execute inspection through tRPC run mutation
      const runResult = await caller.inspection.run({
        filename: "img003707.jpg",
        mimeType: "image/jpeg",
        base64Data,
      });

      expect(runResult).toBeDefined();
      expect(runResult.inspectionId).toBeDefined();
      testInspectionIds.push(runResult.inspectionId);

      expect(runResult.sourceFilename).toBe("img003707.jpg");
      expect(runResult.modelName).toBe("YOLO26n");
      expect(runResult.processingTimeMs).toBeGreaterThan(0);
      expect(Array.isArray(runResult.detections)).toBe(true);
      expect(runResult.detections.length).toBeGreaterThanOrEqual(1);

      // Verify Model 1 detected defect label and bounds
      const primaryDetection = runResult.detections[0];
      expect(primaryDetection.defect_type).toBe("star_crack");
      expect(primaryDetection.confidence).toBeGreaterThanOrEqual(0.5);
      expect(primaryDetection.x1).toBeGreaterThanOrEqual(0);
      expect(primaryDetection.y1).toBeGreaterThanOrEqual(0);
      expect(primaryDetection.x2).toBeGreaterThan(primaryDetection.x1);
      expect(primaryDetection.y2).toBeGreaterThan(primaryDetection.y1);

      // Verify annotated image data URL returned
      expect(runResult.annotatedImageDataUrl).toBeDefined();
      expect(runResult.annotatedImageDataUrl?.startsWith("data:image/jpeg;base64,")).toBe(true);

      // 3. Verify record appears in History listing
      const history = await caller.inspection.history({ limit: 10 });
      expect(Array.isArray(history)).toBe(true);
      const foundInHistory = history.find(
        (item: any) => item.inspectionId === runResult.inspectionId
      );
      expect(foundInHistory).toBeDefined();
      expect(foundInHistory.sourceFilename).toBe("img003707.jpg");
      expect(foundInHistory.detectionsCount).toBe(runResult.detections.length);

      // 4. Verify record can be reopened via Detail query
      const detail = await caller.inspection.detail({
        inspectionId: runResult.inspectionId,
      });
      expect(detail).not.toBeNull();
      expect(detail?.inspection.inspectionId).toBe(runResult.inspectionId);
      expect(detail?.inspection.detectionsCount).toBe(runResult.detections.length);
      expect(detail?.detections).toHaveLength(runResult.detections.length);

      // Verify detection attributes agreement
      const detailDefect = detail?.detections[0];
      expect(detailDefect.defectType).toBe(primaryDetection.defect_type);
      expect(Number(detailDefect.confidence)).toBeCloseTo(primaryDetection.confidence, 2);

      // 5. Verify Dashboard stats reflect the stored inspection
      const stats = await caller.dashboard.stats();
      expect(stats.configured).toBe(true);
      expect(stats.inspections).toBeGreaterThanOrEqual(1);
      expect(stats.detections).toBeGreaterThanOrEqual(1);
      expect(stats.avgProcessingTimeMs).toBeGreaterThan(0);

      // 6. Verify Defect Analytics include the star_crack defect
      const analytics = await caller.analytics.defects();
      expect(analytics.configured).toBe(true);
      const starCrackEntry = analytics.byType.find(
        (item: any) => item.defectType === "star_crack"
      );
      expect(starCrackEntry).toBeDefined();
      expect(starCrackEntry.count).toBeGreaterThanOrEqual(1);
    },
    60_000 // 60s timeout for cold model load and inference
  );

  it("handles inference error gracefully and ensures errors are not presented as successful inspections", async () => {
    // Pass corrupted binary string masquerading as image
    const corruptBuffer = Buffer.from("NOT_AN_IMAGE_PAYLOAD_GARBAGE".repeat(10));
    const corruptBase64 = corruptBuffer.toString("base64");

    // Mutation must throw PRECONDITION_FAILED TRPCError
    await expect(
      caller.inspection.run({
        filename: "corrupt_error_test.jpg",
        mimeType: "image/jpeg",
        base64Data: corruptBase64,
      })
    ).rejects.toThrow();

    // Verify errors are never presented as successful inspections
    const history = await caller.inspection.history({ limit: 10 });
    const corruptHistoryItem = history.find(
      (item: any) => item.sourceFilename === "corrupt_error_test.jpg"
    );

    if (corruptHistoryItem) {
      testInspectionIds.push(corruptHistoryItem.inspectionId);
      // Status must strictly be "failed", never "completed"
      expect(corruptHistoryItem.status).toBe("failed");
      expect(corruptHistoryItem.detectionsCount).toBe(0);
    }
  });
});
