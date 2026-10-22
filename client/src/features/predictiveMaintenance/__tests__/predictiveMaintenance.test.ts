/**
 * SolarVision AI — Model 4: Predictive Maintenance Feature Test Suite
 * 
 * STRICT COMPLIANCE:
 * - Domain segregation between AI4I 2020 Benchmark and Solar Factory Equipment.
 * - Current-failure classification under operating condition, NOT Remaining Useful Life (RUL).
 * - Verified test split metrics from Agent 3's model4_predictive_maintenance.json.
 * - Real tRPC client integration with zero synthetic probability heuristics.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateDerivedPhysics,
  fetchBenchmarkMetadata,
  fetchMaintenanceHistory,
  fetchMaintenanceModelStatus,
  fetchSolarMaintenanceReadiness,
  getRuleBasedFailureModes,
  PredictiveMaintenanceApiError,
  runMaintenancePrediction,
  validateMaintenanceMeasurements,
} from "../api";
import {
  PRESET_MAINTENANCE_SAMPLES,
  SOLAR_EQUIPMENT_CATALOG,
  VERIFIED_BENCHMARK_METADATA,
} from "../benchmarkData";
import type { MaintenanceInputMeasurements } from "../types";

describe("Model 4: Benchmark Metadata & Provenance Verification", () => {
  it("verifies official AI4I 2020 dataset provenance and permanent DOI", () => {
    const meta = VERIFIED_BENCHMARK_METADATA;
    expect(meta.datasetName).toContain("AI4I 2020 Predictive Maintenance Dataset");
    expect(meta.datasetDoi).toBe("10.24432/C5HS5C");
    expect(meta.datasetLicense).toContain("CC BY 4.0");
    expect(meta.datasetAuthor).toContain("Matzka");
    expect(meta.modelVersion).toBe("4.0.0-benchmark");
  });

  it("verifies sample volume, imbalance ratio, and genuine evaluation metrics", () => {
    const meta = VERIFIED_BENCHMARK_METADATA;
    const m = meta.metrics;
    expect(m.totalRecords).toBe(10000);
    expect(m.healthyCount).toBe(9661);
    expect(m.failureCount).toBe(339);
    expect(m.healthyCount + m.failureCount).toBe(10000);

    // Verified metrics from Agent 3's model4_predictive_maintenance.json
    expect(m.accuracy).toBe(0.9667);
    expect(m.balancedAccuracy).toBe(0.7325);
    expect(m.rocAuc).toBe(0.9307);
    expect(m.prAuc).toBe(0.4796);
    expect(m.precision).toBe(0.5208);
    expect(m.recall).toBe(0.4808);
    expect(m.f1Score).toBe(0.5);
    expect(m.specificityNormal).toBe(0.9841);
    expect(m.thresholdUsed).toBe(0.1981);
    expect(m.testSamples).toBe(1502);

    // 2x2 Confusion matrix verification
    expect(m.truePositives).toBe(25);
    expect(m.falsePositives).toBe(23);
    expect(m.trueNegatives).toBe(1427);
    expect(m.falseNegatives).toBe(27);
    expect(m.truePositives + m.falsePositives + m.trueNegatives + m.falseNegatives).toBe(1502);

    // Calibration metrics
    expect(m.brierScore).toBe(0.0236);
    expect(m.ece).toBe(0.0113);
  });

  it("strictly confirms classification is operating condition failure, NOT Remaining Useful Life (RUL)", () => {
    const meta = VERIFIED_BENCHMARK_METADATA;
    const limitation = meta.limitations.find((l) =>
      l.toLowerCase().includes("remaining useful life")
    );
    expect(limitation).toBeDefined();
    expect(limitation).toContain("NOT a continuous Remaining Useful Life (RUL)");
  });

  it("verifies domain quarantine disclaimers strictly isolate benchmark from solar manufacturing", () => {
    const meta = VERIFIED_BENCHMARK_METADATA;
    const disclaimer = meta.limitations.find((l) =>
      l.includes("solar cell tabber/stringer")
    );
    expect(disclaimer).toBeDefined();
    expect(disclaimer).toContain("STRICTLY FORBIDDEN");
  });
});

describe("Model 4: Preset Samples & Source Attribution", () => {
  it("provides clearly labeled presets with authentic dataset references", () => {
    expect(PRESET_MAINTENANCE_SAMPLES.length).toBeGreaterThanOrEqual(4);

    const authentic = PRESET_MAINTENANCE_SAMPLES.filter(
      (p) => p.sourceCategory === "authentic_benchmark_record"
    );
    const synthetic = PRESET_MAINTENANCE_SAMPLES.filter(
      (p) =>
        p.sourceCategory === "synthetic_stress_scenario" ||
        (p.sourceCategory as string) === "custom_stress_scenario"
    );

    expect(authentic.length).toBeGreaterThanOrEqual(3);
    expect(synthetic.length).toBeGreaterThanOrEqual(1);

    // Check authentic preset references
    const osf = PRESET_MAINTENANCE_SAMPLES.find((p) => p.id === "preset-ai4i-udi161");
    expect(osf).toBeDefined();
    expect(osf?.sourceReference).toContain("AI4I 2020 Dataset");
    expect(osf?.sourceReference).toContain("UDI 161");
    expect(osf?.measurements.productType).toBe("L");
    expect(osf?.measurements.toolWearMin).toBe(216);

    const hdf = PRESET_MAINTENANCE_SAMPLES.find((p) => p.id === "preset-ai4i-udi3237");
    expect(hdf).toBeDefined();
    expect(hdf?.sourceReference).toContain("UDI 3237");
    expect(hdf?.measurements.productType).toBe("M");

    const nominal = PRESET_MAINTENANCE_SAMPLES.find((p) => p.id === "preset-ai4i-udi12");
    expect(nominal).toBeDefined();
    expect(nominal?.sourceReference).toContain("UDI 12");
  });
});

describe("Model 4: Input Validation & Physics Calculation", () => {
  const nominalInput: MaintenanceInputMeasurements = {
    productType: "L",
    airTemperatureK: 298.2,
    processTemperatureK: 308.7,
    rotationalSpeedRpm: 1408,
    torqueNm: 46.3,
    toolWearMin: 3,
  };

  it("validates compliant nominal input without throwing error", () => {
    expect(() => validateMaintenanceMeasurements(nominalInput)).not.toThrow();
  });

  it("strictly rejects invalid product variant", () => {
    const invalidVariant = { ...nominalInput, productType: "X" as any };
    expect(() => validateMaintenanceMeasurements(invalidVariant)).toThrow(
      PredictiveMaintenanceApiError
    );
    try {
      validateMaintenanceMeasurements(invalidVariant);
    } catch (err: any) {
      expect(err.code).toBe("INVALID_INPUT");
    }
  });

  it("strictly rejects air temperature outside [290 K, 320 K]", () => {
    const coldAir = { ...nominalInput, airTemperatureK: 250.0 };
    expect(() => validateMaintenanceMeasurements(coldAir)).toThrow(
      PredictiveMaintenanceApiError
    );

    const hotAir = { ...nominalInput, airTemperatureK: 350.0 };
    expect(() => validateMaintenanceMeasurements(hotAir)).toThrow(
      PredictiveMaintenanceApiError
    );
  });

  it("strictly rejects rotational speed outside [500 rpm, 3500 rpm]", () => {
    const slowSpindle = { ...nominalInput, rotationalSpeedRpm: 200 };
    expect(() => validateMaintenanceMeasurements(slowSpindle)).toThrow(
      PredictiveMaintenanceApiError
    );

    const overspeedSpindle = { ...nominalInput, rotationalSpeedRpm: 5000 };
    expect(() => validateMaintenanceMeasurements(overspeedSpindle)).toThrow(
      PredictiveMaintenanceApiError
    );
  });

  it("strictly rejects torque <= 0 or > 120 Nm", () => {
    const zeroTorque = { ...nominalInput, torqueNm: 0.0 };
    expect(() => validateMaintenanceMeasurements(zeroTorque)).toThrow(
      PredictiveMaintenanceApiError
    );

    const excessiveTorque = { ...nominalInput, torqueNm: 250.0 };
    expect(() => validateMaintenanceMeasurements(excessiveTorque)).toThrow(
      PredictiveMaintenanceApiError
    );
  });

  it("strictly rejects non-finite or NaN parameters", () => {
    const nanWear = { ...nominalInput, toolWearMin: NaN };
    expect(() => validateMaintenanceMeasurements(nanWear)).toThrow(
      PredictiveMaintenanceApiError
    );
  });

  it("correctly calculates derived physical parameters (Power, Delta T, Overstrain)", () => {
    const derived = calculateDerivedPhysics(nominalInput);
    // P = torque * (2 * pi * speed / 60)
    // 46.3 * (2 * pi * 1408 / 60) ~= 6826.7 W
    expect(derived.powerWatts).toBeCloseTo(6826.7, -1);
    expect(derived.isPowerAbnormal).toBe(false);

    // Delta T = 308.7 - 298.2 = 10.5 K >= 8.6 K
    expect(derived.deltaTemperatureK).toBeCloseTo(10.5, 1);
    expect(derived.isDeltaTAbnormal).toBe(false);

    // Overstrain = 46.3 * 3 = 138.9
    expect(derived.overstrainProductNmMin).toBeCloseTo(138.9, 1);
    expect(derived.isOverstrainAbnormal).toBe(false);
  });

  it("verifies rule-based failure mode indicators are tagged isRuleBased: true", () => {
    const derived = calculateDerivedPhysics(nominalInput);
    const modes = getRuleBasedFailureModes(derived);
    expect(modes).toHaveLength(5);
    for (const m of modes) {
      expect(m.isRuleBased).toBe(true);
      expect(m.engineeringFormula).toBeDefined();
    }
  });
});

describe("Model 4: Prediction Workflow & Authenticated Endpoint Integration", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("executes prediction via tRPC on Nominal Health preset", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("benchmarkPredict")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: {
              data: {
                status: "ready",
                healthState: "healthy",
                failureMode: "none",
                failureProbability: 0.0036,
                healthyProbability: 0.9964,
                recommendedAction: "NORMAL: Spindle within nominal envelope.",
                modelVersion: "4.0.0-benchmark",
                processingTimeMs: 2,
              },
            },
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    const sample = PRESET_MAINTENANCE_SAMPLES[0];
    const result = await runMaintenancePrediction(sample.measurements);

    expect(result.classification).toBe("NO_FAILURE");
    expect(result.failureProbability).toBeCloseTo(0.0036, 4);
    expect(result.healthyProbability).toBeCloseTo(0.9964, 4);
    expect(result.riskLevel).toBe("LOW");
    expect(result.remainingUsefulLifeHours).toBe("N/A");
    expect(result.rulExplanation).toContain("Operating Condition Classifier Only");
    expect(result.domain).toBe("ai4i_synthetic_benchmark");
    expect(result.modelVersion).toBe("4.0.0-benchmark");
  });

  it("executes prediction on Overstrain Failure (OSF) preset", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("benchmarkPredict")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: {
              data: {
                status: "ready",
                healthState: "failure",
                failureMode: "overstrain_failure",
                failureProbability: 0.9151,
                healthyProbability: 0.0849,
                recommendedAction: "CRITICAL: Tool wear limit exceeded. Replace cutting insert.",
                modelVersion: "4.0.0-benchmark",
                processingTimeMs: 1,
              },
            },
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    const sample = PRESET_MAINTENANCE_SAMPLES[1];
    const result = await runMaintenancePrediction(sample.measurements);

    expect(result.classification).toBe("FAILURE");
    expect(result.failureProbability).toBeGreaterThan(0.5);
    expect(result.activeFailureMode).toBe("OSF");
    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.remainingUsefulLifeHours).toBe("N/A");
  });

  it("executes prediction on Heat Dissipation Failure (HDF) preset", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("benchmarkPredict")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: {
              data: {
                status: "ready",
                healthState: "failure",
                failureMode: "heat_dissipation_failure",
                failureProbability: 0.272,
                healthyProbability: 0.728,
                recommendedAction: "CRITICAL: Sub-critical thermal dissipation.",
                modelVersion: "4.0.0-benchmark",
                processingTimeMs: 1,
              },
            },
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    const sample = PRESET_MAINTENANCE_SAMPLES[2];
    const result = await runMaintenancePrediction(sample.measurements);

    expect(result.classification).toBe("FAILURE");
    expect(result.failureProbability).toBe(0.272);
    expect(result.activeFailureMode).toBe("HDF");
  });

  it("gracefully catches 401 Unauthorized operator expiration", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      statusText: "Unauthorized",
    });

    try {
      await runMaintenancePrediction(PRESET_MAINTENANCE_SAMPLES[0].measurements);
      expect.unreachable("Should have thrown UNAUTHORIZED");
    } catch (err: any) {
      expect(err.code).toBe("UNAUTHORIZED");
      expect(err.message).toContain("authorization expired");
    }
  });

  it("truthfully reports MODEL_UNAVAILABLE without calculating fake synthetic probabilities when backend is offline", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Failed to connect to backend server: ECONNREFUSED"));

    try {
      await runMaintenancePrediction(PRESET_MAINTENANCE_SAMPLES[0].measurements);
      expect.unreachable("Should have thrown MODEL_UNAVAILABLE");
    } catch (err: any) {
      expect(err.code).toBe("MODEL_UNAVAILABLE");
      expect(err.message).toBe("Model Engine Unavailable — Real Inference Execution Required");
    }
  });
});

describe("Model 4: Assessment History Persistence & Retrieval", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("retrieves real persisted assessments from recent tRPC endpoint", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("predictiveMaintenance.recent")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: {
              data: {
                items: [
                  {
                    id: "rec-test-01",
                    machineId: "AI4I-BENCHMARK-MILL-01",
                    healthState: "failure",
                    failureMode: "overstrain_failure",
                    failureProbability: 0.9151,
                    healthyProbability: 0.0849,
                    sensorValues: {
                      product_type: "L",
                      air_temperature_k: 298.4,
                      process_temperature_k: 308.2,
                      rotational_speed_rpm: 1282,
                      torque_nm: 60.7,
                      tool_wear_min: 216,
                    },
                    createdAt: "2026-10-22T14:00:00.000Z",
                  },
                ],
                total: 1,
              },
            },
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    const history = await fetchMaintenanceHistory(10);
    expect(history).toHaveLength(1);
    expect(history[0].classification).toBe("FAILURE");
    expect(history[0].activeFailureMode).toBe("OSF");
    expect(history[0].inputMeasurements.productType).toBe("L");
    expect(history[0].inputMeasurements.toolWearMin).toBe(216);
    expect(history[0].remainingUsefulLifeHours).toBe("N/A");
  });

  it("returns honest empty list when no assessments exist in database", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("predictiveMaintenance.recent")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: {
              data: {
                items: [],
                total: 0,
              },
            },
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    const history = await fetchMaintenanceHistory(10);
    expect(history).toEqual([]);
  });
});

describe("Model 4: Solar Factory Equipment Readiness Gate", () => {
  it("keeps Solar Equipment Model 4 strictly marked NOT_TRAINED / DATASET_BLOCKED", async () => {
    const readiness = await fetchSolarMaintenanceReadiness();
    expect(readiness.status).toBe("DATASET_BLOCKED");
    expect(readiness.tableCounts.verifiedFailureEvents).toBe(0);
    expect(readiness.tableCounts.eligibleTrainingTrajectories).toBe(0);
    expect(readiness.blockingReasons.length).toBeGreaterThan(0);
    expect(readiness.prerequisites.length).toBeGreaterThan(0);
  });

  it("verifies solar equipment catalog covers 4 critical PV factory stations", () => {
    expect(SOLAR_EQUIPMENT_CATALOG).toHaveLength(4);
    const stationIds = SOLAR_EQUIPMENT_CATALOG.map((e) => e.id);
    expect(stationIds).toContain("EQ-STR-01");
    expect(stationIds).toContain("EQ-LAM-02");
    expect(stationIds).toContain("EQ-FUR-03");
    expect(stationIds).toContain("EQ-PRT-01");

    for (const machine of SOLAR_EQUIPMENT_CATALOG) {
      expect(machine.status).toBe("DATASET_BLOCKED");
      expect(machine.criticalSensorTypes.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("probes Model 4 deployment status truthfully", async () => {
    const status = await fetchMaintenanceModelStatus();
    expect(status.benchmarkReady).toBe(true);
    expect(status.solarReady).toBe(false);
    expect(status.modelVersion).toBe("4.0.0-benchmark");
  });
});
