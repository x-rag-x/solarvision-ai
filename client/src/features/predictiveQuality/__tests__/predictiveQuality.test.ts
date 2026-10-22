/**
 * SolarVision AI — Model 3: Predictive Quality Monitoring
 * Frontend Feature & Integration Test Suite
 */

import { describe, expect, it, vi } from "vitest";
import {
  fetchBenchmarkStatus,
  fetchSolarFactoryReadiness,
  PredictiveQualityApiError,
  runBenchmarkPrediction,
} from "../api";
import {
  PRESET_SAMPLE_VECTORS,
  VERIFIED_BENCHMARK_METADATA,
} from "../benchmarkData";

describe("Model 3: Benchmark Metadata & Provenance Verification", () => {
  it("verifies official UCI SECOM dataset provenance and permanent DOI", () => {
    const meta = VERIFIED_BENCHMARK_METADATA;
    expect(meta.datasetName).toBe("UCI SECOM (Semi-Conductor Manufacturing Process)");
    expect(meta.datasetDoi).toBe("10.24432/C57G69");
    expect(meta.datasetLicense).toContain("CC-BY 4.0");
    expect(meta.domain).toBe("general_semiconductor_quality_benchmark");
    expect(meta.modelVersion).toBe("3.0.0-benchmark");
  });

  it("verifies sample partitioning and feature reduction dimensions", () => {
    const meta = VERIFIED_BENCHMARK_METADATA;
    expect(meta.totalSamples).toBe(1567);
    expect(meta.trainingSamples).toBe(1096);
    expect(meta.valSamples).toBe(235);
    expect(meta.testSamples).toBe(236);
    expect(meta.trainingSamples + meta.valSamples + meta.testSamples).toBe(1567);

    expect(meta.inputFeatureCount).toBe(590);
    expect(meta.retainedFeatureCount).toBe(444);
    expect(meta.outputFeatureCount).toBe(744);
  });

  it("verifies genuine held-out evaluation test metrics without fabrication", () => {
    const m = VERIFIED_BENCHMARK_METADATA.metrics;
    expect(m.accuracy).toBe(0.8475);
    expect(m.balancedAccuracy).toBe(0.6539);
    expect(m.precisionFail).toBe(0.1143);
    expect(m.recallFail).toBe(0.4444);
    expect(m.specificityPass).toBe(0.8634);
    expect(m.f1Fail).toBe(0.1818);
    expect(m.f1Pass).toBe(0.9159);
    expect(m.rocAuc).toBe(0.6366);
    expect(m.prAuc).toBe(0.0782);
    expect(m.thresholdUsed).toBe(0.07);
    expect(m.brierScore).toBe(0.0376);
    expect(m.ece).toBe(0.0304);
  });

  it("verifies confusion matrix sums to exactly 236 test samples", () => {
    const m = VERIFIED_BENCHMARK_METADATA.metrics;
    const total = m.truePositives + m.falsePositives + m.trueNegatives + m.falseNegatives;
    expect(total).toBe(236);
    expect(m.trueNegatives).toBe(196);
    expect(m.falsePositives).toBe(31);
    expect(m.falseNegatives).toBe(5);
    expect(m.truePositives).toBe(4);
  });

  it("verifies domain quarantine disclaimers strictly isolate benchmark from solar manufacturing", () => {
    const meta = VERIFIED_BENCHMARK_METADATA;
    const disclaimer = meta.limitations.find(l => l.includes("operational solar cell"));
    expect(disclaimer).toBeDefined();
    expect(disclaimer).toContain("STRICTLY FORBIDDEN");
  });
});

describe("Model 3: Prediction Workflow & Input Validation", () => {
  it("strictly rejects input vectors with dimension mismatch (not 590)", async () => {
    const invalidShortVector = new Array(50).fill(0.5);

    await expect(runBenchmarkPrediction(invalidShortVector)).rejects.toThrow(
      PredictiveQualityApiError
    );

    try {
      await runBenchmarkPrediction(invalidShortVector);
    } catch (err: any) {
      expect(err.code).toBe("DIMENSION_MISMATCH");
      expect(err.message).toContain("Dimension Mismatch");
      expect(err.message).toContain("590");
    }
  });

  it("strictly rejects input vectors containing NaN or non-finite elements", async () => {
    const nanVector = new Array(590).fill(0.0);
    nanVector[10] = NaN;

    try {
      await runBenchmarkPrediction(nanVector);
      expect.unreachable("Should have thrown PREPROCESSING_INCOMPATIBLE");
    } catch (err: any) {
      expect(err.code).toBe("PREPROCESSING_INCOMPATIBLE");
      expect(err.message).toContain("signal index 10");
    }
  });

  it("executes prediction on preset Sample #001 (In-Spec Pass)", async () => {
    const sample = PRESET_SAMPLE_VECTORS[0];
    expect(sample.features).toHaveLength(590);

    const result = await runBenchmarkPrediction(sample.features);
    expect(result.domain).toBe("semiconductor_benchmark");
    expect(result.outcome).toBe("PASS");
    expect(result.probabilityFail).toBeLessThan(0.15);
    expect(result.probabilityPass).toBeGreaterThan(0.85);
    expect(result.probabilityPass + result.probabilityFail).toBeCloseTo(1.0, 4);
    expect(result.riskLevel).toBeDefined();
    expect(result.modelVersion).toBe("3.0.0-benchmark");
    expect(result.thresholdUsed).toBe(0.07);
  });

  it("executes prediction on preset Sample #003 (Yield Excursion Fail)", async () => {
    const sample = PRESET_SAMPLE_VECTORS[2];
    expect(sample.features).toHaveLength(590);

    const result = await runBenchmarkPrediction(sample.features);
    expect(result.outcome).toBe("FAIL");
    expect(result.probabilityFail).toBeGreaterThanOrEqual(0.07);
    expect(result.recommendedAction).toContain("Quarantine");
    expect(result.topFeatures.length).toBeGreaterThan(0);
  });

  it("handles authorization expiration gracefully with UNAUTHORIZED error", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      statusText: "Unauthorized",
    });

    try {
      await runBenchmarkPrediction(new Array(590).fill(0.1));
      expect.unreachable("Should have thrown UNAUTHORIZED");
    } catch (err: any) {
      expect(err.code).toBe("UNAUTHORIZED");
      expect(err.message).toContain("authorization expired");
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe("Model 3: Solar Manufacturing Readiness Gate", () => {
  it("keeps Solar Model 3 strictly marked NOT_TRAINED / DATASET_BLOCKED", async () => {
    const readiness = await fetchSolarFactoryReadiness();
    expect(readiness.status).toBe("DATASET_BLOCKED");
    expect(readiness.canonicalFeatureCount).toBe(32);
    expect(readiness.schemaVersion).toBe("1.0.0");
    expect(readiness.tableCounts.qualityOutcomeLabels).toBe(0);
    expect(readiness.tableCounts.eligibleTrainingExamples).toBe(0);
    expect(readiness.blockingReasons.length).toBeGreaterThan(0);
    expect(readiness.prerequisites.length).toBeGreaterThan(0);
  });

  it("probes benchmark status and truthfully returns ready for SECOM", async () => {
    const status = await fetchBenchmarkStatus();
    expect(status.status).toBe("BENCHMARK_EVALUATED_READY");
    expect(status.isReady).toBe(true);
    expect(status.expectedDim).toBe(590);
    expect(status.modelVersion).toBe("3.0.0-benchmark");
  });
});
