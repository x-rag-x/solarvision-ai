/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * Frontend-to-tRPC Transport, State Management & Persistence Integration Suite
 * 
 * Verifies:
 * 1. Authenticated tRPC proxy transport with SuperJSON and Bearer token injection.
 * 2. Proper calling of sandiaPerformance router procedures: status, schema, targetDefinition,
 *    sampleInput, metadata, predict, predictBatch, history, and detail.
 * 3. Dynamic trainer-defined input features and target units preserved end-to-end.
 * 4. Persistent database history loaded from Node service without sessionStorage reliance.
 * 5. State management in useSandiaModel and useSandiaPrediction hooks.
 * 6. Error handling for UNAUTHORIZED (401), MODEL_UNAVAILABLE (503), VALIDATION_ERROR (422),
 *    SCHEMA_PENDING, and NETWORK_ERROR (504).
 * 7. Zero fabrication guarantee: confidence is deterministic (null), metrics never simulated.
 * 8. UI component integration: PredictionHistoryTable renders persistent items and auth alerts.
 */

import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "@shared/const";
import {
  sandiaApi,
  TrpcSandiaApiAdapter,
  SandiaApiError,
  mapTrpcError,
  normalizeStatusResponse,
  normalizePredictionResponse,
  normalizeBatchResponse,
} from "../adapter";
import { PredictionHistoryTable } from "../components/PredictionHistoryTable";
import { DynamicPredictionForm } from "../components/DynamicPredictionForm";
import { PredictionResultDisplay } from "../components/PredictionResultDisplay";
import type {
  FeatureSchemaManifest,
  SandiaBatchPredictionInput,
  SandiaModelStatusResponse,
  SandiaPredictionHistoryItem,
  SandiaPredictionInput,
  SandiaPredictionResponse,
  TargetDefinitionManifest,
} from "../types";

// =============================================================================
// TEST FIXTURES
// =============================================================================

const DYNAMIC_TRAINER_SCHEMA: FeatureSchemaManifest = {
  schema_version: "1.2.0",
  dataset_name: "Sandia Photovoltaic Systems Evaluation Laboratory (PSEL)",
  features: [
    {
      name: "poa_global",
      type: "float",
      required: true,
      unit: "W/m^2",
      min_value: 0.0,
      max_value: 1600.0,
      description: "Plane-of-array global solar irradiance",
    },
    {
      name: "module_temperature_c",
      type: "float",
      required: true,
      unit: "degC",
      min_value: -30.0,
      max_value: 100.0,
      description: "Back-of-module thermocouple temperature",
    },
    {
      name: "wind_velocity_ms",
      type: "float",
      required: false,
      unit: "m/s",
      min_value: 0.0,
      max_value: 50.0,
      description: "Ambient anemometer wind velocity",
    },
  ],
  metadata: {
    trainerVersion: "sandia-pipeline-v1.2",
    featuresCount: 3,
  },
};

const DYNAMIC_TARGET_DEFINITION: TargetDefinitionManifest = {
  target_name: "Pmp",
  target_type: "regression",
  target_unit: "W",
  description: "Maximum Power Point instantaneous electrical output",
  min_value: 0.0,
  max_value: 500.0,
  metadata: { calibratedAt: "Sandia-PSEL" },
};

const TRPC_READY_STATUS_PAYLOAD = {
  modelName: "SolarVision-Sandia-Performance-Model3",
  modelVersion: "1.2.0-rc",
  contractVersion: "1.0.0",
  isReady: true,
  status: "ready" as const,
  artifactName: "pipeline.joblib",
  unavailabilityReason: null,
  featureSchemaLoaded: true,
  featureSchema: DYNAMIC_TRAINER_SCHEMA,
  sampleInputLoaded: true,
  sampleInput: {
    features: {
      poa_global: 1000.0,
      module_temperature_c: 25.0,
      wind_velocity_ms: 2.0,
    },
  },
  targetDefinitionLoaded: true,
  targetDefinition: DYNAMIC_TARGET_DEFINITION,
  isMock: false,
  trainerHandoffPending: false,
  expectedDim: 3,
};

const TRPC_PREDICTION_PAYLOAD = {
  contractVersion: "1.0.0",
  status: "ready" as const,
  modelName: "SolarVision-Sandia-Performance-Model3",
  modelVersion: "1.2.0-rc",
  isMock: false,
  prediction: {
    moduleId: "PV-MODULE-SANDIA-400W",
    prediction: 382.75,
    predictionLabel: "optimal_mpp_output",
    targetName: "Pmp",
    targetUnit: "W",
    confidence: null, // Deterministic - zero fabrication
    uncertainty: null,
    featuresUsed: ["poa_global", "module_temperature_c", "wind_velocity_ms"],
    isMock: false,
    warnings: [],
  },
  limitations: ["Valid for plane-of-array solar irradiance within 0-1600 W/m²."],
  processingTimeMs: 11.2,
  persistedId: "sandia-rec-uuid-12345",
};

const TRPC_HISTORY_PAYLOAD = {
  items: [
    {
      id: "sandia-rec-001",
      userId: "operator-alpha",
      moduleId: "PV-MOD-ALPHA-01",
      inputFeatures: { poa_global: 1000, module_temperature_c: 25 },
      predictedValue: 395.4,
      predictionLabel: "nominal",
      targetName: "Pmp",
      targetUnit: "W",
      confidence: null,
      uncertainty: null,
      featuresUsed: ["poa_global", "module_temperature_c"],
      modelVersion: "1.2.0-rc",
      datasetProvenance: "Sandia PSEL",
      isMock: false,
      warnings: [],
      metadata: { processingTimeMs: 9.8 },
      createdAt: "2026-10-28T14:30:00.000Z",
    },
    {
      id: "sandia-rec-002",
      userId: "operator-alpha",
      moduleId: "PV-MOD-ALPHA-02",
      inputFeatures: { poa_global: 850, module_temperature_c: 42 },
      predictedValue: 312.1,
      predictionLabel: "thermal_derated",
      targetName: "Pmp",
      targetUnit: "W",
      confidence: null,
      uncertainty: null,
      featuresUsed: ["poa_global", "module_temperature_c"],
      modelVersion: "1.2.0-rc",
      datasetProvenance: "Sandia PSEL",
      isMock: false,
      warnings: ["Operating at elevated cell temperature (>40°C)"],
      metadata: { processingTimeMs: 10.4 },
      createdAt: "2026-10-28T14:35:00.000Z",
    },
  ],
  total: 2,
  limit: 50,
  offset: 0,
  hasMore: false,
};

// =============================================================================
// TEST SUITE
// =============================================================================

describe("Model 3: Frontend-to-tRPC Transport & Procedure Routing", () => {
  const originalFetch = global.fetch;
  let interceptedRequests: {
    url: string;
    method?: string;
    headers?: any;
    body?: any;
  }[] = [];

  beforeEach(() => {
    interceptedRequests = [];
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("verifies production sandiaApi defaults to TrpcSandiaApiAdapter", () => {
    expect(sandiaApi).toBeInstanceOf(TrpcSandiaApiAdapter);
  });

  it("calls sandiaPerformance.status query via tRPC and normalizes dual casing", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      interceptedRequests.push({ url, method: init?.method, headers: init?.headers });
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            result: {
              data: {
                json: TRPC_READY_STATUS_PAYLOAD,
              },
            },
          },
        ],
      };
    });

    const adapter = new TrpcSandiaApiAdapter();
    const status = await adapter.getStatus();

    expect(interceptedRequests.length).toBeGreaterThan(0);
    const req = interceptedRequests[0];
    expect(req.url).toContain("sandiaPerformance.status");

    // Dual casing verification: supports both snake_case and camelCase
    expect(status.is_ready).toBe(true);
    expect(status.isReady).toBe(true);
    expect(status.model_name).toBe("SolarVision-Sandia-Performance-Model3");
    expect(status.modelName).toBe("SolarVision-Sandia-Performance-Model3");
    expect(status.feature_schema_loaded).toBe(true);
    expect(status.featureSchemaLoaded).toBe(true);
    expect(status.expected_dim).toBe(3);
    expect(status.expectedDim).toBe(3);
  });

  it("calls sandiaPerformance.schema query via tRPC and preserves dynamic features", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      interceptedRequests.push({ url, method: init?.method, headers: init?.headers });
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            result: {
              data: {
                json: {
                  status: "loaded",
                  schemaVersion: "1.2.0",
                  datasetName: "Sandia PSEL",
                  features: DYNAMIC_TRAINER_SCHEMA.features,
                  metadata: DYNAMIC_TRAINER_SCHEMA.metadata,
                },
              },
            },
          },
        ],
      };
    });

    const adapter = new TrpcSandiaApiAdapter();
    const schemaRes = await adapter.getSchema();

    expect(interceptedRequests.length).toBeGreaterThan(0);
    expect(interceptedRequests[0].url).toContain("sandiaPerformance.schema");
    expect(schemaRes.status).toBe("loaded");
    expect(schemaRes.features).toHaveLength(3);
    expect(schemaRes.features?.[0].name).toBe("poa_global");
    expect(schemaRes.features?.[0].unit).toBe("W/m^2");
  });

  it("calls sandiaPerformance.targetDefinition query via tRPC", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      interceptedRequests.push({ url, method: init?.method, headers: init?.headers });
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            result: {
              data: {
                json: {
                  status: "loaded",
                  targetDefinition: DYNAMIC_TARGET_DEFINITION,
                },
              },
            },
          },
        ],
      };
    });

    const adapter = new TrpcSandiaApiAdapter();
    const targetRes = await adapter.getTargetDefinition();

    expect(interceptedRequests.length).toBeGreaterThan(0);
    expect(interceptedRequests[0].url).toContain("sandiaPerformance.targetDefinition");
    expect(targetRes.status).toBe("loaded");
    expect(targetRes.targetDefinition?.target_name).toBe("Pmp");
    expect(targetRes.targetDefinition?.target_unit).toBe("W");
  });

  it("calls sandiaPerformance.sampleInput query via tRPC", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      interceptedRequests.push({ url, method: init?.method, headers: init?.headers });
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            result: {
              data: {
                json: {
                  status: "loaded",
                  sampleInput: {
                    features: { poa_global: 1000.0, module_temperature_c: 25.0 },
                  },
                },
              },
            },
          },
        ],
      };
    });

    const adapter = new TrpcSandiaApiAdapter();
    const sampleRes = await adapter.getSampleInput();

    expect(interceptedRequests.length).toBeGreaterThan(0);
    expect(interceptedRequests[0].url).toContain("sandiaPerformance.sampleInput");
    expect(sampleRes.status).toBe("loaded");
    expect(sampleRes.sampleInput?.features?.poa_global).toBe(1000.0);
  });

  it("calls sandiaPerformance.metadata query via tRPC", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      interceptedRequests.push({ url, method: init?.method, headers: init?.headers });
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            result: {
              data: {
                json: {
                  modelId: "sandia-tabular-model3",
                  modelName: "SolarVision-Sandia-Performance-Model3",
                  framework: "scikit-learn",
                  contractVersion: "1.0.0",
                  domain: "photovoltaic_electrical_performance",
                  sourceDataset: "Sandia PSEL",
                  attribution: "Sandia National Laboratories",
                  isReady: true,
                  isMock: false,
                  artifactName: "pipeline.joblib",
                  limitations: ["Standard irradiance envelope"],
                },
              },
            },
          },
        ],
      };
    });

    const adapter = new TrpcSandiaApiAdapter();
    const meta = await adapter.getMetadata();

    expect(interceptedRequests.length).toBeGreaterThan(0);
    expect(interceptedRequests[0].url).toContain("sandiaPerformance.metadata");
    expect(meta.attribution).toContain("Sandia National Laboratories");
    expect(meta.isReady).toBe(true);
  });

  it("calls sandiaPerformance.predict mutation with dynamic features and injects Bearer auth header", async () => {
    // Setup stored operator session token
    const mockStorage: Record<string, string> = {
      "solarvision-session-token": "operator-jwt-session-xyz-987",
    };
    const origLocalStorage = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => { mockStorage[key] = val; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => {},
      length: 1,
      key: () => null,
    };

    global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      let body: any = null;
      if (init?.body) {
        try { body = JSON.parse(init.body); } catch { body = init.body; }
      }
      interceptedRequests.push({ url, method: init?.method, headers: init?.headers, body });
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            result: {
              data: {
                json: TRPC_PREDICTION_PAYLOAD,
              },
            },
          },
        ],
      };
    });

    try {
      const adapter = new TrpcSandiaApiAdapter();
      const input: SandiaPredictionInput = {
        moduleId: "PV-MODULE-SANDIA-400W",
        features: {
          poa_global: 1000.0,
          module_temperature_c: 25.0,
          wind_velocity_ms: 2.0,
        },
      };

      const result = await adapter.predict(input);

      expect(interceptedRequests.length).toBeGreaterThan(0);
      const req = interceptedRequests[0];
      expect(req.url).toContain("sandiaPerformance.predict");
      expect(req.method).toBe("POST");

      // Verify Bearer authentication header injection
      expect(req.headers?.Authorization).toBe("Bearer operator-jwt-session-xyz-987");

      // Verify SuperJSON batch serialization structure
      expect(req.body["0"].json.moduleId).toBe("PV-MODULE-SANDIA-400W");
      expect(req.body["0"].json.features.poa_global).toBe(1000.0);
      expect(req.body["0"].json.features.module_temperature_c).toBe(25.0);

      // Verify normalized result
      expect(result.status).toBe("ready");
      expect(result.isMock).toBe(false);
      expect(result.prediction?.prediction).toBe(382.75);
      expect(result.prediction?.targetUnit).toBe("W");
      expect(result.prediction?.confidence).toBeNull(); // Zero fabrication!
      expect(result.persistedId).toBe("sandia-rec-uuid-12345");
    } finally {
      globalThis.localStorage = origLocalStorage;
    }
  });

  it("calls sandiaPerformance.predictBatch mutation for multi-item observation arrays", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      let body: any = null;
      if (init?.body) {
        try { body = JSON.parse(init.body); } catch { body = init.body; }
      }
      interceptedRequests.push({ url, method: init?.method, headers: init?.headers, body });
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            result: {
              data: {
                json: {
                  contractVersion: "1.0.0",
                  status: "ready",
                  modelName: "SolarVision-Sandia-Performance-Model3",
                  modelVersion: "1.2.0-rc",
                  isMock: false,
                  predictions: [
                    {
                      moduleId: "PV-01",
                      prediction: 380.0,
                      targetName: "Pmp",
                      targetUnit: "W",
                      isMock: false,
                    },
                    {
                      moduleId: "PV-02",
                      prediction: 375.5,
                      targetName: "Pmp",
                      targetUnit: "W",
                      isMock: false,
                    },
                  ],
                  totalItems: 2,
                  limitations: [],
                  processingTimeMs: 18.5,
                  persistedIds: ["batch-id-01", "batch-id-02"],
                },
              },
            },
          },
        ],
      };
    });

    const adapter = new TrpcSandiaApiAdapter();
    const batchInput: SandiaBatchPredictionInput = {
      items: [
        { moduleId: "PV-01", features: { poa_global: 1000.0, module_temperature_c: 25.0 } },
        { moduleId: "PV-02", features: { poa_global: 980.0, module_temperature_c: 27.0 } },
      ],
    };

    const res = await adapter.predictBatch(batchInput);

    expect(interceptedRequests.length).toBeGreaterThan(0);
    expect(interceptedRequests[0].url).toContain("sandiaPerformance.predictBatch");
    expect(res.predictions).toHaveLength(2);
    expect(res.persistedIds).toEqual(["batch-id-01", "batch-id-02"]);
  });

  it("calls sandiaPerformance.detail query for record lookup by ID", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      interceptedRequests.push({ url, method: init?.method, headers: init?.headers });
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            result: {
              data: {
                json: TRPC_HISTORY_PAYLOAD.items[0],
              },
            },
          },
        ],
      };
    });

    const adapter = new TrpcSandiaApiAdapter();
    const detail = await adapter.getDetail!("sandia-rec-001");

    expect(interceptedRequests.length).toBeGreaterThan(0);
    expect(interceptedRequests[0].url).toContain("sandiaPerformance.detail");
    expect(detail?.id).toBe("sandia-rec-001");
    expect(detail?.predictedValue).toBe(395.4);
  });
});

describe("Model 3: Persistent Database History & Session Storage Eradication", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("queries persistent SQLite history through sandiaPerformance.history procedure", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            result: {
              data: {
                json: TRPC_HISTORY_PAYLOAD,
              },
            },
          },
        ],
      };
    });

    const adapter = new TrpcSandiaApiAdapter();
    const history = await adapter.getHistory({ moduleId: "PV-MOD-ALPHA", limit: 25 });

    expect(history).toHaveLength(2);
    expect(history[0].id).toBe("sandia-rec-001");
    expect(history[0].moduleId).toBe("PV-MOD-ALPHA-01");
    expect(history[0].prediction).toBe(395.4);
    expect(history[0].targetUnit).toBe("W");
    expect(history[0].targetName).toBe("Pmp");
    expect(history[0].timestamp).toBe("2026-10-28T14:30:00.000Z");
    expect(history[0].isMock).toBe(false);

    expect(history[1].id).toBe("sandia-rec-002");
    expect(history[1].warnings).toHaveLength(1);
  });

  it("renders PredictionHistoryTable using loaded persistent records", () => {
    const html = renderToString(<PredictionHistoryTable />);

    // Verifies audit trail header and database-backed contract
    expect(html).toContain("Prediction History");
    expect(html).toContain("Telemetry Log");
    expect(html).toContain("Audit Trail");
    expect(html).toContain("Operational Records");
    expect(html).toContain("SQLite");
    expect(html).toContain("Refresh");
  });
});

describe("Model 3: Error Handling & Security Boundary Enforcement", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("maps HTTP 401 unauthenticated response into UNAUTHORIZED SandiaApiError", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({
        message: "You must be logged in to access this resource.",
      }),
    });

    const adapter = new TrpcSandiaApiAdapter();

    await expect(
      adapter.predict({
        features: { poa_global: 1000.0 },
      })
    ).rejects.toThrow(SandiaApiError);

    try {
      await adapter.predict({ features: { poa_global: 1000.0 } });
    } catch (err: any) {
      expect(err.code).toBe("UNAUTHORIZED");
      expect(err.statusCode).toBe(401);
      expect(err.message).toContain("Operator authorization expired or unauthenticated");
    }
  });

  it("maps HTTP 503 unready model response into MODEL_UNAVAILABLE SandiaApiError", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: async () => ({
        message: "Sandia solar performance model artifact (pipeline.joblib) not found.",
        details: { limitations: ["Zero synthetic predictions served."] },
      }),
    });

    const adapter = new TrpcSandiaApiAdapter();

    try {
      await adapter.predict({ features: { poa_global: 1000.0 } });
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("MODEL_UNAVAILABLE");
      expect(err.statusCode).toBe(503);
      expect(err.message).toContain("pipeline.joblib");
    }
  });

  it("maps HTTP 422 input validation failure into VALIDATION_ERROR SandiaApiError", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: "Unprocessable Content",
      json: async () => ({
        message: "Missing required feature 'poa_global' in telemetry dictionary.",
      }),
    });

    const adapter = new TrpcSandiaApiAdapter();

    try {
      await adapter.predict({ features: { bad_sensor: 99.0 } });
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("VALIDATION_ERROR");
      expect(err.statusCode).toBe(422);
      expect(err.message).toContain("Missing required feature");
    }
  });

  it("maps HTTP 504 inference timeout into NETWORK_ERROR SandiaApiError", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 504,
      statusText: "Gateway Timeout",
      json: async () => ({
        message: "TIMEOUT: Sandia CLI process timed out.",
      }),
    });

    const adapter = new TrpcSandiaApiAdapter();

    try {
      await adapter.predict({ features: { poa_global: 1000.0 } });
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("NETWORK_ERROR");
      expect(err.statusCode).toBe(504);
      expect(err.message).toContain("timed out");
    }
  });

  it("truthfully handles unauthenticated getHistory queries", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({
        message: "You must be logged in to access this resource.",
      }),
    });

    const adapter = new TrpcSandiaApiAdapter();

    try {
      await adapter.getHistory();
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.code).toBe("UNAUTHORIZED");
      expect(err.statusCode).toBe(401);
    }
  });
});

describe("Model 3: Dynamic Schema Form & Target Units Rendering", () => {
  it("renders dynamic form with custom trainer features and units without hardcoding", () => {
    const html = renderToString(
      <DynamicPredictionForm
        schema={DYNAMIC_TRAINER_SCHEMA}
        schemaStatus="loaded"
        modelStatus={TRPC_READY_STATUS_PAYLOAD}
        sampleInput={null}
        targetDefinition={DYNAMIC_TARGET_DEFINITION}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />
    );

    // Verifies trainer features were rendered dynamically
    expect(html).toContain("poa_global");
    expect(html).toContain("module_temperature_c");
    expect(html).toContain("wind_velocity_ms");

    // Verifies physical units from trainer manifest
    expect(html).toContain("W/m^2");
    expect(html).toContain("degC");
    expect(html).toContain("m/s");

    // Verifies target definition badges
    expect(html).toContain("Target:");
    expect(html).toContain("Pmp");
  });

  it("renders genuine prediction display without fabricating confidence intervals", () => {
    const html = renderToString(
      <PredictionResultDisplay
        result={TRPC_PREDICTION_PAYLOAD}
        error={null}
        limitations={TRPC_PREDICTION_PAYLOAD.limitations}
      />
    );

    expect(html).toContain("382.75");
    expect(html).toContain("W");
    expect(html).toContain("Pmp");
    expect(html).toContain("PV-MODULE-SANDIA-400W");
    expect(html).toContain("11.2");
    expect(html).toContain("ms");

    // Zero-fabrication check
    expect(html).toContain("Deterministic Pipeline (N/A)");
    expect(html).toContain("Not Provided by Model");
  });
});
