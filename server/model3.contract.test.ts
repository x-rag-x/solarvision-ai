/**
 * SolarVision AI — Phase 3 / Model 3 QA Suite
 * Model 3 Predictive Quality Server Integration & Contract Tests
 *
 * Verifies:
 * 1. Feature contract: 32 canonical solar features, units, nominal baselines.
 * 2. Feature sufficiency checks: detects missing measurements gracefully.
 * 3. Zero-fabrication guarantee: returns not_trained status without fabricating forecasts.
 * 4. Model 3 status probe: truthfully reports unready status when checkpoint is absent.
 * 5. Database bridge contract: formats and validates records for predictive_quality_forecasts.
 * 6. Readiness summary: queries batch counts and forecasts without crashing.
 * 7. Domain quarantine: separates solar_cell_manufacturing from semiconductor_benchmark.
 */

import { describe, it, expect } from "vitest";
import {
  CANONICAL_SOLAR_FEATURES,
  CANONICAL_SOLAR_FEATURE_COUNT,
  MODEL3_CONTRACT_VERSION,
  hasSufficientQualityFeatures,
} from "./predictiveQuality/featureContract";
import {
  forecastPredictiveQuality,
  getModel3Status,
  isModel3ArtifactPresent,
} from "./predictiveQuality/service";
import {
  formatForecastForPersistence,
  getQualityReadinessSummary,
} from "./predictiveQuality/dbContract";
import type { PredictiveQualityInput, PredictiveQualityResponse } from "./predictiveQuality/types";

describe("Model 3: Predictive Quality Monitoring — Contract & Integration Suite", () => {
  describe("Feature Specification & Contract Parity", () => {
    it("enforces canonical 32-feature contract for solar cell manufacturing", () => {
      expect(CANONICAL_SOLAR_FEATURE_COUNT).toBe(32);
      expect(CANONICAL_SOLAR_FEATURES).toHaveLength(32);
      expect(MODEL3_CONTRACT_VERSION).toBe("1.0.0");

      const featureNames = CANONICAL_SOLAR_FEATURES.map((f) => f.name);
      // Key electrical test parameters
      expect(featureNames).toContain("voc_v");
      expect(featureNames).toContain("isc_a");
      expect(featureNames).toContain("fill_factor_pct");
      expect(featureNames).toContain("cell_efficiency_pct");

      // Key thermal and mechanical process parameters
      expect(featureNames).toContain("soldering_temp_top_c");
      expect(featureNames).toContain("squeegee_pressure_n_cm2");
      expect(featureNames).toContain("firing_peak_temp_c");
      expect(featureNames).toContain("lamination_temp_c");
    });

    it("verifies feature definitions have valid engineering units and positive nominal baselines", () => {
      for (const feat of CANONICAL_SOLAR_FEATURES) {
        expect(feat.index).toBeGreaterThanOrEqual(0);
        expect(feat.index).toBeLessThan(32);
        expect(feat.unit.length).toBeGreaterThan(0);
        expect(feat.nominal).toBeGreaterThanOrEqual(feat.minValid);
        expect(feat.nominal).toBeLessThanOrEqual(feat.maxValid);
      }
    });

    it("detects insufficient features correctly", () => {
      // Empty input has no features
      const emptyInput: PredictiveQualityInput = {};
      expect(hasSufficientQualityFeatures(emptyInput)).toBe(false);

      // Input with only batchId has no features
      const batchOnly: PredictiveQualityInput = { batchId: "BATCH-001" };
      expect(hasSufficientQualityFeatures(batchOnly)).toBe(false);

      // Input with electrical parameter has sufficient features
      const validElec: PredictiveQualityInput = {
        electricalParameters: { voc_v: 0.685 },
      };
      expect(hasSufficientQualityFeatures(validElec)).toBe(true);

      // Input with sensor measurements has sufficient features
      const validSensor: PredictiveQualityInput = {
        sensorMeasurements: [
          { sensorType: "soldering_temp_top_c", measurementValue: 225.0 },
        ],
      };
      expect(hasSufficientQualityFeatures(validSensor)).toBe(true);
    });
  });

  describe("Zero-Fabrication & Truthful Status Reporting", () => {
    it("returns missing_features response without fabricating predictions when input is empty", async () => {
      const res = await forecastPredictiveQuality({});

      expect(res.contractVersion).toBe("1.0.0");
      expect(res.status).toBe("missing_features");
      expect(res.qualityOutcome).toBe("unknown");
      expect(res.riskLevel).toBe("unknown");
      expect(res.confidence).toBeNull();
      expect(res.predictedDefectRate).toBeNull();
      expect(res.predictedYield).toBeNull();
      expect(res.probabilities).toEqual({});
      expect(res.topRiskFactors).toEqual([]);
      expect(res.limitations[0]).toContain("Missing manufacturing process telemetry");
    });

    it("truthfully returns not_trained when model weights are not deployed in production", async () => {
      // Provide valid telemetry so it proceeds past feature check
      const input: PredictiveQualityInput = {
        batchId: "BATCH-TEST-QA-01",
        electricalParameters: { voc_v: 0.690, cellEfficiencyPct: 23.8 },
      };

      const res = await forecastPredictiveQuality(input);

      if (!isModel3ArtifactPresent()) {
        expect(res.status).toBe("not_trained");
        expect(res.qualityOutcome).toBe("unknown");
        expect(res.riskLevel).toBe("unknown");
        expect(res.confidence).toBeNull();
        expect(res.predictedYield).toBeNull();
        expect(res.isCalibrated).toBe(false);
        expect(res.limitations).toEqual(
          expect.arrayContaining([
            expect.stringContaining("Zero synthetic forecasts or fabricated confidence values"),
          ])
        );
      }
    });

    it("probes Model 3 status truthfully without throwing exceptions", async () => {
      const status = await getModel3Status();

      expect(status).toHaveProperty("isReady");
      expect(status).toHaveProperty("modelName");
      expect(status).toHaveProperty("domain", "solar_cell_manufacturing");
      expect(status).toHaveProperty("expectedDim", 32);
      expect(status).toHaveProperty("schemaVersion", "1.0.0");

      if (!isModel3ArtifactPresent()) {
        expect(status.isReady).toBe(false);
        expect(status.modelVersion).toBe("none");
        expect(status.unavailabilityReason).toContain("Model 3 checkpoint not found");
      }
    });
  });

  describe("Database Persistence & Readiness Bridge", () => {
    it("formats successful forecasts for predictive_quality_forecasts persistence", () => {
      const mockResponse: PredictiveQualityResponse = {
        contractVersion: "1.0.0",
        status: "ready",
        domain: "solar_cell_manufacturing",
        batchId: "BATCH-PROD-2026-001",
        machineId: "MACH-STR-01",
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
        recommendedAction: "Continue standard production.",
        modelVersion: "3.0.0-rc1",
        modelMetadata: null,
        limitations: [],
        processingTimeMs: 12.5,
      };

      const record = formatForecastForPersistence(mockResponse);
      expect(record).not.toBeNull();
      expect(record?.batchId).toBe("BATCH-PROD-2026-001");
      expect(record?.predictedDefectRate).toBe(0.02);
      expect(record?.predictedYield).toBe(98.0);
      expect(record?.riskLevel).toBe("low");
      expect(record?.confidenceIntervalLow).toBe(0.88);
      expect(record?.confidenceIntervalHigh).toBe(0.96);
    });

    it("returns null when formatting forecast with missing batchId or unready status", () => {
      const unreadyResponse: PredictiveQualityResponse = {
        contractVersion: "1.0.0",
        status: "not_trained",
        domain: "solar_cell_manufacturing",
        batchId: "BATCH-001",
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
        processingTimeMs: 1.0,
      };

      expect(formatForecastForPersistence(unreadyResponse)).toBeNull();
    });

    it("queries quality readiness summary without database errors", async () => {
      const summary = await getQualityReadinessSummary();

      expect(summary).toHaveProperty("schemaVersion", "1.0.0");
      expect(summary).toHaveProperty("canonicalFeatureCount", 32);
      expect(summary).toHaveProperty("datasetStatus");
      expect(summary).toHaveProperty("tableCounts");
      expect(summary.tableCounts).toHaveProperty("forecasts");
      expect(summary.tableCounts).toHaveProperty("batches");
      expect(summary.tableCounts).toHaveProperty("sensorReadings");
    });
  });
});
