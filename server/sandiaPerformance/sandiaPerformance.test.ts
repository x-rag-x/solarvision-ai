/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * Comprehensive Unit, Integration, Persistence, Security & Regression Test Suite
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";
import { TRPCError } from "@trpc/server";

const require = createRequire(import.meta.url);
const { DatabaseSync: DatabaseSyncConstructor } = require("node:sqlite") as {
  DatabaseSync: typeof DatabaseSync;
};
import axios from "axios";
import {
  SandiaApiClient,
  SandiaApiError,
  sanitizeErrorMessage,
} from "./apiClient";
import {
  SandiaPersistenceRepository,
  ensureSandiaPerformanceSchema,
} from "./persistence";
import { SandiaPerformanceService } from "./service";
import { sandiaPerformanceRouter } from "./routerHandler";
import { appRouter } from "../routers";
import {
  SANDIA_CONTRACT_VERSION,
  type SandiaModelStatusResponse,
  type SandiaPredictionResponse,
  type SandiaBatchPredictionResponse,
} from "./types";

describe("Model 3: Sandia Solar Electrical Performance Prediction Suite", () => {
  let memoryDb: DatabaseSync;
  let repo: SandiaPersistenceRepository;

  beforeEach(() => {
    memoryDb = new DatabaseSyncConstructor(":memory:");
    ensureSandiaPerformanceSchema(memoryDb);
    repo = new SandiaPersistenceRepository(memoryDb);
  });

  afterEach(() => {
    try {
      memoryDb.close();
    } catch {
      // ignore
    }
  });

  describe("1. Error Sanitization & Path Neutralization (Task 7)", () => {
    it("sanitizes Windows absolute drive paths from error messages", () => {
      const raw =
        "File not found at D:\\Apps\\Programs\\SolarVisionAI\\backend\\models\\sandia\\pipeline.joblib";
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain("D:\\");
      expect(sanitized).not.toContain("SolarVisionAI");
      expect(sanitized).toContain("[internal_path]");
    });

    it("sanitizes POSIX absolute directory paths from error messages", () => {
      const raw =
        "Crash in /home/runner/work/solarvision/backend/app/sandia_performance/model_loader.py: line 42";
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain("/home/runner");
      expect(sanitized).not.toContain("model_loader.py");
      expect(sanitized).toContain("[internal_path]");
    });

    it("preserves safe error messages without filesystem references", () => {
      const safe =
        "Missing required feature: effective_irradiance; cell_temperature must be <= 100.0";
      expect(sanitizeErrorMessage(safe)).toBe(safe);
    });

    it("handles null, undefined or empty error strings safely", () => {
      expect(sanitizeErrorMessage("")).toBe(
        "An unknown error occurred during inference."
      );
      expect(sanitizeErrorMessage(null as any)).toBe(
        "An unknown error occurred during inference."
      );
    });
  });

  describe("2. Database Persistence & Zero-Fabrication Guarantees (Tasks 5 & 8)", () => {
    it("persists successful real predictions with all required contract fields", () => {
      const record = repo.savePrediction({
        userId: "operator-001",
        moduleId: "PV-MOD-SANDIA-2026-X1",
        inputFeatures: {
          effective_irradiance: 980.5,
          cell_temperature_c: 45.2,
          wind_speed_m_s: 2.1,
          ambient_temperature_c: 28.0,
        },
        predictedValue: 285.74,
        predictionLabel: "optimal_performance",
        targetName: "maximum_power_w",
        targetUnit: "W",
        confidence: 0.96,
        uncertainty: 2.1,
        featuresUsed: [
          "effective_irradiance",
          "cell_temperature_c",
          "wind_speed_m_s",
          "ambient_temperature_c",
        ],
        modelVersion: "1.0.0",
        datasetProvenance:
          "Sandia National Laboratories PV Performance Modeling Telemetry",
        isMock: false,
        warnings: [],
        metadata: { inverterType: "string_inverter", rackAngleDeg: 30 },
      });

      expect(record.id).toBeDefined();
      expect(record.userId).toBe("operator-001");
      expect(record.moduleId).toBe("PV-MOD-SANDIA-2026-X1");
      expect(record.predictedValue).toBe(285.74);
      expect(record.targetName).toBe("maximum_power_w");
      expect(record.targetUnit).toBe("W");
      expect(record.inputFeatures.effective_irradiance).toBe(980.5);
      expect(record.featuresUsed).toContain("effective_irradiance");
      expect(record.isMock).toBe(false);

      // Verify retrieval by ID
      const retrieved = repo.getPredictionById(record.id, {
        userId: "operator-001",
        role: "user",
      });
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(record.id);
      expect(retrieved?.predictedValue).toBe(285.74);
      expect(retrieved?.targetName).toBe("maximum_power_w");
    });

    it("strictly refuses to persist mock predictions to the database (Task 8)", () => {
      expect(() => {
        repo.savePrediction({
          userId: "operator-001",
          moduleId: "PV-MOCK-001",
          inputFeatures: { irradiance: 1000 },
          predictedValue: 100.0,
          targetName: "mock_metric",
          targetUnit: "%",
          modelVersion: "none",
          datasetProvenance:
            "Sandia National Laboratories PV Performance Modeling Telemetry",
          isMock: true, // Mock fixture!
        });
      }).toThrow(/Zero-Fabrication Violation/);
    });

    it("rejects persistence when input features or predicted value are invalid", () => {
      expect(() => {
        repo.savePrediction({
          userId: "operator-001",
          moduleId: "PV-001",
          inputFeatures: {}, // Empty!
          predictedValue: 100.0,
          targetName: "metric",
          modelVersion: "1.0.0",
          datasetProvenance: "Sandia",
        });
      }).toThrow(/Validation Error/);

      expect(() => {
        repo.savePrediction({
          userId: "operator-001",
          moduleId: "PV-001",
          inputFeatures: { irradiance: 1000 },
          predictedValue: NaN, // Invalid!
          targetName: "metric",
          modelVersion: "1.0.0",
          datasetProvenance: "Sandia",
        });
      }).toThrow(/Validation Error/);
    });
  });

  describe("3. Multi-Tenant Authorization & Paginated Prediction History (Task 6)", () => {
    beforeEach(() => {
      // Seed predictions for two distinct operators
      repo.savePrediction({
        userId: "operator-alice",
        moduleId: "MOD-A-01",
        inputFeatures: { irradiance: 800 },
        predictedValue: 240.0,
        targetName: "power_w",
        targetUnit: "W",
        modelVersion: "1.0.0",
        datasetProvenance: "Sandia",
      });

      repo.savePrediction({
        userId: "operator-alice",
        moduleId: "MOD-A-02",
        inputFeatures: { irradiance: 850 },
        predictedValue: 255.0,
        targetName: "power_w",
        targetUnit: "W",
        modelVersion: "1.0.0",
        datasetProvenance: "Sandia",
      });

      repo.savePrediction({
        userId: "operator-bob",
        moduleId: "MOD-B-01",
        inputFeatures: { irradiance: 900 },
        predictedValue: 270.0,
        targetName: "power_w",
        targetUnit: "W",
        modelVersion: "1.0.0",
        datasetProvenance: "Sandia",
      });
    });

    it("isolates prediction history by user for standard operators", () => {
      const aliceHistory = repo.getPredictionHistory(
        { limit: 10, offset: 0 },
        { userId: "operator-alice", role: "user" }
      );
      expect(aliceHistory.total).toBe(2);
      expect(aliceHistory.items.length).toBe(2);
      expect(
        aliceHistory.items.every(it => it.userId === "operator-alice")
      ).toBe(true);

      const bobHistory = repo.getPredictionHistory(
        { limit: 10, offset: 0 },
        { userId: "operator-bob", role: "user" }
      );
      expect(bobHistory.total).toBe(1);
      expect(bobHistory.items[0].userId).toBe("operator-bob");
      expect(bobHistory.items[0].moduleId).toBe("MOD-B-01");
    });

    it("allows administrators to view predictions across all operators", () => {
      const adminHistory = repo.getPredictionHistory(
        { limit: 10, offset: 0 },
        { userId: "admin-user", role: "admin" }
      );
      expect(adminHistory.total).toBe(3);
      expect(adminHistory.items.length).toBe(3);
    });

    it("supports pagination with limit, offset, and hasMore flags", () => {
      const page1 = repo.getPredictionHistory(
        { limit: 1, offset: 0 },
        { userId: "operator-alice", role: "user" }
      );
      expect(page1.items.length).toBe(1);
      expect(page1.total).toBe(2);
      expect(page1.hasMore).toBe(true);

      const page2 = repo.getPredictionHistory(
        { limit: 1, offset: 1 },
        { userId: "operator-alice", role: "user" }
      );
      expect(page2.items.length).toBe(1);
      expect(page2.total).toBe(2);
      expect(page2.hasMore).toBe(false);
    });

    it("prevents an operator from accessing another operator's prediction by ID", () => {
      const bobHistory = repo.getPredictionHistory(
        {},
        { userId: "operator-bob", role: "user" }
      );
      const bobRecordId = bobHistory.items[0].id;

      // Alice tries to retrieve Bob's prediction
      const unauthorizedAccess = repo.getPredictionById(bobRecordId, {
        userId: "operator-alice",
        role: "user",
      });
      expect(unauthorizedAccess).toBeNull();

      // Bob can access his own prediction
      const authorizedAccess = repo.getPredictionById(bobRecordId, {
        userId: "operator-bob",
        role: "user",
      });
      expect(authorizedAccess).not.toBeNull();
      expect(authorizedAccess?.id).toBe(bobRecordId);

      // Admin can access Bob's prediction
      const adminAccess = repo.getPredictionById(bobRecordId, {
        userId: "admin-root",
        role: "admin",
      });
      expect(adminAccess).not.toBeNull();
      expect(adminAccess?.id).toBe(bobRecordId);
    });
  });

  describe("4. Dynamic Feature Names & Target Units (Task 4)", () => {
    it("handles dynamically supplied feature names and arbitrary sensor dimensions", async () => {
      const mockAxiosInstance: any = {
        get: vi.fn(),
        post: vi.fn(),
      };

      const customTargetDefinition = {
        target_name: "power_retention_pct",
        target_type: "regression",
        target_unit: "%",
        description: "Relative electrical performance retention percentage",
      };

      mockAxiosInstance.get.mockImplementation(async (url: string) => {
        if (url.includes("target-definition")) {
          return { data: customTargetDefinition };
        }
        return { data: {} };
      });

      mockAxiosInstance.post.mockImplementation(
        async (url: string, payload: any) => {
          return {
            data: {
              contract_version: "1.0.0",
              status: "ready",
              model_name: "SolarVision-Sandia-Performance-Model3",
              model_version: "2.1.0",
              is_mock: false,
              prediction: {
                module_id: payload.module_id,
                prediction: 94.85,
                target_name: customTargetDefinition.target_name,
                target_unit: customTargetDefinition.target_unit,
                confidence: 0.95,
                features_used: Object.keys(payload.features),
                is_mock: false,
                warnings: [],
              },
              limitations: [],
              processing_time_ms: 8.5,
            },
          };
        }
      );

      const client = new SandiaApiClient({ customAxios: mockAxiosInstance });
      const service = new SandiaPerformanceService(client, repo);

      const dynamicInput = {
        moduleId: "CUSTOM-HJT-PANEL-99",
        features: {
          poa_direct_w_m2: 850.2,
          poa_diffuse_w_m2: 120.4,
          bifacial_back_irradiance_w_m2: 95.0,
          module_temp_front_c: 48.6,
          module_temp_back_c: 47.1,
          albedo: 0.22,
        },
      };

      const result = await service.predict(dynamicInput, {
        userId: "op-hjt",
        role: "user",
      });

      expect(result.status).toBe("ready");
      expect(result.prediction?.targetName).toBe("power_retention_pct");
      expect(result.prediction?.targetUnit).toBe("%");
      expect(result.prediction?.prediction).toBe(94.85);
      expect(result.prediction?.featuresUsed).toEqual(
        expect.arrayContaining(["bifacial_back_irradiance_w_m2", "albedo"])
      );
      expect(result.persistedId).toBeDefined();

      // Check record persisted in database has dynamic target and features
      const savedRecord = repo.getPredictionById(result.persistedId!, {
        userId: "op-hjt",
        role: "user",
      });
      expect(savedRecord?.targetName).toBe("power_retention_pct");
      expect(savedRecord?.targetUnit).toBe("%");
      expect(savedRecord?.predictedValue).toBe(94.85);
      expect(savedRecord?.inputFeatures).toHaveProperty(
        "bifacial_back_irradiance_w_m2",
        95.0
      );
    });
  });

  describe("5. FastAPI Endpoints Integration & Error Mapping (Tasks 2 & 7)", () => {
    it("handles HTTP 503 (model unready / artifact missing) cleanly without path exposure", async () => {
      const mockAxiosInstance: any = {
        post: vi.fn().mockRejectedValue({
          isAxiosError: true,
          message: "Request failed with status code 503",
          response: {
            status: 503,
            data: {
              detail:
                "Sandia solar performance model artifact not found at D:\\Apps\\Models\\sandia\\pipeline.joblib",
            },
          },
        }),
      };

      const client = new SandiaApiClient({ customAxios: mockAxiosInstance });

      const validPayload = {
        moduleId: "MOD-10085",
        features: {
          Total_Exposure: null,
          "Nameplate_Pmp_(W)": 270.0,
          "Nameplate_Isc_(A)": 9.18,
          "Nameplate_Voc_(V)": 38.4,
          "Nameplate_Imp_(A)": 8.7,
          "Nameplate_Vmp_(V)": 31.0,
          Make: "35",
          Model: "1",
          Cell_Wafer_Type: "mono-Si module",
        },
      };

      await expect(client.predict(validPayload)).rejects.toThrow(
        SandiaApiError
      );

      try {
        await client.predict(validPayload);
        expect.unreachable("Expected predict() to throw SandiaApiError");
      } catch (err: any) {
        expect(err.statusCode).toBe(503);
        expect(err.code).toBe("PRECONDITION_FAILED");
        expect(err.message).not.toContain("D:\\");
        expect(err.message).toContain("[internal_path]");
      }
    });

    it("handles HTTP 422 (validation error) cleanly", async () => {
      const mockAxiosInstance: any = {
        post: vi.fn().mockRejectedValue({
          isAxiosError: true,
          message: "Request failed with status code 422",
          response: {
            status: 422,
            data: {
              detail:
                "Validation error: Missing required feature 'cell_temperature_c'",
            },
          },
        }),
      };

      const client = new SandiaApiClient({ customAxios: mockAxiosInstance });

      await expect(
        client.predict({
          moduleId: "MOD-01",
          features: { irradiance: 1000 },
        })
      ).rejects.toThrow(SandiaApiError);

      try {
        await client.predict({
          moduleId: "MOD-01",
          features: { irradiance: 1000 },
        });
        expect.unreachable("Expected predict() to throw SandiaApiError");
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
        expect(err.code).toBe("BAD_REQUEST");
        expect(err.message).toContain("Missing required feature");
      }
    });

    it("handles network connection failure gracefully", async () => {
      const mockAxiosInstance: any = {
        post: vi.fn().mockRejectedValue({
          isAxiosError: true,
          code: "ECONNREFUSED",
          message: "connect ECONNREFUSED 127.0.0.1:8000",
        }),
      };

      const client = new SandiaApiClient({ customAxios: mockAxiosInstance });

      await expect(
        client.predict({
          moduleId: "MOD-01",
          features: { irradiance: 1000 },
        })
      ).rejects.toThrow(SandiaApiError);

      try {
        await client.predict({
          moduleId: "MOD-01",
          features: { irradiance: 1000 },
        });
        expect.unreachable("Expected predict() to throw SandiaApiError");
      } catch (err: any) {
        expect(err.statusCode).toBe(503);
        expect(err.code).toBe("SERVICE_UNAVAILABLE");
        expect(err.message).toContain("unreachable");
      }
    });

    it("handles request timeout gracefully", async () => {
      const mockAxiosInstance: any = {
        post: vi.fn().mockRejectedValue({
          isAxiosError: true,
          code: "ECONNABORTED",
          message: "timeout of 15000ms exceeded",
        }),
      };

      const client = new SandiaApiClient({ customAxios: mockAxiosInstance });

      await expect(
        client.predict({
          moduleId: "MOD-01",
          features: { irradiance: 1000 },
        })
      ).rejects.toThrow(SandiaApiError);

      try {
        await client.predict({
          moduleId: "MOD-01",
          features: { irradiance: 1000 },
        });
        expect.unreachable("Expected predict() to throw SandiaApiError");
      } catch (err: any) {
        expect(err.statusCode).toBe(504);
        expect(err.code).toBe("TIMEOUT");
        expect(err.message).toContain("timed out");
      }
    });

    it("regression: maps HTTP 503 and sanitizes internal paths even with schema-valid telemetry payload", async () => {
      const mockAxiosInstance: any = {
        post: vi.fn().mockRejectedValue({
          isAxiosError: true,
          message: "Request failed with status code 503",
          response: {
            status: 503,
            data: {
              detail:
                "Artifact missing at /backend/models/sandia/pipeline.joblib: model not trained",
            },
          },
        }),
      };

      const client = new SandiaApiClient({ customAxios: mockAxiosInstance });

      await expect(
        client.predict({
          moduleId: "MOD-REGRESSION-1",
          features: {
            Total_Exposure: null,
            "Nameplate_Pmp_(W)": 270.0,
            "Nameplate_Isc_(A)": 9.18,
            "Nameplate_Voc_(V)": 38.4,
            "Nameplate_Imp_(A)": 8.7,
            "Nameplate_Vmp_(V)": 31.0,
            Make: "35",
            Model: "1",
            Cell_Wafer_Type: "mono-Si module",
          },
        })
      ).rejects.toMatchObject({
        statusCode: 503,
        code: "PRECONDITION_FAILED",
      });
    });
  });

  describe("6. Batch Prediction & Batch Size Limits", () => {
    it("executes batch prediction and enforces batch limit of 100 items", async () => {
      const mockAxiosInstance: any = {
        post: vi.fn().mockResolvedValue({
          data: {
            contract_version: "1.0.0",
            status: "ready",
            model_name: "SolarVision-Sandia-Performance-Model3",
            model_version: "1.0.0",
            is_mock: false,
            predictions: [
              {
                module_id: "MOD-01",
                prediction: 280.0,
                target_name: "max_power_w",
                target_unit: "W",
                is_mock: false,
              },
              {
                module_id: "MOD-02",
                prediction: 285.5,
                target_name: "max_power_w",
                target_unit: "W",
                is_mock: false,
              },
            ],
            total_items: 2,
            limitations: [],
            processing_time_ms: 12.0,
          },
        }),
      };

      const client = new SandiaApiClient({ customAxios: mockAxiosInstance });
      const service = new SandiaPerformanceService(client, repo);

      const batchResult = await service.predictBatch(
        {
          items: [
            { moduleId: "MOD-01", features: { irradiance: 950 } },
            { moduleId: "MOD-02", features: { irradiance: 980 } },
          ],
        },
        { userId: "batch-operator", role: "user" }
      );

      expect(batchResult.status).toBe("ready");
      expect(batchResult.totalItems).toBe(2);
      expect(batchResult.persistedIds?.length).toBe(2);

      // Verify batch size overflow validation (> 100 items)
      const oversizedItems = Array.from({ length: 101 }, (_, i) => ({
        moduleId: `MOD-${i}`,
        features: { irradiance: 1000 },
      }));

      await expect(
        client.predictBatch({ items: oversizedItems })
      ).rejects.toThrow(/exceeds maximum limit of 100 items/);
    });
  });

  describe("7. tRPC Router Integration & Authorization (Task 3)", () => {
    it("rejects unauthenticated callers on predict, predictBatch, history, and detail", async () => {
      const caller = appRouter.createCaller({
        user: null,
        req: {} as any,
        res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
      });

      await expect(
        caller.sandiaPerformance.predict({
          moduleId: "MOD-01",
          features: { irradiance: 1000 },
        })
      ).rejects.toThrow(TRPCError);

      await expect(
        caller.sandiaPerformance.predictBatch({
          items: [{ moduleId: "MOD-01", features: { irradiance: 1000 } }],
        })
      ).rejects.toThrow(TRPCError);

      await expect(caller.sandiaPerformance.history({})).rejects.toThrow(
        TRPCError
      );

      await expect(
        caller.sandiaPerformance.detail({ id: "some-id" })
      ).rejects.toThrow(TRPCError);
    });

    it(
      "allows public querying of status, schema, target definition, sample input, and metadata",
      async () => {
        const caller = appRouter.createCaller({
          user: null,
          req: {} as any,
          res: {} as any,
        });

      // Status query
      const status = await caller.sandiaPerformance.status();
      expect(status).toHaveProperty("contractVersion", SANDIA_CONTRACT_VERSION);
      expect(status).toHaveProperty(
        "modelName",
        "SolarVision-Sandia-Performance-Model3"
      );
      expect(status).toHaveProperty("isReady");

      // Schema query
      const schema = await caller.sandiaPerformance.schema();
      expect(schema).toBeDefined();

      // Target definition query
      const targetDef = await caller.sandiaPerformance.targetDefinition();
      expect(targetDef).toBeDefined();

      // Sample input query
      const sample = await caller.sandiaPerformance.sampleInput();
      expect(sample).toBeDefined();

      // Metadata query
      const metadata = await caller.sandiaPerformance.metadata();
      expect(metadata).toHaveProperty(
        "modelId",
        "sandia-electrical-performance-v1"
      );
      expect(metadata).toHaveProperty("attribution");
      expect(metadata.attribution).toContain("Sandia National Laboratories");

      // Readiness query
      const readiness = await caller.sandiaPerformance.readiness();
      expect(readiness).toHaveProperty("modelStatus");
      expect(readiness).toHaveProperty("storedPredictionsCount");

      // Verify alias sandia router is identical
      const statusFromAlias = await caller.sandia.status();
      expect(statusFromAlias.modelName).toBe(
        "SolarVision-Sandia-Performance-Model3"
      );
    }, 60000);
  });

  describe("8. Regression Preservation of SECOM & Other Models (Task 9)", () => {
    it("preserves predictiveQuality (SECOM) routes and contracts without regressions", async () => {
      const caller = appRouter.createCaller({
        user: { id: 1, openId: "test-operator", role: "user" } as any,
        req: {} as any,
        res: {} as any,
      });

      // 1. SECOM Canonical Contract
      const pqContract = await caller.predictiveQuality.canonicalContract();
      expect(pqContract.featureCount).toBe(32);
      expect(pqContract.features.length).toBe(32);

      // 2. SECOM Status
      const pqStatus = await caller.predictiveQuality.status();
      expect(pqStatus.domain).toBe("solar_cell_manufacturing");
      expect(pqStatus.expectedDim).toBe(32);

      // 3. SECOM Benchmark Metadata
      const benchMeta = await caller.predictiveQuality.benchmarkMetadata();
      expect(benchMeta.benchmarkName).toBe(
        "UCI SECOM Semiconductor Yield Benchmark"
      );
      expect(benchMeta.inputFeatureCount).toBe(590);
    });

    it("preserves predictiveMaintenance (Model 4) and rootCause (Model 2) routes", () => {
      expect(appRouter._def.procedures).toHaveProperty(
        "predictiveMaintenance.status"
      );
      expect(appRouter._def.procedures).toHaveProperty(
        "predictiveMaintenance.forecast"
      );
      expect(appRouter._def.procedures).toHaveProperty("rootCause.analyze");
      expect(appRouter._def.procedures).toHaveProperty("rootCause.status");
      expect(appRouter._def.procedures).toHaveProperty(
        "sandiaPerformance.predict"
      );
      expect(appRouter._def.procedures).toHaveProperty("sandia.predict");
    });
  });
});
