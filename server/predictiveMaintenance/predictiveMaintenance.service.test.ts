/**
 * SolarVision AI — Model 4: Predictive Maintenance
 * Integration and Unit Test Suite for server/predictiveMaintenance/
 */

import { describe, expect, it } from "vitest";
import {
  hasSufficientMaintenanceFeatures,
  validateMaintenanceFeatureBounds,
  toCanonicalMaintenanceVector,
  CANONICAL_FEATURE_SPECS,
  CANONICAL_MAINTENANCE_FEATURE_COUNT,
  CANONICAL_MAINTENANCE_FEATURE_NAMES,
  MODEL4_CONTRACT_VERSION,
} from "./featureContract";
import {
  forecastPredictiveMaintenance,
  predictBenchmarkMaintenance,
  getModel4Status,
  getBenchmarkMetadata,
  getModel4ReadinessSummary,
} from "./service";
import {
  predictiveMaintenanceRouter,
  predictiveMaintenanceInputSchema,
  benchmarkPredictInputSchema,
} from "./routerHandler";
import { UNAUTHED_ERR_MSG } from "@shared/const";

describe("Model 4: Feature Contract & Sufficiency Validation", () => {
  it("exports canonical 6-dimensional AI4I maintenance feature definitions", () => {
    expect(MODEL4_CONTRACT_VERSION).toBe("1.0.0");
    expect(CANONICAL_MAINTENANCE_FEATURE_COUNT).toBe(6);
    expect(CANONICAL_FEATURE_SPECS).toHaveLength(6);
    expect(CANONICAL_MAINTENANCE_FEATURE_NAMES).toEqual([
      "product_type",
      "air_temperature_k",
      "process_temperature_k",
      "rotational_speed_rpm",
      "torque_nm",
      "tool_wear_min",
    ]);
  });

  it("identifies when required physical continuous measurements are missing", () => {
    expect(hasSufficientMaintenanceFeatures({})).toBe(false);
    expect(
      hasSufficientMaintenanceFeatures({
        airTemperatureK: 300.0,
        processTemperatureK: 310.0,
      })
    ).toBe(false);
  });

  it("identifies when all 5 continuous measurements are present", () => {
    expect(
      hasSufficientMaintenanceFeatures({
        airTemperatureK: 300.0,
        processTemperatureK: 310.0,
        rotationalSpeedRpm: 1500.0,
        torqueNm: 40.0,
        toolWearMin: 20.0,
      })
    ).toBe(true);

    expect(
      hasSufficientMaintenanceFeatures({
        productType: "M",
        airTemperatureK: 300.0,
        processTemperatureK: 310.0,
        rotationalSpeedRpm: 1500.0,
        torqueNm: 40.0,
        toolWearMin: 20.0,
      })
    ).toBe(true);
  });

  it("validates direct 6-D vector input", () => {
    expect(
      hasSufficientMaintenanceFeatures({
        featureVector: [0.0, 300.0, 310.0, 1500.0, 40.0, 0.0],
      })
    ).toBe(true);

    expect(
      hasSufficientMaintenanceFeatures({
        featureVector: [1.0, 2.0],
      })
    ).toBe(false);
  });

  it("checks physical boundary limits on raw features", () => {
    const validFeatures = {
      air_temperature_k: 300.0,
      process_temperature_k: 310.0,
      rotational_speed_rpm: 1500.0,
      torque_nm: 40.0,
      tool_wear_min: 50.0,
    };
    const validRes = validateMaintenanceFeatureBounds(validFeatures);
    expect(validRes.valid).toBe(true);
    expect(validRes.violations).toHaveLength(0);

    const invalidFeatures = {
      air_temperature_k: 450.0, // Exceeds 305 K
      torque_nm: 120.0, // Exceeds 80 Nm
    };
    const invalidRes = validateMaintenanceFeatureBounds(invalidFeatures);
    expect(invalidRes.valid).toBe(false);
    expect(invalidRes.violations).toHaveLength(2);
  });

  it("converts input to canonical numeric vector", () => {
    const vec = toCanonicalMaintenanceVector({
      productType: "H",
      airTemperatureK: 298.5,
      processTemperatureK: 308.7,
      rotationalSpeedRpm: 1450.0,
      torqueNm: 45.0,
      toolWearMin: 120.0,
    });
    expect(vec).toEqual([2.0, 298.5, 308.7, 1450.0, 45.0, 120.0]);
  });
});

describe("Model 4: Domain Segregation & Zero-Fabrication Pledge", () => {
  it("strictly returns not_trained for solar_factory domain with null predictions", async () => {
    const res = await forecastPredictiveMaintenance({
      domain: "solar_factory",
      machineId: "SOLAR-DIFFUSION-FURNACE-01",
      productType: "M",
      airTemperatureK: 300.0,
      processTemperatureK: 310.0,
      rotationalSpeedRpm: 1500.0,
      torqueNm: 40.0,
      toolWearMin: 30.0,
    });

    expect(res.status).toBe("not_trained");
    expect(res.domain).toBe("solar_factory");
    expect(res.healthState).toBe("unknown");
    expect(res.failureMode).toBe("unknown");
    expect(res.failureProbability).toBeNull();
    expect(res.healthyProbability).toBeNull();
    expect(res.confidence).toBeNull();
    expect(res.recommendedAction).toContain("not yet trained");
    expect(res.limitations.some((l) => l.includes("Zero synthetic"))).toBe(true);
  });

  it("returns missing_features when telemetry is incomplete", async () => {
    const res = await forecastPredictiveMaintenance({
      domain: "ai4i_synthetic_benchmark",
      airTemperatureK: 300.0,
    });

    expect(res.status).toBe("missing_features");
    expect(res.healthState).toBe("unknown");
    expect(res.failureProbability).toBeNull();
    expect(res.recommendedAction).toContain("Insufficient telemetry");
  });
});

describe("Model 4: Zod Schemas Validation", () => {
  it("validates valid predictive maintenance payload", () => {
    const valid = {
      machineId: "MILL-001",
      domain: "ai4i_synthetic_benchmark",
      productType: "L",
      airTemperatureK: 298.1,
      processTemperatureK: 308.6,
      rotationalSpeedRpm: 1551.0,
      torqueNm: 42.8,
      toolWearMin: 0.0,
      confidenceThreshold: 0.5,
    };
    const parsed = predictiveMaintenanceInputSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("validates benchmark predict payload", () => {
    const valid = {
      productType: "M",
      airTemperatureK: 298.2,
      processTemperatureK: 308.7,
      rotationalSpeedRpm: 1400.0,
      torqueNm: 46.0,
      toolWearMin: 15.0,
    };
    const parsed = benchmarkPredictInputSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid confidence threshold", () => {
    const invalid = {
      productType: "L",
      airTemperatureK: 298.0,
      processTemperatureK: 308.0,
      rotationalSpeedRpm: 1500.0,
      torqueNm: 40.0,
      toolWearMin: 0.0,
      confidenceThreshold: 1.8,
    };
    const parsed = benchmarkPredictInputSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});

describe("Model 4: Authenticated tRPC Router & Endpoints", () => {
  const mockOperator = {
    id: 401,
    openId: "test-operator-pm",
    name: "Operator PM",
    email: "op-pm@example.com",
    role: "user",
  };

  const authedCaller = predictiveMaintenanceRouter.createCaller({
    user: mockOperator,
    req: {} as any,
    res: {} as any,
  });

  const unauthedCaller = predictiveMaintenanceRouter.createCaller({
    user: null,
    req: {} as any,
    res: {} as any,
  });

  it("enforces authentication on protected procedures", async () => {
    await expect(
      unauthedCaller.forecast({
        domain: "ai4i_synthetic_benchmark",
      })
    ).rejects.toThrow(UNAUTHED_ERR_MSG);

    await expect(
      unauthedCaller.benchmarkPredict({
        productType: "L",
        airTemperatureK: 298.0,
        processTemperatureK: 308.0,
        rotationalSpeedRpm: 1500.0,
        torqueNm: 40.0,
        toolWearMin: 0.0,
      })
    ).rejects.toThrow(UNAUTHED_ERR_MSG);

    await expect(unauthedCaller.readiness()).rejects.toThrow(UNAUTHED_ERR_MSG);
    await expect(
      unauthedCaller.history({ machineId: "AI4I-MILL-01" })
    ).rejects.toThrow(UNAUTHED_ERR_MSG);
    await expect(unauthedCaller.recent({})).rejects.toThrow(UNAUTHED_ERR_MSG);
    await expect(
      unauthedCaller.getById({ id: "non-existent-id" })
    ).rejects.toThrow(UNAUTHED_ERR_MSG);
  });

  it("permits unauthenticated access to public metadata and canonical contract", async () => {
    const contract = await unauthedCaller.canonicalContract();
    expect(contract.contractVersion).toBe("1.0.0");
    expect(contract.canonicalFeatureCount).toBe(6);
    expect(contract.features).toHaveLength(6);

    const meta = await unauthedCaller.modelMetadata();
    expect(meta.modelId).toBe("ai4i-2020-predictive-maintenance-benchmark");
    expect(meta.citation).toContain("Mathes, S. (2020)");
    expect(meta.license).toContain("CC BY 4.0");
    expect(meta.failureModes).toHaveLength(5);

    const status = await unauthedCaller.status();
    expect(status).toHaveProperty("domain");
    expect(status.expectedDim).toBe(6);
  });

  it("executes solar factory forecast with strict domain quarantine via authenticated tRPC", async () => {
    const res = await authedCaller.forecast({
      domain: "solar_factory",
      machineId: "SOLAR-STRINGER-01",
      productType: "L",
      airTemperatureK: 298.0,
      processTemperatureK: 308.0,
      rotationalSpeedRpm: 1500.0,
      torqueNm: 40.0,
      toolWearMin: 10.0,
    });

    expect(res.status).toBe("not_trained");
    expect(res.domain).toBe("solar_factory");
    expect(res.failureProbability).toBeNull();
  });

  it("queries operational readiness summary via authenticated tRPC", async () => {
    const readiness = await authedCaller.readiness();
    expect(readiness.service.contractVersion).toBe("1.0.0");
    expect(readiness.service.solarFactory.status).toBe("not_trained");
    expect(readiness.service.solarFactory.zeroFabricationPledge).toBe(true);
    expect(readiness.service.solarFactory.quarantined).toBe(true);
  });

  it("seeds and queries benchmark demo samples via authenticated tRPC", async () => {
    const seedRes = await authedCaller.seedDemoSamples({ count: 5 });
    expect(seedRes.inserted).toBeGreaterThanOrEqual(1);

    const recent = await authedCaller.recent({ limit: 10 });
    expect(recent.records.length).toBeGreaterThanOrEqual(1);
    expect(recent.records[0]).toHaveProperty("machineId");
    expect(recent.records[0]).toHaveProperty("healthState");
  });

  it("executes real inference through Node IPC for 3 genuine AI4I records matching Python engine", async () => {
    // Record 1 (AI4I Index 0 - Normal Healthy Operation)
    const rec1 = await authedCaller.benchmarkPredict({
      productType: "M",
      airTemperatureK: 298.1,
      processTemperatureK: 308.6,
      rotationalSpeedRpm: 1551.0,
      torqueNm: 42.8,
      toolWearMin: 0.0,
      machineId: "AI4I-RECORD-001",
    });

    expect(rec1.status).toBe("ready");
    expect(rec1.healthState).toBe("healthy");
    expect(rec1.failureMode).toBe("none");
    expect(rec1.failureProbability).toBeCloseTo(0.0018, 3);
    expect(rec1.healthyProbability).toBeCloseTo(0.9982, 3);
    expect(rec1.modeProbabilities).toEqual({});

    // Record 2 (AI4I Index 160 - Severe Tool Wear & High Torque Failure)
    const rec160 = await authedCaller.benchmarkPredict({
      productType: "L",
      airTemperatureK: 298.4,
      processTemperatureK: 308.2,
      rotationalSpeedRpm: 1282.0,
      torqueNm: 60.7,
      toolWearMin: 216.0,
      machineId: "AI4I-RECORD-160",
    });

    expect(rec160.status).toBe("ready");
    expect(rec160.healthState).toBe("failure");
    expect(rec160.failureMode).toBe("tool_wear_failure");
    expect(rec160.failureProbability).toBeCloseTo(0.9151, 3);
    expect(rec160.healthyProbability).toBeCloseTo(0.0849, 3);
    expect(rec160.modeProbabilities).toEqual({});
    expect(rec160.topRiskFactors.length).toBeGreaterThanOrEqual(2);
    expect(rec160.topRiskFactors.some((rf) => rf.factor_name === "tool_wear_min")).toBe(true);

    // Record 3 (AI4I Index 69 - Power Excursion Warning/Near-fail)
    const rec69 = await authedCaller.benchmarkPredict({
      productType: "L",
      airTemperatureK: 298.9,
      processTemperatureK: 309.0,
      rotationalSpeedRpm: 1410.0,
      torqueNm: 65.7,
      toolWearMin: 191.0,
      machineId: "AI4I-RECORD-069",
    });

    expect(rec69.status).toBe("ready");
    expect(rec69.healthState).toBe("warning");
    expect(rec69.failureMode).toBe("power_failure");
    expect(rec69.failureProbability).toBeCloseTo(0.1083, 3);
    expect(rec69.modeProbabilities).toEqual({});
    expect(rec69.topRiskFactors.length).toBeGreaterThanOrEqual(2);
  }, 25000);
});
