import { describe, expect, it } from "vitest";
import {
  CANONICAL_FEATURE_ORDER,
  ROOT_CAUSE_TAXONOMY,
  ROOT_CAUSE_DESCRIPTIONS,
  SENSOR_SPECIFICATIONS,
  hasSufficientManufacturingData,
} from "./rootCause/featureContract";
import type {
  RootCauseAnalysisInput,
  RootCauseResponse,
  ProbableCause,
  Model2StatusInfo,
} from "./rootCause/types";
import { getModel2Status } from "./rootCause/service";

describe("Model 2 QA Foundation — Multimodal Root Cause Quality Suite", () => {
  // ==========================================================================
  // 1. Dataset Schema Validation & Canonical Enums
  // ==========================================================================
  describe("Dataset Schema & Entity Contracts", () => {
    it("conforms to canonical 40-feature ordered schema", () => {
      expect(CANONICAL_FEATURE_ORDER.length).toBe(40);
      expect(CANONICAL_FEATURE_ORDER).toContain("feat_defect_count");
      expect(CANONICAL_FEATURE_ORDER).toContain("feat_is_crack");
      expect(CANONICAL_FEATURE_ORDER).toContain("soldering_temp_top_mean_w15");
      expect(CANONICAL_FEATURE_ORDER).toContain("lamination_temp_mean_w15");
      expect(CANONICAL_FEATURE_ORDER).toContain("voc_v");
      expect(CANONICAL_FEATURE_ORDER).toContain("isc_a");
      expect(CANONICAL_FEATURE_ORDER).toContain("event_count_recent_1h");
    });

    it("conforms to the 9-class manufacturing root cause taxonomy", () => {
      expect(ROOT_CAUSE_TAXONOMY.length).toBe(9);
      expect(ROOT_CAUSE_TAXONOMY).toContain("thermal_stress_soldering");
      expect(ROOT_CAUSE_TAXONOMY).toContain("squeegee_pressure_drift");
      expect(ROOT_CAUSE_TAXONOMY).toContain("screen_mesh_clogging");
      expect(ROOT_CAUSE_TAXONOMY).toContain("firing_thermal_profile_excursion");
      expect(ROOT_CAUSE_TAXONOMY).toContain("mechanical_handling_impact");
      expect(ROOT_CAUSE_TAXONOMY).toContain("lamination_pressure_imbalance");
      expect(ROOT_CAUSE_TAXONOMY).toContain("ingot_thermal_gradient");
      expect(ROOT_CAUSE_TAXONOMY).toContain("chemical_texturing_contamination");
      expect(ROOT_CAUSE_TAXONOMY).toContain("nominal_process_variation");
    });

    it("verifies actionable technical descriptions for each taxonomy category", () => {
      for (const cause of ROOT_CAUSE_TAXONOMY) {
        expect(ROOT_CAUSE_DESCRIPTIONS[cause]).toBeDefined();
        expect(ROOT_CAUSE_DESCRIPTIONS[cause].length).toBeGreaterThan(25);
      }
    });
  });

  // ==========================================================================
  // 2. Missing Process Data Handling
  // ==========================================================================
  describe("Missing Process Data & Telemetry Sufficiency", () => {
    it("identifies completely empty manufacturing telemetry as insufficient", () => {
      const emptyInput = {
        sensorMeasurements: [],
        machine: undefined,
        batch: undefined,
        productionEvents: [],
      };
      expect(hasSufficientManufacturingData(emptyInput)).toBe(false);
    });

    it("identifies sufficient telemetry when sensor measurements are present", () => {
      const sensorInput = {
        sensorMeasurements: [{ sensorType: "laminator_temp", measurementValue: 145.0 }],
      };
      expect(hasSufficientManufacturingData(sensorInput)).toBe(true);
    });

    it("identifies sufficient telemetry when machine context is present", () => {
      const machineInput = {
        machine: { machineId: "stringer-01" },
      };
      expect(hasSufficientManufacturingData(machineInput)).toBe(true);
    });

    it("identifies sufficient telemetry when batch context is present", () => {
      const batchInput = {
        batch: { batchId: "batch-2026-m01" },
      };
      expect(hasSufficientManufacturingData(batchInput)).toBe(true);
    });

    it("identifies sufficient telemetry when production events are present", () => {
      const eventInput = {
        productionEvents: [{ eventType: "thermal_drift" }],
      };
      expect(hasSufficientManufacturingData(eventInput)).toBe(true);
    });
  });

  // ==========================================================================
  // 3. Physical Sensor Range Bounds & Invalid Values
  // ==========================================================================
  describe("Physical Sensor Bounds & Engineering Specifications", () => {
    it("defines valid nominal ranges for critical process sensors", () => {
      for (const [sensorType, spec] of Object.entries(SENSOR_SPECIFICATIONS)) {
        expect(spec.min).toBeLessThan(spec.max);
        expect(spec.nominalMean).toBeGreaterThanOrEqual(spec.min);
        expect(spec.nominalMean).toBeLessThanOrEqual(spec.max);
        expect(typeof spec.unit).toBe("string");
      }
    });

    it("flags out-of-bounds laminator temperatures", () => {
      const spec = SENSOR_SPECIFICATIONS.lamination_temp_c;
      expect(spec).toBeDefined();

      const validTemp = 150.0;
      const invalidLow = 10.0; // below 120.0 C
      const invalidHigh = 350.0; // above 180.0 C

      expect(validTemp >= spec.min && validTemp <= spec.max).toBe(true);
      expect(invalidLow >= spec.min && invalidLow <= spec.max).toBe(false);
      expect(invalidHigh >= spec.min && invalidHigh <= spec.max).toBe(false);
    });

    it("flags out-of-bounds soldering temperatures", () => {
      const spec = SENSOR_SPECIFICATIONS.soldering_temp_top_c;
      expect(spec).toBeDefined();

      const validTemp = 225.0;
      const invalidLow = 50.0; // below 150.0 C
      const invalidHigh = 600.0; // above 300.0 C

      expect(validTemp >= spec.min && validTemp <= spec.max).toBe(true);
      expect(invalidLow >= spec.min && invalidLow <= spec.max).toBe(false);
      expect(invalidHigh >= spec.min && invalidHigh <= spec.max).toBe(false);
    });
  });

  // ==========================================================================
  // 4. Model Unavailable States & Truthful Reporting
  // ==========================================================================
  describe("Model Availability Status & Zero-Fabrication Guarantees", () => {
    it("reports status truthfully when weights are missing without throwing exceptions", async () => {
      const status: Model2StatusInfo = await getModel2Status();
      expect(status.modelName).toBe("SolarVision-RC-Model2");
      expect(typeof status.isReady).toBe("boolean");
      expect(typeof status.modelVersion).toBe("string");
      expect(typeof status.artifactPath).toBe("string");

      if (!status.isReady) {
        expect(status.unavailabilityReason).toBeDefined();
        expect(typeof status.unavailabilityReason).toBe("string");
      }
    });
  });

  // ==========================================================================
  // 5. Prediction Response Contract Shape
  // ==========================================================================
  describe("Prediction Response Contract Conformance", () => {
    it("validates compliant ProbableCause schema", () => {
      const cause: ProbableCause = {
        causeCode: "RC-SOLD-01",
        label: "Soldering Tip Thermal Excursion",
        confidence: 0.85,
        supportingEvidence: ["soldering_temp exceeded 350°C"],
        recommendedAction: "Recalibrate stringer PID loop",
        featureImportance: { soldering_temp_max: 0.42 },
      };

      expect(cause.causeCode).toMatch(/^RC-[A-Z]+-\d+$/);
      expect(cause.confidence).toBeGreaterThanOrEqual(0.0);
      expect(cause.confidence).toBeLessThanOrEqual(1.0);
      expect(Array.isArray(cause.supportingEvidence)).toBe(true);
      expect(typeof cause.recommendedAction).toBe("string");
    });

    it("validates compliant RootCauseResponse shape", () => {
      const response: RootCauseResponse = {
        inspectionId: "123e4567-e89b-12d3-a456-426614174000",
        batchId: "batch-2026-m01-01",
        machineId: "stringer-01",
        status: "missing_process_data",
        probableCauses: [],
        modelVersion: "m2-dev-alpha",
        limitations: ["Insufficient process data provided for root-cause attribution"],
      };

      expect(["ready", "not_trained", "missing_process_data", "error"]).toContain(
        response.status
      );
      expect(Array.isArray(response.probableCauses)).toBe(true);
      expect(Array.isArray(response.limitations)).toBe(true);
      expect(response.limitations.length).toBeGreaterThan(0);
    });
  });
});
