/**
 * SolarVision AI — Model 2: ELPV Cell Defectiveness Screening Integration Test Suite
 * Validates checkpoint inference, tRPC auth flow, input validation, benchmark metrics,
 * persistent history, zero automatic pass/reject, and private tenant isolation.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { appRouter } from "./routers";

const SAMPLE_CELL_PATH = resolve(
  process.cwd(),
  "backend/models/model2_elpv_v1/model2_sample_elpv_cell.png"
);
const HEALTHY_CELL_PATH = resolve(
  process.cwd(),
  "backend/models/model2_elpv_v1/model2_sample_healthy_cell.png"
);
const DEFECTIVE_CELL_PATH = resolve(
  process.cwd(),
  "backend/models/model2_elpv_v1/model2_sample_defective_cell.png"
);

describe("Model 2: ELPV Cell Screening Integration & Auth Suite", () => {
  const sampleCellBase64 = readFileSync(SAMPLE_CELL_PATH).toString("base64");
  const healthyCellBase64 = readFileSync(HEALTHY_CELL_PATH).toString("base64");
  const defectiveCellBase64 = readFileSync(DEFECTIVE_CELL_PATH).toString("base64");

  it("exposes model status and truthful research benchmark caveats", async () => {
    const caller = appRouter.createCaller({
      req: {} as any,
      res: { cookie: () => {}, clearCookie: () => {} } as any,
      user: null,
    });

    const status = await caller.model2Elpv.status();
    expect(status.modelId).toBe("solarvision_m2_elpv_binary_v1");
    expect(status.artifactsPresent).toBe(true);
    expect(status.threshold).toBe(0.55);
    expect(status.inputScope).toBe("complete_single_cell_EL_image");

    // Benchmark caveats checks (69.81% accuracy, 68.67% recall, 45.97% precision, test set 308)
    expect(status.benchmark.accuracy).toBeCloseTo(0.6981, 3);
    expect(status.benchmark.defectiveRecall).toBeCloseTo(0.6867, 3);
    expect(status.benchmark.defectivePrecision).toBeCloseTo(0.4597, 3);
    expect(status.benchmark.testSetSize).toBe(308);
    expect(status.benchmark.trueModuleIdsPresent).toBe(false);
    expect(status.benchmark.license).toBe("CC BY-NC-SA 4.0");

    // Must disclose operator review requirement & zero automatic pass/reject
    const hasOperatorLimitation = status.benchmark.limitations.some(l =>
      l.toLowerCase().includes("operator review") || l.toLowerCase().includes("manual review")
    );
    expect(hasOperatorLimitation).toBe(true);
  });

  it("enforces authentication: blocks anonymous unauthenticated screening requests", async () => {
    const anonymousCaller = appRouter.createCaller({
      req: {} as any,
      res: { cookie: () => {}, clearCookie: () => {} } as any,
      user: null,
    });

    // 1. predict endpoint requires auth
    await expect(
      anonymousCaller.model2Elpv.predict({
        filename: "cell.png",
        mimeType: "image/png",
        base64Data: sampleCellBase64,
      })
    ).rejects.toThrow(/UNAUTHORIZED|Please login|Authentication required/i);

    // 2. history endpoint requires auth
    await expect(
      anonymousCaller.model2Elpv.history({ limit: 10 })
    ).rejects.toThrow(/UNAUTHORIZED|Please login|Authentication required/i);

    // 3. detail endpoint requires auth
    await expect(
      anonymousCaller.model2Elpv.detail({ screeningId: "test-id" })
    ).rejects.toThrow(/UNAUTHORIZED|Please login|Authentication required/i);
  });

  it("rejects invalid image uploads gracefully", async () => {
    const authenticatedCaller = appRouter.createCaller({
      req: {} as any,
      res: { cookie: () => {}, clearCookie: () => {} } as any,
      user: {
        id: 99,
        openId: "test_operator_01",
        name: "Test Operator",
        role: "user",
      } as any,
    });

    // 1. Unsupported MIME
    await expect(
      authenticatedCaller.model2Elpv.predict({
        filename: "cell.txt",
        mimeType: "text/plain",
        base64Data: Buffer.from("not an image").toString("base64"),
      })
    ).rejects.toThrow(/Unsupported image format/i);

    // 2. Empty payload (0 bytes) rejected by Zod validation
    await expect(
      authenticatedCaller.model2Elpv.predict({
        filename: "empty.png",
        mimeType: "image/png",
        base64Data: "",
      })
    ).rejects.toThrow(/Too small|missing or empty|empty/i);

    // 3. Corrupt non-image binary
    await expect(
      authenticatedCaller.model2Elpv.predict({
        filename: "corrupt.png",
        mimeType: "image/png",
        base64Data: Buffer.from("GARBAGE_PAYLOAD_NOT_PNG").toString("base64"),
      })
    ).rejects.toThrow();
  });

  it("executes real inference for representative ELPV sample and returns mandatory review flag", async () => {
    const authenticatedCaller = appRouter.createCaller({
      req: {} as any,
      res: { cookie: () => {}, clearCookie: () => {} } as any,
      user: {
        id: 101,
        openId: "test_operator_elpv",
        name: "Lead Quality Tech",
        role: "user",
      } as any,
    });

    const result = await authenticatedCaller.model2Elpv.predict({
      filename: "model2_sample_elpv_cell.png",
      mimeType: "image/png",
      base64Data: sampleCellBase64,
    });

    expect(result.screeningId).toBeDefined();
    expect(result.modelId).toBe("solarvision_m2_elpv_binary_v1");
    expect(result.predictedClass).toBe("healthy");
    expect(result.rawDefectiveScore).toBeCloseTo(0.4757, 3);
    expect(result.rawThreshold).toBe(0.55);
    expect(result.defectiveScorePct).toBe(47.57);
    expect(result.thresholdPct).toBe(55);

    // ZERO AUTOMATIC PASS/REJECT: Requires manual review on EVERY output
    expect(result.requiresManualReview).toBe(true);
    expect(result.decision).toBe("screening_only");
    expect(result.reviewStatus).toBe("pending");
    expect(result.dataProvenance).toBe("ELPV");
    expect(result.imageUrl).toMatch(/^\/uploads\/cell-screenings\//);

    // Verify summary text uses Predicted Healthy and requires manual review
    expect(result.summary).toContain("Predicted Healthy");
    expect(result.summary.toLowerCase()).toContain("healthy");
    expect(result.summary).toContain("47.57%");
    expect(result.summary).toContain("manual review required");
  });

  it("tests multiple real ELPV cells: verifies confident healthy (<0.55) and confident defective (>=0.55) examples", async () => {
    const caller = appRouter.createCaller({
      req: {} as any,
      res: { cookie: () => {}, clearCookie: () => {} } as any,
      user: {
        id: 101,
        openId: "test_operator_elpv",
        name: "Lead Quality Tech",
        role: "user",
      } as any,
    });

    // 1. Confidently Healthy Cell (cell0079: score ~0.1489 < 0.55)
    const healthyResult = await caller.model2Elpv.predict({
      filename: "model2_sample_healthy_cell.png",
      mimeType: "image/png",
      base64Data: healthyCellBase64,
    });
    expect(healthyResult.predictedClass).toBe("healthy");
    expect(healthyResult.rawDefectiveScore).toBeLessThan(0.55);
    expect(healthyResult.rawDefectiveScore).toBeCloseTo(0.1489, 2);
    expect(healthyResult.summary).toContain("Predicted Healthy");
    expect(healthyResult.requiresManualReview).toBe(true);

    // 2. Confidently Defective Cell (cell0003: score ~0.9634 >= 0.55)
    const defectiveResult = await caller.model2Elpv.predict({
      filename: "model2_sample_defective_cell.png",
      mimeType: "image/png",
      base64Data: defectiveCellBase64,
    });
    expect(defectiveResult.predictedClass).toBe("defective");
    expect(defectiveResult.rawDefectiveScore).toBeGreaterThanOrEqual(0.55);
    expect(defectiveResult.rawDefectiveScore).toBeCloseTo(0.9634, 2);
    expect(defectiveResult.summary).toContain("Predicted Defective");
    expect(defectiveResult.requiresManualReview).toBe(true);
  });

  it("persists predictions across dashboard reloads and enforces private tenant history access", async () => {
    const userA = appRouter.createCaller({
      req: {} as any,
      res: { cookie: () => {}, clearCookie: () => {} } as any,
      user: {
        id: "operator_tenant_alpha",
        openId: "operator_tenant_alpha",
        name: "Operator Alpha",
        role: "user",
      } as any,
    });

    const userB = appRouter.createCaller({
      req: {} as any,
      res: { cookie: () => {}, clearCookie: () => {} } as any,
      user: {
        id: "operator_tenant_beta",
        openId: "operator_tenant_beta",
        name: "Operator Beta",
        role: "user",
      } as any,
    });

    // User A submits a screening
    const predA = await userA.model2Elpv.predict({
      filename: "alpha_cell.png",
      mimeType: "image/png",
      base64Data: sampleCellBase64,
    });

    // User B submits a screening
    const predB = await userB.model2Elpv.predict({
      filename: "beta_cell.png",
      mimeType: "image/png",
      base64Data: defectiveCellBase64,
    });

    // Refresh simulation: User A queries history and only sees User A's record
    const historyA = await userA.model2Elpv.history({ limit: 10 });
    expect(historyA.some(r => r.id === predA.screeningId)).toBe(true);
    expect(historyA.some(r => r.id === predB.screeningId)).toBe(false);

    // Refresh simulation: User B queries history and only sees User B's record
    const historyB = await userB.model2Elpv.history({ limit: 10 });
    expect(historyB.some(r => r.id === predB.screeningId)).toBe(true);
    expect(historyB.some(r => r.id === predA.screeningId)).toBe(false);

    // Private detail access: User A cannot access User B's record (returns 404 NOT_FOUND)
    await expect(
      userA.model2Elpv.detail({
        screeningId: predB.screeningId,
      })
    ).rejects.toThrow(/not found/i);

    // User A can access own record
    const ownDetail = await userA.model2Elpv.detail({
      screeningId: predA.screeningId,
    });
    expect(ownDetail).not.toBeNull();
    expect(ownDetail?.id).toBe(predA.screeningId);
    expect(ownDetail?.dataProvenance).toBe("ELPV");
  });
});
