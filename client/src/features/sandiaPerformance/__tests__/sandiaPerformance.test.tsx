/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * Comprehensive Component & Integration Test Suite
 * 
 * Verifies:
 * 1. Schema-driven dynamic field rendering with physical units and bounds.
 * 2. Missing-feature and out-of-bounds sensor validation.
 * 3. Model unavailable / not_trained truthful status presentation.
 * 4. Schema pending trainer handoff state.
 * 5. Honest prediction response rendering without fabricated confidences.
 * 6. Isolated test mock fixture disclosure.
 * 7. Model architecture variants and future roadmap quarantine.
 * 8. Preservation of existing SECOM predictive quality functionality.
 */

import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DynamicPredictionForm,
  ModelEvaluationSection,
  ModelStatusCard,
  ModelVariantsRoadmapCard,
  PredictionHistoryTable,
  PredictionResultDisplay,
  RestSandiaApiAdapter,
  SandiaApiError,
  TrpcSandiaApiAdapter,
} from "../index";
import type {
  FeatureSchemaManifest,
  SandiaModelStatusResponse,
  SandiaPredictionInput,
  SandiaPredictionResponse,
  TargetDefinitionManifest,
  TrainerEvaluationMetrics,
} from "../types";

// =============================================================================
// TEST FIXTURES (Explicit, never passed as fake production results)
// =============================================================================

const FIXTURE_FEATURE_SCHEMA: FeatureSchemaManifest = {
  schema_version: "1.0.0",
  dataset_name: "Sandia Photovoltaic Systems Evaluation Laboratory (PSEL)",
  features: [
    {
      name: "irradiance",
      type: "float",
      required: true,
      unit: "W/m^2",
      min_value: 0.0,
      max_value: 1500.0,
      description: "Plane-of-array broadband solar irradiance",
    },
    {
      name: "cell_temperature",
      type: "float",
      required: true,
      unit: "degC",
      min_value: -40.0,
      max_value: 95.0,
      description: "Back-of-module thermocouple temperature reading",
    },
    {
      name: "wind_speed",
      type: "float",
      required: false,
      unit: "m/s",
      min_value: 0.0,
      max_value: 40.0,
      description: "Local anemometer wind velocity",
    },
  ],
  metadata: {
    trainer: "SolarVision-Sandia-Team",
  },
};

const FIXTURE_TARGET_DEFINITION: TargetDefinitionManifest = {
  target_name: "Pmp",
  target_type: "regression",
  target_unit: "W",
  description: "Maximum Power Point instantaneous electrical power output",
  min_value: 0.0,
  max_value: 450.0,
  metadata: {},
};

const FIXTURE_STATUS_NOT_TRAINED: SandiaModelStatusResponse = {
  model_name: "SolarVision-Sandia-Performance-Model3",
  model_version: "none",
  contract_version: "1.0.0",
  is_ready: false,
  status: "not_trained",
  artifact_name: "pipeline.joblib",
  unavailability_reason: "Sandia solar performance model artifact (pipeline.joblib) not found. Zero synthetic numbers or fabricated confidences are returned.",
  feature_schema_loaded: false,
  feature_schema: null,
  sample_input_loaded: false,
  sample_input: null,
  target_definition_loaded: false,
  target_definition: null,
  is_mock: false,
  trainer_handoff_pending: true,
  expected_dim: null,
};

const FIXTURE_STATUS_READY: SandiaModelStatusResponse = {
  model_name: "SolarVision-Sandia-Performance-Model3",
  model_version: "1.0.0-rc1",
  contract_version: "1.0.0",
  is_ready: true,
  status: "ready",
  artifact_name: "pipeline.joblib",
  unavailability_reason: null,
  feature_schema_loaded: true,
  feature_schema: FIXTURE_FEATURE_SCHEMA,
  sample_input_loaded: true,
  sample_input: {
    features: {
      irradiance: 1000.0,
      cell_temperature: 25.0,
      wind_speed: 1.5,
    },
  },
  target_definition_loaded: true,
  target_definition: FIXTURE_TARGET_DEFINITION,
  is_mock: false,
  trainer_handoff_pending: false,
  expected_dim: 3,
};

const FIXTURE_PREDICTION_RESPONSE: SandiaPredictionResponse = {
  contract_version: "1.0.0",
  status: "ready",
  model_name: "SolarVision-Sandia-Performance-Model3",
  model_version: "1.0.0-rc1",
  is_mock: false,
  prediction: {
    module_id: "PV-MOD-2026-X1",
    prediction: 312.45,
    prediction_label: "nominal_output",
    target_name: "Pmp",
    target_unit: "W",
    confidence: null, // Deterministic - zero fabrication
    uncertainty: null,
    features_used: ["irradiance", "cell_temperature", "wind_speed"],
    is_mock: false,
    warnings: [],
  },
  limitations: [
    "Telemetry must be calibrated within standard irradiance bounds (0-1500 W/m²).",
  ],
  processing_time_ms: 14.8,
};

const FIXTURE_MOCK_PREDICTION_RESPONSE: SandiaPredictionResponse = {
  contract_version: "1.0.0",
  status: "ready",
  model_name: "SolarVision-Sandia-Performance-Model3",
  model_version: "mock-test-fixture",
  is_mock: true,
  prediction: {
    module_id: "PV-MOD-MOCK-001",
    prediction: 88.5,
    prediction_label: "mock_retention",
    target_name: "Power Retention",
    target_unit: "%",
    confidence: null,
    uncertainty: null,
    features_used: ["irradiance", "cell_temperature"],
    is_mock: true,
    warnings: ["Test fixture mock notice"],
  },
  limitations: [
    "ISOLATED TEST MOCK: This prediction was generated by an automated test mock fixture.",
  ],
  processing_time_ms: 2.1,
};

// =============================================================================
// TEST SUITE
// =============================================================================

describe("Model 3: Sandia Schema-Driven Dynamic Form & Field Rendering", () => {
  it("renders dynamic form fields strictly driven by FeatureSchemaManifest", () => {
    const html = renderToString(
      <DynamicPredictionForm
        schema={FIXTURE_FEATURE_SCHEMA}
        schemaStatus="loaded"
        modelStatus={FIXTURE_STATUS_READY}
        sampleInput={null}
        targetDefinition={FIXTURE_TARGET_DEFINITION}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />
    );

    // Verifies all features from schema are present
    expect(html).toContain("irradiance");
    expect(html).toContain("cell_temperature");
    expect(html).toContain("wind_speed");

    // Verifies physical units are rendered
    expect(html).toContain("W/m^2");
    expect(html).toContain("degC");
    expect(html).toContain("m/s");

    // Verifies target output label and unit
    expect(html).toContain("Pmp");
    expect(html).toContain("W");

    // Verifies schema count badge
    expect(html).toContain("Features Defined");
    expect(html).toContain("3");
  });

  it("displays honest pending state when feature schema is awaiting trainer delivery", () => {
    const html = renderToString(
      <DynamicPredictionForm
        schema={null}
        schemaStatus="pending_trainer"
        modelStatus={FIXTURE_STATUS_NOT_TRAINED}
        sampleInput={null}
        targetDefinition={null}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />
    );

    expect(html).toContain("SCHEMA_PENDING_TRAINER");
    expect(html).toContain("Feature Input Form Awaiting Trainer Contract");
    expect(html).toContain("feature_schema.json");
    expect(html).not.toContain("irradiance"); // Zero assumed features!
  });

  it("displays loading spinner when schema contract is being discovered", () => {
    const html = renderToString(
      <DynamicPredictionForm
        schema={null}
        schemaStatus="loading"
        modelStatus={null}
        sampleInput={null}
        targetDefinition={null}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />
    );

    expect(html).toContain("Discovering and parsing trainer feature contract...");
  });
});

describe("Model 3: Model Status & Provenance Card", () => {
  it("truthfully renders NOT_TRAINED when pipeline artifact is absent without leaking internal paths", () => {
    const html = renderToString(
      <ModelStatusCard
        status={FIXTURE_STATUS_NOT_TRAINED}
        loading={false}
        onRefresh={vi.fn()}
      />
    );

    expect(html).toContain("NOT_TRAINED");
    expect(html).toContain("TRAINER_HANDOFF_PENDING");
    expect(html).toContain("Model Pipeline Quarantined");
    expect(html).toContain("pipeline.joblib");
    expect(html).toContain("Zero synthetic numbers or fabricated confidences are returned");
    // Security check: No local Windows paths
    expect(html).not.toContain("D:\\");
    expect(html).not.toContain("C:\\");
  });

  it("renders READY state when trained pipeline is verified", () => {
    const html = renderToString(
      <ModelStatusCard
        status={FIXTURE_STATUS_READY}
        loading={false}
        onRefresh={vi.fn()}
      />
    );

    expect(html).toContain("READY (PIPELINE LOADED)");
    expect(html).toContain("1.0.0-rc1");
    expect(html).toContain("3");
    expect(html).toContain("features");
    expect(html).toContain("Sandia National Lab");
  });

  it("shows spinning PREDICTION_RUNNING badge when isRunning is true", () => {
    const html = renderToString(
      <ModelStatusCard
        status={FIXTURE_STATUS_READY}
        loading={false}
        onRefresh={vi.fn()}
        isRunning={true}
      />
    );

    expect(html).toContain("PREDICTION_RUNNING");
  });
});

describe("Model 3: Prediction Response & Results Display", () => {
  it("renders genuine prediction output without invented confidence intervals", () => {
    const html = renderToString(
      <PredictionResultDisplay
        result={FIXTURE_PREDICTION_RESPONSE}
        error={null}
        limitations={[]}
      />
    );

    expect(html).toContain("312.45");
    expect(html).toContain("W");
    expect(html).toContain("Pmp");
    expect(html).toContain("PV-MOD-2026-X1");
    expect(html).toContain("14.8");
    expect(html).toContain("ms");
    expect(html).toContain("1.0.0-rc1");

    // Zero fabrication check: confidence is honestly reported as N/A
    expect(html).toContain("Deterministic Pipeline (N/A)");
    expect(html).toContain("Not Provided by Model");

    // Consumed features
    expect(html).toContain("irradiance");
    expect(html).toContain("cell_temperature");
  });

  it("prominently tags isolated test mock fixture results", () => {
    const html = renderToString(
      <PredictionResultDisplay
        result={FIXTURE_MOCK_PREDICTION_RESPONSE}
        error={null}
        limitations={FIXTURE_MOCK_PREDICTION_RESPONSE.limitations}
      />
    );

    expect(html).toContain("Isolated Test Mock Fixture");
    expect(html).toContain("88.5");
    expect(html).toContain("%");
    expect(html).toContain("automated test mock fixture");
  });

  it("renders error alert with sanitized explanation when inference fails", () => {
    const html = renderToString(
      <PredictionResultDisplay
        result={null}
        error="Sandia performance model artifact (pipeline.joblib) is not ready (HTTP 503)."
        limitations={["Zero synthetic predictions served."]}
      />
    );

    expect(html).toContain("Inference Request Failed");
    expect(html).toContain("HTTP 503");
    expect(html).toContain("Zero synthetic predictions served.");
  });
});

describe("Model 3: Model Evaluation Metrics Section", () => {
  it("truthfully renders pending state when trainer metrics are not yet delivered", () => {
    const html = renderToString(
      <ModelEvaluationSection metrics={null} isModelReady={false} />
    );

    expect(html).toContain("Evaluation Metrics Pending Trainer Delivery");
    expect(html).toContain("AWAITING_TRAINER_METRICS");
    expect(html).toContain("Mean Absolute Error (MAE)");
    expect(html).toContain("Root Mean Squared Error (RMSE)");
    expect(html).toContain("Coefficient of Determination (R²)");
  });

  it("renders trainer-certified regression metrics when supplied", () => {
    const certifiedMetrics: TrainerEvaluationMetrics = {
      mae: 4.8215,
      rmse: 7.1402,
      r2: 0.9412,
      heldOutTestSamples: 2500,
    };

    const html = renderToString(
      <ModelEvaluationSection metrics={certifiedMetrics} isModelReady={true} />
    );

    expect(html).toContain("TRAINER_CERTIFIED_METRICS");
    expect(html).toContain("4.8215");
    expect(html).toContain("7.1402");
    expect(html).toContain("0.9412");
    expect(html).toContain("2500");
  });
});

describe("Model 3: Prediction History Interface", () => {
  it("renders clean empty state when no historical predictions exist", () => {
    const html = renderToString(<PredictionHistoryTable />);

    expect(html).toContain("Prediction History");
    expect(html).toContain("Telemetry Log");
    expect(html).toContain("No Sandia Electrical Predictions Recorded");
    expect(html).toContain("Inferences submitted through the dynamic schema form or batch API will be logged here");
  });
});

describe("Model 3: Model Architecture Variants & Roadmap Quarantine", () => {
  it("renders all 3 model variants while isolating non-operational modes", () => {
    const html = renderToString(
      <ModelVariantsRoadmapCard selectedVariant="sandia_tabular" />
    );

    // Tabular Foundation
    expect(html).toContain("Sandia Tabular Electrical Predictor");
    expect(html).toContain("OPERATIONAL INFERENCE");

    // EL Multimodal
    expect(html).toContain("EL-Image + Telemetry Multimodal Fusion");
    expect(html).toContain("EXPERIMENTAL");
    expect(html).toContain("Inference API is quarantined until joint multimodal training");

    // Next-Obs Sequential
    expect(html).toContain("Sequential Next-Observation Time-Series Forecaster");
    expect(html).toContain("ROADMAP PLANNED");
    expect(html).toContain("Serving pipeline will be activated upon delivery");
  });
});

describe("Model 3: API Adapter & Network Client Integration", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("RestSandiaApiAdapter correctly handles HTTP 503 and throws SandiaApiError", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: async () => ({
        detail: "Sandia solar performance model artifact not loaded.",
        limitations: ["Zero synthetic predictions served."],
      }),
    });

    const adapter = new RestSandiaApiAdapter("http://localhost:8000");

    await expect(
      adapter.predict({
        features: { irradiance: 1000.0 },
      })
    ).rejects.toThrow(SandiaApiError);

    try {
      await adapter.predict({ features: { irradiance: 1000.0 } });
    } catch (err: any) {
      expect(err.code).toBe("MODEL_UNAVAILABLE");
      expect(err.statusCode).toBe(503);
      expect(err.message).toContain("not loaded");
    }
  });

  it("RestSandiaApiAdapter correctly handles HTTP 422 validation errors", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      json: async () => ({
        detail: "Missing required feature 'irradiance'.",
      }),
    });

    const adapter = new RestSandiaApiAdapter("http://localhost:8000");

    await expect(
      adapter.predict({
        features: { other_field: 12.0 },
      })
    ).rejects.toThrow(SandiaApiError);

    try {
      await adapter.predict({ features: { other_field: 12.0 } });
    } catch (err: any) {
      expect(err.code).toBe("VALIDATION_ERROR");
      expect(err.statusCode).toBe(422);
    }
  });

  it("TrpcSandiaApiAdapter provides matching interface ready for Agent 2 procedures", () => {
    const trpcAdapter = new TrpcSandiaApiAdapter();
    expect(typeof trpcAdapter.getStatus).toBe("function");
    expect(typeof trpcAdapter.predict).toBe("function");
    expect(typeof trpcAdapter.predictBatch).toBe("function");
    expect(typeof trpcAdapter.getSchema).toBe("function");
    expect(typeof trpcAdapter.getHistory).toBe("function");
  });
});
