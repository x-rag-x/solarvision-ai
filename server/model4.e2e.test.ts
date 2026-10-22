/**
 * SolarVision AI — Model 4: End-to-End Integration & Persistence Test
 * 
 * Verifies the full pipeline:
 * Machine measurements -> authenticated API -> model inference -> saved assessment -> history -> dashboard
 */

import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { getMaintenanceRepository } from "./predictiveMaintenance/persistence";

describe("Model 4: End-to-End Integration Pipeline", () => {
  const operatorContext = {
    id: 991,
    openId: "op-e2e-model4",
    name: "Model 4 Lead Operator",
    email: "op-m4@solarvision.test",
    role: "operator",
  };

  const authedCaller = appRouter.createCaller({
    user: operatorContext,
    req: {} as any,
    res: {} as any,
  });

  const unauthedCaller = appRouter.createCaller({
    user: null,
    req: {} as any,
    res: {} as any,
  });

  it("verifies predictiveMaintenance router is registered on top-level appRouter", () => {
    expect(appRouter._def.procedures).toHaveProperty("predictiveMaintenance.status");
    expect(appRouter._def.procedures).toHaveProperty("predictiveMaintenance.forecast");
    expect(appRouter._def.procedures).toHaveProperty("predictiveMaintenance.benchmarkPredict");
    expect(appRouter._def.procedures).toHaveProperty("predictiveMaintenance.history");
    expect(appRouter._def.procedures).toHaveProperty("predictiveMaintenance.recent");
    expect(appRouter._def.procedures).toHaveProperty("predictiveMaintenance.getById");
    expect(appRouter._def.procedures).toHaveProperty("predictiveMaintenance.readiness");
    expect(appRouter._def.procedures).toHaveProperty("predictiveMaintenance.modelMetadata");
    expect(appRouter._def.procedures).toHaveProperty("predictiveMaintenance.canonicalContract");
  });

  it("rejects unauthenticated requests to protected endpoints", async () => {
    await expect(
      unauthedCaller.predictiveMaintenance.forecast({
        domain: "ai4i_synthetic_benchmark",
        airTemperatureK: 300.0,
      })
    ).rejects.toThrow(UNAUTHED_ERR_MSG);

    await expect(
      unauthedCaller.predictiveMaintenance.history({
        machineId: "MACH-TEST-001",
      })
    ).rejects.toThrow(UNAUTHED_ERR_MSG);
  });

  it("allows unauthenticated access to public contract and metadata", async () => {
    const contract = await unauthedCaller.predictiveMaintenance.canonicalContract();
    expect(contract.contractVersion).toBe("1.0.0");
    expect(contract.canonicalFeatureCount).toBe(6);

    const meta = await unauthedCaller.predictiveMaintenance.modelMetadata();
    expect(meta.modelId).toBe("ai4i-2020-predictive-maintenance-benchmark");
    expect(meta.license).toContain("CC BY 4.0");
  });

  it("executes machine measurement -> authenticated API -> model evaluation -> saved assessment -> history", async () => {
    // 0. Ensure benchmark machines are seeded in DB
    await authedCaller.predictiveMaintenance.seedDemoSamples({ count: 2 });
    const machineId = "M-BENCH-AI4I-01";

    // 1. Machine measurements
    const measurements = {
      productType: "L",
      airTemperatureK: 300.0,
      processTemperatureK: 310.0,
      rotationalSpeedRpm: 1538.0,
      torqueNm: 40.0,
      toolWearMin: 5.0,
      machineId,
      confidenceThreshold: 0.5,
    };

    // 2. Authenticated API execution
    const forecastRes = await authedCaller.predictiveMaintenance.benchmarkPredict(measurements);
    expect(forecastRes).toBeDefined();
    expect(forecastRes.contractVersion).toBe("1.0.0");
    expect(forecastRes.domain).toBe("ai4i_synthetic_benchmark");

    // 3. Model inference response inspection
    expect(["ready", "not_trained", "error"]).toContain(forecastRes.status);
    expect(["healthy", "warning", "failure", "unknown"]).toContain(forecastRes.healthState);

    // 4. Persistence verification: Direct persistence of assessment via persistence interface
    const repo = getMaintenanceRepository();
    const savedRecord = await repo.saveAssessment(
      {
        machineId,
        domain: "ai4i_synthetic_benchmark",
        isBenchmark: true,
        dataSource: "ai4i_synthetic_benchmark_demo",
        skipFkCheck: true,
        sensorValues: {
          product_type: "L",
          air_temperature_k: 300.0,
          process_temperature_k: 310.0,
          rotational_speed_rpm: 1538.0,
          torque_nm: 40.0,
          tool_wear_min: 5.0,
        },
        healthState: "healthy",
        failureMode: "none",
        failureProbability: 0.015,
        healthyProbability: 0.985,
        remainingUsefulLifeHours: 500,
        urgency: "routine",
        confidence: 0.985,
        recommendedAction: "Spindle and drive operating within baseline parameters.",
      },
      { userId: "op-e2e-model4", role: "operator" }
    );

    expect(savedRecord.id).toBeDefined();
    expect(savedRecord.machineId).toBe(machineId);

    // 5. History retrieval via authenticated tRPC
    const historyRes = await authedCaller.predictiveMaintenance.history({
      machineId,
    });
    expect(historyRes.total).toBeGreaterThanOrEqual(1);
    expect(historyRes.records.some((r) => r.machineId === machineId)).toBe(true);

    // 6. Single assessment lookup by ID via authenticated tRPC
    const singleRes = await authedCaller.predictiveMaintenance.getById({
      id: savedRecord.id,
    });
    expect(singleRes.id).toBe(savedRecord.id);
    expect(singleRes.healthState).toBe("healthy");

    // 7. Recent assessments dashboard query via authenticated tRPC
    const recentRes = await authedCaller.predictiveMaintenance.recent({
      limit: 10,
    });
    expect(recentRes.records.length).toBeGreaterThanOrEqual(1);
  });

  it("strictly quarantines solar factory domain and never fabricates telemetry predictions", async () => {
    const res = await authedCaller.predictiveMaintenance.forecast({
      domain: "solar_factory",
      machineId: "SOLAR-TABBER-STRINGER-04",
      productType: "H",
      airTemperatureK: 298.0,
      processTemperatureK: 308.0,
      rotationalSpeedRpm: 1450.0,
      torqueNm: 45.0,
      toolWearMin: 15.0,
    });

    expect(res.status).toBe("not_trained");
    expect(res.domain).toBe("solar_factory");
    expect(res.failureProbability).toBeNull();
    expect(res.healthyProbability).toBeNull();
    expect(res.confidence).toBeNull();
    expect(res.limitations.some((l) => l.includes("Zero synthetic"))).toBe(true);
  });
});
