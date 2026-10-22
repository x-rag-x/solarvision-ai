/**
 * SolarVision AI — Model 3: Predictive Quality Monitoring
 * Integration and Unit Test Suite for server/predictiveQuality/
 */

import { describe, expect, it } from "vitest";
import {
  hasSufficientQualityFeatures,
  CANONICAL_SOLAR_FEATURES,
  CANONICAL_SOLAR_FEATURE_COUNT,
  MODEL3_CONTRACT_VERSION,
} from "./featureContract";
import {
  formatForecastForPersistence,
  persistQualityForecast,
  getQualityForecasts,
  getQualityForecastById,
  getQualityReadinessSummary,
} from "./dbContract";
import {
  forecastPredictiveQuality,
  getModel3Status,
} from "./service";
import { predictiveQualityInputSchema } from "./routerHandler";
import { appRouter } from "../routers";
import type { PredictiveQualityResponse } from "./types";

describe("Model 3: Predictive Quality Feature Contract", () => {
  it("correctly identifies when quality measurement features are missing", () => {
    expect(hasSufficientQualityFeatures({})).toBe(false);
    expect(hasSufficientQualityFeatures({ sensorMeasurements: [] })).toBe(false);
  });

  it("correctly identifies when manufacturing features are present", () => {
    expect(
      hasSufficientQualityFeatures({
        electricalParameters: { voc_v: 0.685, cellEfficiencyPct: 23.5 },
      })
    ).toBe(true);

    expect(
      hasSufficientQualityFeatures({
        sensorMeasurements: [{ sensorType: "firing_peak_temp_c", measurementValue: 860.0 }],
      })
    ).toBe(true);

    expect(
      hasSufficientQualityFeatures({
        defectSummary: { totalDefectCount: 3 },
      })
    ).toBe(true);

    expect(
      hasSufficientQualityFeatures({
        featureVector: [1.0, 2.0, 3.0],
      })
    ).toBe(true);

    expect(
      hasSufficientQualityFeatures({
        rawFeatures: { voc_v: 0.69 },
      })
    ).toBe(true);
  });

  it("exports canonical 32-dimensional solar quality feature definitions", () => {
    expect(MODEL3_CONTRACT_VERSION).toBe("1.0.0");
    expect(CANONICAL_SOLAR_FEATURE_COUNT).toBe(32);
    expect(CANONICAL_SOLAR_FEATURES).toHaveLength(32);
    expect(CANONICAL_SOLAR_FEATURES[0].name).toBe("voc_v");
    expect(CANONICAL_SOLAR_FEATURES[5].name).toBe("cell_efficiency_pct");
    expect(CANONICAL_SOLAR_FEATURES[14].name).toBe("firing_peak_temp_c");
    expect(CANONICAL_SOLAR_FEATURES[31].name).toBe("batch_progress_ratio");
  });
});

describe("Model 3: Database Persistence Formatter & Bridge", () => {
  it("formats ready forecast into database record", () => {
    const mockResponse: PredictiveQualityResponse = {
      contractVersion: "1.0.0",
      status: "ready",
      domain: "solar_cell_manufacturing",
      batchId: "BATCH-TEST-001",
      machineId: "MACH-STR-01",
      qualityOutcome: "pass",
      riskLevel: "low",
      probabilities: { pass: 0.9, warning: 0.08, fail: 0.02 },
      confidence: 0.9,
      isCalibrated: false,
      calibrationMethod: "none",
      predictedDefectRate: 0.02,
      predictedYield: 98.0,
      confidenceInterval: { low: 0.85, high: 0.95 },
      topRiskFactors: [{ factorName: "firing_peak_temp_c", impactScore: 0.12 }],
      recommendedAction: "Proceed to stringing",
      modelVersion: "3.0.0-test",
      modelMetadata: null,
      limitations: [],
      processingTimeMs: 15,
    };

    const rec = formatForecastForPersistence(mockResponse);
    expect(rec).not.toBeNull();
    expect(rec!.batchId).toBe("BATCH-TEST-001");
    expect(rec!.predictedDefectRate).toBe(0.02);
    expect(rec!.predictedYield).toBe(98.0);
    expect(rec!.riskLevel).toBe("low");
    expect(rec!.factors).toContain("firing_peak_temp_c");
    expect(rec!.forecastHorizonHours).toBe(24);
    expect(rec!.confidenceIntervalLow).toBe(0.85);
    expect(rec!.confidenceIntervalHigh).toBe(0.95);
  });

  it("returns null when status is not ready or batchId is missing", () => {
    const unreadyResponse: PredictiveQualityResponse = {
      contractVersion: "1.0.0",
      status: "not_trained",
      domain: "solar_cell_manufacturing",
      batchId: "B1",
      machineId: null,
      qualityOutcome: "unknown",
      riskLevel: "unknown",
      probabilities: {},
      confidence: null,
      isCalibrated: false,
      calibrationMethod: "none",
      predictedDefectRate: null,
      predictedYield: null,
      confidenceInterval: null,
      topRiskFactors: [],
      recommendedAction: null,
      modelVersion: "none",
      modelMetadata: null,
      limitations: [],
      processingTimeMs: 5,
    };

    expect(formatForecastForPersistence(unreadyResponse)).toBeNull();
  });

  it("persists and retrieves quality forecasts from database", async () => {
    const { getSqliteDb } = await import("../sqlite");
    const db = getSqliteDb();

    // Ensure a batch exists to satisfy foreign key constraint
    db.prepare(`
      INSERT OR IGNORE INTO manufacturing_batches (
        id, batchNumber, waferType, cellLine, targetQuantity, status, startTime, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "BATCH-PQ-FK-01", "LOT-PQ-01", "mono", "Line-1", 1000, "in_production",
      new Date().toISOString(), new Date().toISOString(), new Date().toISOString()
    );

    const mockResponse: PredictiveQualityResponse = {
      contractVersion: "1.0.0",
      status: "ready",
      domain: "solar_cell_manufacturing",
      batchId: "BATCH-PQ-FK-01",
      machineId: "MACH-01",
      qualityOutcome: "pass",
      riskLevel: "low",
      probabilities: { pass: 0.92, warning: 0.06, fail: 0.02 },
      confidence: 0.92,
      isCalibrated: false,
      calibrationMethod: "none",
      predictedDefectRate: 0.02,
      predictedYield: 98.0,
      confidenceInterval: { low: 0.88, high: 0.96 },
      topRiskFactors: [],
      recommendedAction: "Nominal process parameters",
      modelVersion: "3.0.0-test",
      modelMetadata: null,
      limitations: [],
      processingTimeMs: 12,
    };

    const persisted = await persistQualityForecast(mockResponse);
    expect(persisted).toBe(true);

    const list = await getQualityForecasts({ batchId: "BATCH-PQ-FK-01" });
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].batchId).toBe("BATCH-PQ-FK-01");
    expect(list[0].riskLevel).toBe("low");
  });

  it("returns dynamic Model 3 readiness summary", async () => {
    const summary = await getQualityReadinessSummary();
    expect(summary.schemaVersion).toBe("1.0.0");
    expect(summary.canonicalFeatureCount).toBe(32);
    expect(typeof summary.tableCounts.forecasts).toBe("number");
    expect(typeof summary.tableCounts.batches).toBe("number");
    expect(Array.isArray(summary.blockingReasons)).toBe(true);
  });
});

describe("Model 3: Orchestration Service & Zero-Fabrication Guarantees", () => {
  it("returns missing_features when input lacks manufacturing signals", async () => {
    const res = await forecastPredictiveQuality({
      batchId: "B-EMPTY",
    });

    expect(res.status).toBe("missing_features");
    expect(res.qualityOutcome).toBe("unknown");
    expect(res.riskLevel).toBe("unknown");
    expect(res.probabilities).toEqual({});
    expect(res.predictedYield).toBeNull();
    expect(res.limitations[0]).toContain("Missing manufacturing process telemetry");
  });

  it("returns not_trained truthfully when checkpoint does not exist", async () => {
    const res = await forecastPredictiveQuality({
      batchId: "B-SIGNAL-01",
      electricalParameters: { voc_v: 0.685, cellEfficiencyPct: 23.5 },
    });

    expect(res.status).toBe("not_trained");
    expect(res.qualityOutcome).toBe("unknown");
    expect(res.probabilities).toEqual({});
    expect(res.predictedYield).toBeNull();
    expect(res.limitations.some(lim => lim.toLowerCase().includes("not ready"))).toBe(true);
  });

  it("clearly distinguishes semiconductor benchmark domain and executes trained SECOM inference", async () => {
    // 1. Feature dimension mismatch rejection
    const resMismatch = await forecastPredictiveQuality({
      domain: "semiconductor_benchmark",
      featureVector: [0.5, 1.2, -0.3],
    });
    expect(resMismatch.domain).toBe("semiconductor_benchmark");
    expect(resMismatch.status).toBe("error");

    // 2. Full 590-feature benchmark inference execution
    const mock590Features = new Array(590).fill(0.0);
    const res = await forecastPredictiveQuality({
      domain: "semiconductor_benchmark",
      featureVector: mock590Features,
    });

    expect(res.domain).toBe("semiconductor_benchmark");
    expect(res.status).toBe("ready");
    expect(["pass", "fail"]).toContain(res.qualityOutcome);
    expect(res.probabilities.pass).toBeDefined();
    expect(res.probabilities.fail).toBeDefined();
    expect(Math.abs(res.probabilities.pass + res.probabilities.fail - 1.0)).toBeLessThan(1e-3);
    expect(res.isCalibrated).toBe(true);
    expect(res.limitations.some(lim => lim.toLowerCase().includes("benchmark"))).toBe(true);
    expect(res.limitations.some(lim => lim.toLowerCase().includes("not a solar-cell factory validation"))).toBe(true);
  }, 25000);

  it("executes benchmarkPredict procedure with strict 590 validation", async () => {
    const { predictBenchmarkQuality, getBenchmarkMetadata } = await import("./service");
    const mock590 = new Array(590).fill(0.1);
    const res = await predictBenchmarkQuality({ features: mock590, batchId: "WAFER-SECOM-01" });
    expect(res.status).toBe("ready");
    expect(res.domain).toBe("semiconductor_benchmark");

    await expect(predictBenchmarkQuality({ features: [1, 2, 3] })).rejects.toThrow("590 input features");

    const meta = getBenchmarkMetadata();
    expect(meta.benchmarkName).toContain("UCI SECOM");
    expect(meta.inputFeatureCount).toBe(590);
    expect(meta.transformedFeatureCount).toBe(744);
    expect(meta.optimalThreshold).toBe(0.07);
    expect(meta.disclaimer).toContain("NOT A SOLAR-CELL FACTORY VALIDATION");
  }, 25000);

  it("probes Model 3 status truthfully without fabrication for both domains", async () => {
    // Solar status
    const solarStatus = await getModel3Status("solar_cell_manufacturing");
    expect(solarStatus.modelName).toBe("SolarVision-PQ-Model3");
    expect(solarStatus.isReady).toBe(false);
    expect(solarStatus.domain).toBe("solar_cell_manufacturing");
    expect(solarStatus.expectedDim).toBe(32);
    expect(solarStatus.schemaVersion).toBe("1.0.0");
    expect(solarStatus.unavailabilityReason).toBeDefined();

    // Benchmark status
    const benchmarkStatus = await getModel3Status("semiconductor_benchmark");
    expect(benchmarkStatus.isReady).toBe(true);
    expect(benchmarkStatus.domain).toBe("semiconductor_benchmark");
    expect(benchmarkStatus.expectedDim).toBe(590);
    expect(benchmarkStatus.isCalibrated).toBe(true);
  });
});

describe("Model 3: Router Input Validation Schema", () => {
  it("validates valid solar quality input payload", () => {
    const payload = {
      batchId: "BATCH-VAL-01",
      domain: "solar_cell_manufacturing",
      electricalParameters: {
        voc_v: 0.685,
        isc_a: 10.85,
        cellEfficiencyPct: 23.4,
      },
      sensorMeasurements: [
        { sensorType: "firing_peak_temp_c", measurementValue: 865.0 },
      ],
      confidenceThreshold: 0.6,
    };

    const parsed = predictiveQualityInputSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("validates valid benchmark input payload", () => {
    const payload = {
      domain: "semiconductor_benchmark",
      featureVector: [1.2, 0.4, -0.9],
    };

    const parsed = predictiveQualityInputSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid confidence threshold", () => {
    const invalid = {
      confidenceThreshold: 1.5, // Exceeds 1.0
    };
    const parsed = predictiveQualityInputSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});

describe("Model 3: End-to-End tRPC Router Integration & Access Control", () => {
  const mockUser = {
    id: 101,
    openId: "test-operator-pq",
    name: "Operator PQ",
    email: "op-pq@example.com",
    role: "user",
  };

  const authedCaller = appRouter.createCaller({
    user: mockUser,
    req: {} as any,
    res: {} as any,
  });

  const unauthedCaller = appRouter.createCaller({
    user: null,
    req: {} as any,
    res: {} as any,
  });

  it("enforces authentication on protected procedures", async () => {
    const { UNAUTHED_ERR_MSG } = await import("@shared/const");
    await expect(unauthedCaller.predictiveQuality.status()).rejects.toThrow(UNAUTHED_ERR_MSG);
    await expect(unauthedCaller.predictiveQuality.readiness()).rejects.toThrow(UNAUTHED_ERR_MSG);
    await expect(unauthedCaller.predictiveQuality.benchmarkPredict({ features: [0] })).rejects.toThrow(UNAUTHED_ERR_MSG);
    await expect(unauthedCaller.predictiveQuality.history()).rejects.toThrow(UNAUTHED_ERR_MSG);
  });

  it("permits public access to benchmarkMetadata and canonicalContract", async () => {
    const contract = await unauthedCaller.predictiveQuality.canonicalContract();
    expect(contract.featureCount).toBe(32);

    const meta = await unauthedCaller.predictiveQuality.benchmarkMetadata();
    expect(meta.benchmarkName).toContain("UCI SECOM");
    expect(meta.inputFeatureCount).toBe(590);
    expect(meta.disclaimer).toContain("NOT A SOLAR-CELL FACTORY VALIDATION");
  });

  it("executes full E2E workflow: SECOM features -> tRPC benchmarkPredict -> Python -> inference response", async () => {
    const secomFeatures = new Array(590).fill(0.0);
    secomFeatures[275] = -0.2;
    secomFeatures[297] = -0.4;

    const res = await authedCaller.predictiveQuality.benchmarkPredict({
      features: secomFeatures,
      batchId: "E2E-SECOM-BATCH-01",
    });

    expect(res).toBeDefined();
    expect(res.status).toBe("ready");
    expect(res.domain).toBe("semiconductor_benchmark");
    expect(["pass", "fail"]).toContain(res.qualityOutcome);
    expect(res.probabilities.pass).toBeDefined();
    expect(res.probabilities.fail).toBeDefined();
    expect(res.isCalibrated).toBe(true);
    expect(res.limitations.some(l => l.includes("NOT A SOLAR-CELL FACTORY VALIDATION"))).toBe(true);
  }, 25000);

  it("rejects invalid feature counts on benchmarkPredict", async () => {
    await expect(
      authedCaller.predictiveQuality.benchmarkPredict({
        features: [1, 2, 3],
      })
    ).rejects.toThrow("SECOM semiconductor benchmark requires exactly 590 input features");
  });

  it("queries status and readiness through tRPC", async () => {
    const status = await authedCaller.predictiveQuality.status();
    expect(status).toHaveProperty("benchmarkReady", true);
    expect(status).toHaveProperty("solarReady", false);

    const readiness = await authedCaller.predictiveQuality.readiness();
    expect(readiness.canonicalFeatureCount).toBe(32);
    expect(readiness.tableCounts).toHaveProperty("forecasts");
  });
});

