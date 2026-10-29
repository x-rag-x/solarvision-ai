/**
 * SolarVision AI — Model 2: ELPV Cell Defectiveness Screening Integration Test Suite
 * Validates checkpoint inference, tRPC auth flow, input validation, benchmark metrics,
 * persistent history, and fail-closed security.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { appRouter } from "./routers";
import { getSqliteDb } from "./sqlite";

const SAMPLE_CELL_PATH = resolve(
  process.cwd(),
  "backend/models/model2_elpv_v1/model2_sample_elpv_cell.png"
);

describe("Model 2: ELPV Cell Screening Integration & Auth Suite", () => {
  const sampleCellBase64 = readFileSync(SAMPLE_CELL_PATH).toString("base64");

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

    // Must disclose operator review requirement & no automatic pass/reject
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

    await expect(
      anonymousCaller.model2Elpv.predict({
        filename: "cell.png",
        mimeType: "image/png",
        base64Data: sampleCellBase64,
      })
    ).rejects.toThrow(/UNAUTHORIZED|Please login|Authentication required/i);
  });

  it("rejects unsupported MIME types gracefully", async () => {
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

    await expect(
      authenticatedCaller.model2Elpv.predict({
        filename: "cell.txt",
        mimeType: "text/plain",
        base64Data: Buffer.from("not an image").toString("base64"),
      })
    ).rejects.toThrow(/Unsupported image format/i);
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

    // Verify summary text includes score and manual review required
    expect(result.summary).toContain("healthy");
    expect(result.summary).toContain("47.57%");
    expect(result.summary).toContain("manual review required");
  });

  it("persists predictions in persistent database history with data-provenance tag 'ELPV'", async () => {
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

    const history = await authenticatedCaller.model2Elpv.history({ limit: 10 });
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);

    const latest = history[0];
    expect(latest.dataProvenance).toBe("ELPV");
    expect(latest.decision).toBe("screening_only");
    expect(latest.requiresManualReview).toBe(true);
    expect(latest.modelVersionId).toBe("solarvision_m2_elpv_binary_v1");

    // Fetch individual record by ID
    const detail = await authenticatedCaller.model2Elpv.detail({
      screeningId: latest.id,
    });
    expect(detail.id).toBe(latest.id);
    expect(detail.dataProvenance).toBe("ELPV");
    expect(detail.predictedClass).toBe("healthy");
  });
});
