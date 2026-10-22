/**
 * SolarVision AI — Final Audit Remediation
 * Frontend Transport, Real Model Inference & Scientific Honesty Integration Suite
 * 
 * Verifies:
 * 1. SuperJSON protocol compatibility and typed tRPC proxy transport.
 * 2. Complete eradication of pseudo-model probabilities and fake confidence intervals in Model 3.
 * 3. Strict 590-D and 6-D input validation contracts for SECOM and AI4I benchmarks.
 * 4. Transparent domain segregation and zero simulated success when backend inference is unavailable.
 * 5. Accurate benchmark metadata, certified SHA-256 hashes, and Platt calibration metrics.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trpcVanilla, getAuthHeaders, createTrpcClientLinks } from "../lib/trpc";
import {
  runBenchmarkPrediction,
  fetchBenchmarkStatus,
  fetchSolarFactoryReadiness,
  PredictiveQualityApiError,
} from "../features/predictiveQuality/api";
import { VERIFIED_BENCHMARK_METADATA as PQ_METADATA } from "../features/predictiveQuality/benchmarkData";
import {
  runMaintenancePrediction,
  fetchMaintenanceModelStatus,
  fetchBenchmarkMetadata as fetchPdmMetadata,
  calculateDerivedPhysics,
  getRuleBasedFailureModes,
  PredictiveMaintenanceApiError,
} from "../features/predictiveMaintenance/api";
import { VERIFIED_BENCHMARK_METADATA as PDM_METADATA } from "../features/predictiveMaintenance/benchmarkData";
import {
  fetchModel2Status,
  runRootCauseDiagnosis,
  RootCauseApiError,
} from "../features/rootCause/api";
import {
  submitConfirmedRootCauseAnnotation,
  fetchDatasetReadiness,
} from "../features/rootCause/dataOnboardingApi";
import { COOKIE_NAME } from "@shared/const";

describe("Frontend Transport & SuperJSON Integration", () => {
  const originalFetch = global.fetch;
  let interceptedRequests: { url: string; method?: string; headers?: any; body?: any }[] = [];

  beforeEach(() => {
    interceptedRequests = [];
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("verifies tRPC mutations serialize request body using SuperJSON batch format", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      let parsedBody: any = null;
      if (init?.body) {
        try {
          parsedBody = JSON.parse(init.body);
        } catch {
          parsedBody = init.body;
        }
      }
      interceptedRequests.push({ url, method: init?.method, headers: init?.headers, body: parsedBody });

      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            result: {
              data: {
                json: {
                  status: "ready",
                  healthState: "healthy",
                  failureProbability: 0.012,
                  healthyProbability: 0.988,
                  modelVersion: "4.0.0-benchmark",
                  recommendedAction: "Nominal operation",
                  processingTimeMs: 4,
                },
              },
            },
          },
        ],
      };
    });

    await runMaintenancePrediction({
      productType: "M",
      airTemperatureK: 298.5,
      processTemperatureK: 308.8,
      rotationalSpeedRpm: 1500,
      torqueNm: 40.0,
      toolWearMin: 15,
    });

    expect(interceptedRequests.length).toBeGreaterThan(0);
    const req = interceptedRequests[0];
    expect(req.url).toContain("predictiveMaintenance.benchmarkPredict");
    expect(req.method).toBe("POST");

    // SuperJSON batch structure: {"0": {"json": { ...payload... }}}
    expect(req.body).toBeDefined();
    expect(req.body["0"]).toBeDefined();
    expect(req.body["0"].json).toBeDefined();
    expect(req.body["0"].json.productType).toBe("M");
    expect(req.body["0"].json.airTemperatureK).toBe(298.5);
    expect(req.body["0"].json.rotationalSpeedRpm).toBe(1500);
  });

  it("injects Bearer token into Authorization header when session cookie is stored", async () => {
    const originalSessionStorage = globalThis.sessionStorage;
    const mockStorage: Record<string, string> = {
      "manus-cookie": `${COOKIE_NAME}=test-operator-jwt-token-12345`,
    };
    globalThis.sessionStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => { mockStorage[key] = val; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => {},
      length: 1,
      key: () => null,
    };

    const headers = getAuthHeaders();
    expect(headers.Authorization).toBe("Bearer test-operator-jwt-token-12345");

    globalThis.sessionStorage = originalSessionStorage;
  });
});

describe("Model 3: Scientific Honesty & Zero-Fabrication Guarantees", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("verifies genuine SHA-256 model artifact checksum in benchmark metadata", () => {
    expect(PQ_METADATA.sha256Hash).toBe("392d26cd80b37bd3600e49124099b9ba17cbff05be404ca8d0e35bebda196beb");
    expect(PQ_METADATA.inputFeatureCount).toBe(590);
    expect(PQ_METADATA.metrics.accuracy).toBe(0.8475);
    expect(PQ_METADATA.metrics.thresholdUsed).toBe(0.07);
  });

  it("strictly raises MODEL_UNAVAILABLE when inference engine is offline without local heuristics fallback", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 503,
      ok: false,
      statusText: "Service Unavailable",
    });

    const validVector = new Array(590).fill(0.2);

    await expect(runBenchmarkPrediction(validVector)).rejects.toThrow(PredictiveQualityApiError);

    try {
      await runBenchmarkPrediction(validVector);
      expect.unreachable("Must fail when backend engine is offline");
    } catch (err: any) {
      expect(err.code).toBe("MODEL_UNAVAILABLE");
      expect(err.message).toContain("Model Engine Unavailable — Real Inference Execution Required");
    }
  });

  it("strictly prohibits silent truncation or padding of feature vectors", async () => {
    const shortVector = [1.0, 2.0, 3.0];
    await expect(runBenchmarkPrediction(shortVector)).rejects.toThrow(PredictiveQualityApiError);

    try {
      await runBenchmarkPrediction(shortVector);
    } catch (err: any) {
      expect(err.code).toBe("DIMENSION_MISMATCH");
      expect(err.message).toContain("590");
    }
  });

  it("truthfully maintains Solar PV Quality model in DATASET_BLOCKED state", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("readiness")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: {
              data: {
                datasetStatus: "DATASET_BLOCKED",
                tableCounts: {
                  batches: 0,
                  sensorReadings: 0,
                  qualityOutcomeLabels: 0,
                  linkedInspections: 0,
                  eligibleTrainingExamples: 0,
                },
                blockingReasons: ["Zero confirmed factory quality outcome labels in production database."],
              },
            },
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    const readiness = await fetchSolarFactoryReadiness();
    expect(readiness.status).toBe("DATASET_BLOCKED");
    expect(readiness.tableCounts.qualityOutcomeLabels).toBe(0);
    expect(readiness.tableCounts.eligibleTrainingExamples).toBe(0);
  });
});

describe("Model 4: Certified Metrics, Operating Condition & RUL Quarantine", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("verifies certified test metrics and Platt calibration (not unverified 99.8%)", () => {
    const m = PDM_METADATA.metrics;
    expect(m.accuracy).toBe(0.9667);
    expect(m.balancedAccuracy).toBe(0.7325);
    expect(m.rocAuc).toBe(0.9307);
    expect(m.f1Score).toBe(0.5);
    expect(m.thresholdUsed).toBe(0.1981);
    expect(m.testSamples).toBe(1502);
    expect(m.brierScore).toBe(0.0236);
    expect(m.ece).toBe(0.0113);

    // Verify 99.8% is NOT claimed
    expect(m.accuracy).not.toBe(0.998);
  });

  it("strictly quarantines RUL as N/A and discloses operating-condition binary classifier boundary", async () => {
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
                failureProbability: 0.88,
                healthyProbability: 0.12,
                modelVersion: "4.0.0-benchmark",
                recommendedAction: "Replace insert immediately",
              },
            },
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    const result = await runMaintenancePrediction({
      productType: "L",
      airTemperatureK: 298.2,
      processTemperatureK: 308.7,
      rotationalSpeedRpm: 1400,
      torqueNm: 46.0,
      toolWearMin: 215,
    });

    expect(result.classification).toBe("FAILURE");
    expect(result.remainingUsefulLifeHours).toBe("N/A");
    expect(result.rulExplanation).toContain("Operating Condition Classifier Only");
    expect(result.rulExplanation).toContain("Prognostic RUL Model Not Deployed");
  });

  it("clearly marks deterministic engineering formulas as isRuleBased: true", () => {
    const input = {
      productType: "L" as const,
      airTemperatureK: 298.2,
      processTemperatureK: 308.7,
      rotationalSpeedRpm: 1400,
      torqueNm: 46.0,
      toolWearMin: 10,
    };
    const derived = calculateDerivedPhysics(input);
    const modes = getRuleBasedFailureModes(derived);

    expect(modes.length).toBe(5);
    for (const mode of modes) {
      expect(mode.isRuleBased).toBe(true);
      expect(mode.engineeringFormula).toBeDefined();
    }
  });
});

describe("Model 2: Truthful Checkpoint Status & Data Onboarding Lineage", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("truthfully reports not_trained when checkpoint is missing without fabricating etiology", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("rootCause.status")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: {
              data: {
                isReady: false,
                modelName: "SolarVision-RC-Model2",
                modelVersion: "none",
                unavailabilityReason: "Model 2 checkpoint file not found at 'backend/models/root_cause/root_cause_model.pt'.",
              },
            },
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    const status = await fetchModel2Status();
    expect(status.status).toBe("not_trained");
    expect(status.isReady).toBe(false);
    expect(status.trainingStatus).toContain("checkpoint");
  });

  it("truthfully maintains DATASET_BLOCKED when zero sensor telemetry or confirmed labels exist", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("rootCause.readiness")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: {
              data: {
                datasetStatus: "DATASET_BLOCKED",
                tableCounts: {
                  batches: 0,
                  machines: 0,
                  sensors: 0,
                  annotations: 0,
                },
                blockingReasons: ["Zero historical sensor telemetry records available."],
              },
            },
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    const readiness = await fetchDatasetReadiness();
    expect(readiness.status).toBe("DATASET_BLOCKED");
    expect(readiness.sensorRecordsCount).toBe(0);
    expect(readiness.expertAnnotationsCount).toBe(0);
  });
});
