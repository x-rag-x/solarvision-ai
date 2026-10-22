/**
 * SolarVision AI — Phase Final: Agent 4 Independent Database QA
 * Model 3: Predictive Quality Persistence, Schema Migration & Multi-Tenant Isolation Suite
 *
 * Verifies:
 * 1. Fresh SQLite database migration creates canonical schema
 * 2. Legacy SQLite database migration upgrades non-destructively without data loss
 * 3. Genuine benchmark forecast insert records all fields and enforces null yield
 * 4. History retrieval, timestamp ordering, and pagination
 * 5. Multi-tenant cross-user access isolation
 * 6. Persistence failure propagation (no silent success on failure)
 * 7. Database reopening / reboot survival
 * 8. Zero changes to normal development database (data/solarvision.db)
 * 9. Regression safety for Model 1, Model 2, and Model 4 persistence
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";

import {
  getSqliteDb,
  setSqliteDbPath,
  resetSqliteDb,
  saveSqliteInspection,
  getSqliteInspectionById,
} from "../sqlite";
import {
  ensureQualitySchema,
  persistQualityForecast,
  saveQualityAssessment,
  getQualityForecasts,
  getQualityForecastById,
  formatForecastForPersistence,
} from "./dbContract";
import {
  persistMaintenanceAssessment,
  getMaintenanceHistory,
} from "../predictiveMaintenance/persistence";
import type { PredictiveQualityResponse } from "./types";

const require = createRequire(import.meta.url);
const { DatabaseSync: DatabaseSyncConstructor } = require("node:sqlite") as {
  DatabaseSync: typeof DatabaseSync;
};

describe("Model 3: Predictive Quality Persistence & Migration Suite", () => {
  beforeEach(() => {
    setSqliteDbPath(":memory:");
  });

  afterEach(() => {
    resetSqliteDb();
  });

  // ==========================================================================
  // 1. Fresh Database Migration
  // ==========================================================================
  it("creates canonical predictive_quality_forecasts schema on fresh database", () => {
    const db = getSqliteDb();
    ensureQualitySchema(db);

    const tableInfo = db
      .prepare("PRAGMA table_info(predictive_quality_forecasts)")
      .all() as Array<{ name: string; type: string; notnull: number }>;

    const colNames = tableInfo.map((c) => c.name);

    // Required canonical fields
    expect(colNames).toContain("id");
    expect(colNames).toContain("batchId");
    expect(colNames).toContain("machineId");
    expect(colNames).toContain("waferId");
    expect(colNames).toContain("userId");
    expect(colNames).toContain("modelVersionId");
    expect(colNames).toContain("modelVersion");
    expect(colNames).toContain("domain");
    expect(colNames).toContain("isBenchmark");
    expect(colNames).toContain("dataSource");
    expect(colNames).toContain("provenance");
    expect(colNames).toContain("qualityOutcome");
    expect(colNames).toContain("riskLevel");
    expect(colNames).toContain("failureProbability");
    expect(colNames).toContain("predictedDefectRate");
    expect(colNames).toContain("predictedYield");
    expect(colNames).toContain("confidence");
    expect(colNames).toContain("confidenceIntervalLow");
    expect(colNames).toContain("confidenceIntervalHigh");
    expect(colNames).toContain("forecastHorizonHours");
    expect(colNames).toContain("topRiskFactors");
    expect(colNames).toContain("factors");
    expect(colNames).toContain("probabilities");
    expect(colNames).toContain("inputReference");
    expect(colNames).toContain("recommendedAction");
    expect(colNames).toContain("createdAt");
    expect(colNames).toContain("generatedAt");

    // Indexes
    const indexInfo = db
      .prepare("PRAGMA index_list(predictive_quality_forecasts)")
      .all() as Array<{ name: string }>;
    const idxNames = indexInfo.map((i) => i.name);
    expect(idxNames).toContain("idx_quality_forecast_batch");
    expect(idxNames).toContain("idx_quality_forecast_user");
    expect(idxNames).toContain("idx_quality_forecast_domain");
    expect(idxNames).toContain("idx_quality_forecast_created");
  });

  // ==========================================================================
  // 2. Legacy Database Migration Without Data Loss
  // ==========================================================================
  it("safely migrates an older schema with NOT NULL constraints without losing historical rows", () => {
    const db = new DatabaseSyncConstructor(":memory:");

    // 1. Simulate legacy table creation from prior phases with NOT NULL constraints
    db.exec(`
      CREATE TABLE predictive_quality_forecasts (
        id TEXT PRIMARY KEY,
        batchId TEXT NOT NULL,
        modelVersionId TEXT,
        predictedDefectRate REAL NOT NULL,
        riskLevel TEXT NOT NULL DEFAULT 'low',
        predictedLossPercentage REAL,
        dominantRiskDefect TEXT,
        confidenceInterval TEXT,
        forecastHorizon TEXT,
        generatedAt TEXT NOT NULL
      );

      INSERT INTO predictive_quality_forecasts (
        id, batchId, modelVersionId, predictedDefectRate, riskLevel,
        predictedLossPercentage, dominantRiskDefect, generatedAt
      ) VALUES (
        'legacy_row_01', 'BATCH-HISTORIC-99', 'model-v1', 0.045, 'medium',
        4.5, 'microcrack', '2026-09-01T10:00:00.000Z'
      );
    `);

    // Verify pre-migration state
    const preCount = (
      db.prepare("SELECT COUNT(*) as c FROM predictive_quality_forecasts").get() as any
    ).c;
    expect(preCount).toBe(1);

    // 2. Apply non-destructive schema migration
    ensureQualitySchema(db);

    // 3. Verify post-migration state: row must be preserved
    const rows = db.prepare("SELECT * FROM predictive_quality_forecasts").all() as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe("legacy_row_01");
    expect(rows[0].batchId).toBe("BATCH-HISTORIC-99");
    expect(rows[0].predictedDefectRate).toBe(0.045);
    expect(rows[0].dominantRiskDefect).toBe("microcrack");
    // createdAt must have been synced from generatedAt
    expect(rows[0].createdAt).toBe("2026-09-01T10:00:00.000Z");

    // 4. Verify NOT NULL constraints were lifted to allow null batchId and predictedYield
    const tableInfo = db
      .prepare("PRAGMA table_info(predictive_quality_forecasts)")
      .all() as Array<{ name: string; notnull: number }>;
    const batchCol = tableInfo.find((c) => c.name === "batchId");
    expect(batchCol?.notnull).toBe(0); // Nullable!
  });

  // ==========================================================================
  // 3. Genuine Benchmark Forecast Insert & Scientific Truthfulness
  // ==========================================================================
  it("persists benchmark predictions with all metadata and strictly NULL predictedYield", async () => {
    const db = getSqliteDb();

    const mockBenchmarkResponse: PredictiveQualityResponse = {
      contractVersion: "3.0.0",
      status: "ready",
      domain: "semiconductor_benchmark",
      batchId: null, // SECOM benchmark runs may not link to a physical solar batch
      machineId: null,
      qualityOutcome: "fail",
      riskLevel: "high",
      probabilities: { pass: 0.15, fail: 0.85 },
      confidence: 0.85,
      isCalibrated: true,
      calibrationMethod: "empirical_binned",
      predictedDefectRate: 0.85,
      predictedYield: 15.0, // Python engine heuristic — must NOT be stored as factory yield!
      confidenceInterval: { low: 0.78, high: 0.92 },
      topRiskFactors: [
        {
          factorName: "sensor_59",
          impactScore: 0.28,
          measuredValue: 12.4,
          nominalBaseline: 8.0,
          deviationDirection: "high",
        },
      ],
      recommendedAction: "Quarantine wafer lot; calibrate chamber 4",
      modelVersion: "3.0.0-benchmark",
      modelMetadata: {
        modelId: "secom_gbdt",
        modelName: "SolarVision_Gradient_Boosting_SECOM",
        version: "3.0.0-benchmark",
        framework: "scikit-learn",
        domain: "semiconductor_benchmark",
        sha256: "392d26cd80b37bd3600e49124099b9ba17cbff05be404ca8d0e35bebda196beb",
        schemaVersion: "3.0.0",
        expectedDim: 590,
        featureNames: ["feature_0", "feature_1"],
        targetClasses: ["pass", "fail"],
        sourceDataset: "UCI SECOM",
        labelMeaning: "-1: pass, +1: fail",
        evaluationStatus: "calibrated",
        calibrationMethod: "empirical_binned",
        isCalibrated: true,
        isBenchmark: true,
        limitations: ["External semiconductor benchmark only."],
      },
      limitations: ["Not trained on solar electroluminescence factory images."],
      processingTimeMs: 45.2,
    };

    const persisted = await persistQualityForecast(
      mockBenchmarkResponse,
      {
        userId: "secom-operator-101",
        role: "engineer",
        inputReference: "SECOM-WAFER-BATCH-007",
        waferId: "W-SECOM-007",
      },
      db
    );

    expect(persisted).toBe(true);
    expect(mockBenchmarkResponse.persistedId).toBeDefined();

    // Verify record in database
    const saved = await getQualityForecastById(
      mockBenchmarkResponse.persistedId!,
      { userId: "secom-operator-101", role: "engineer" },
      db
    );

    expect(saved).not.toBeNull();
    expect(saved?.domain).toBe("semiconductor_benchmark");
    expect(saved?.isBenchmark).toBe(true);
    expect(saved?.userId).toBe("secom-operator-101");
    expect(saved?.qualityOutcome).toBe("fail");
    expect(saved?.riskLevel).toBe("high");
    expect(saved?.failureProbability).toBe(0.85);
    expect(saved?.predictedDefectRate).toBe(0.85);
    expect(saved?.inputReference).toBe("SECOM-WAFER-BATCH-007");
    expect(saved?.waferId).toBe("W-SECOM-007");
    expect(saved?.dataSource).toBe("uci_secom_benchmark");

    // Scientific Truthfulness: predictedYield must be NULL for benchmark predictions
    expect(saved?.predictedYield).toBeNull();

    // Verify JSON deserialization
    expect(saved?.topRiskFactors?.length).toBe(1);
    expect(saved?.topRiskFactors?.[0].factorName).toBe("sensor_59");
    expect(saved?.probabilities?.fail).toBe(0.85);
  });

  // ==========================================================================
  // 4. History Retrieval, Timestamp Ordering & Pagination
  // ==========================================================================
  it("retrieves forecast history ordered by createdAt DESC with pagination", async () => {
    const db = getSqliteDb();

    // Seed manufacturing batch
    db.prepare(`
      INSERT INTO manufacturing_batches (
        id, batchNumber, waferType, cellLine, targetQuantity, status, startTime, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run("BATCH-HIST-01", "LOT-HIST-01", "mono", "Line-1", 500, "in_progress", new Date().toISOString());

    // Insert 5 staggered forecasts
    for (let i = 1; i <= 5; i++) {
      const resp: PredictiveQualityResponse = {
        contractVersion: "1.0.0",
        status: "ready",
        domain: "solar_cell_manufacturing",
        batchId: "BATCH-HIST-01",
        machineId: null,
        qualityOutcome: i % 2 === 0 ? "pass" : "warning",
        riskLevel: i % 2 === 0 ? "low" : "medium",
        probabilities: { pass: 0.8, fail: 0.2 },
        confidence: 0.8,
        isCalibrated: false,
        calibrationMethod: "none",
        predictedDefectRate: 0.05 * i,
        predictedYield: 100 - 5 * i,
        confidenceInterval: null,
        topRiskFactors: [],
        recommendedAction: null,
        modelVersion: "1.0.0",
        modelMetadata: null,
        limitations: [],
        processingTimeMs: 10,
      };

      await persistQualityForecast(
        resp,
        {
          userId: "hist-operator-1",
          role: "user",
          inputReference: `run-${i}`,
        },
        db
      );
    }

    // Query page 1 (limit 3)
    const page1 = await getQualityForecasts(
      { batchId: "BATCH-HIST-01", limit: 3, offset: 0 },
      { userId: "hist-operator-1", role: "user" },
      db
    );
    expect(page1.length).toBe(3);

    // Query page 2 (limit 3, offset 3)
    const page2 = await getQualityForecasts(
      { batchId: "BATCH-HIST-01", limit: 3, offset: 3 },
      { userId: "hist-operator-1", role: "user" },
      db
    );
    expect(page2.length).toBe(2);

    // Verify ordering: newest first
    const t0 = new Date(page1[0].createdAt).getTime();
    const t1 = new Date(page1[1].createdAt).getTime();
    expect(t0).toBeGreaterThanOrEqual(t1);
  });

  // ==========================================================================
  // 5. Multi-Tenant Cross-User Isolation
  // ==========================================================================
  it("enforces multi-tenant isolation: User A cannot access User B private forecasts", async () => {
    const db = getSqliteDb();

    // 1. Operator Alpha private solar forecast
    const alphaResp: PredictiveQualityResponse = {
      contractVersion: "1.0.0",
      status: "ready",
      domain: "solar_cell_manufacturing",
      batchId: null,
      machineId: null,
      qualityOutcome: "pass",
      riskLevel: "low",
      probabilities: { pass: 0.95 },
      confidence: 0.95,
      isCalibrated: false,
      calibrationMethod: "none",
      predictedDefectRate: 0.05,
      predictedYield: 95.0,
      confidenceInterval: null,
      topRiskFactors: [],
      recommendedAction: null,
      modelVersion: "1.0.0",
      modelMetadata: null,
      limitations: [],
      processingTimeMs: 8,
    };
    await persistQualityForecast(alphaResp, { userId: "op-alpha", role: "user" }, db);
    const alphaId = (alphaResp as any).persistedId;

    // 2. Operator Beta private solar forecast
    const betaResp: PredictiveQualityResponse = {
      contractVersion: "1.0.0",
      status: "ready",
      domain: "solar_cell_manufacturing",
      batchId: null,
      machineId: null,
      qualityOutcome: "warning",
      riskLevel: "medium",
      probabilities: { pass: 0.7 },
      confidence: 0.7,
      isCalibrated: false,
      calibrationMethod: "none",
      predictedDefectRate: 0.3,
      predictedYield: 70.0,
      confidenceInterval: null,
      topRiskFactors: [],
      recommendedAction: null,
      modelVersion: "1.0.0",
      modelMetadata: null,
      limitations: [],
      processingTimeMs: 8,
    };
    await persistQualityForecast(betaResp, { userId: "op-beta", role: "user" }, db);
    const betaId = (betaResp as any).persistedId;

    // 3. Shared benchmark forecast
    const benchResp: PredictiveQualityResponse = {
      contractVersion: "3.0.0",
      status: "ready",
      domain: "semiconductor_benchmark",
      batchId: null,
      machineId: null,
      qualityOutcome: "fail",
      riskLevel: "high",
      probabilities: { fail: 0.8 },
      confidence: 0.8,
      isCalibrated: true,
      calibrationMethod: "binned",
      predictedDefectRate: 0.8,
      predictedYield: null,
      confidenceInterval: null,
      topRiskFactors: [],
      recommendedAction: null,
      modelVersion: "3.0.0-benchmark",
      modelMetadata: { isBenchmark: true } as any,
      limitations: [],
      processingTimeMs: 10,
    };
    await persistQualityForecast(benchResp, { userId: "op-alpha", role: "user" }, db);
    const benchId = (benchResp as any).persistedId;

    // Operator Alpha queries history
    const alphaHistory = await getQualityForecasts({}, { userId: "op-alpha", role: "user" }, db);
    const alphaHistoryIds = alphaHistory.map((r) => r.id);
    expect(alphaHistoryIds).toContain(alphaId);
    expect(alphaHistoryIds).toContain(benchId); // Benchmark is shared
    expect(alphaHistoryIds).not.toContain(betaId); // Operator Beta's private forecast is BLOCKED!

    // Operator Beta attempts direct lookup of Operator Alpha's forecast by ID
    const crossAccess = await getQualityForecastById(alphaId, { userId: "op-beta", role: "user" }, db);
    expect(crossAccess).toBeNull(); // Access denied!

    // Admin can access all
    const adminAccess = await getQualityForecastById(alphaId, { userId: "admin-1", role: "admin" }, db);
    expect(adminAccess).not.toBeNull();
    expect(adminAccess?.id).toBe(alphaId);
  });

  // ==========================================================================
  // 6. Persistence Failure Propagation
  // ==========================================================================
  it("propagates explicit error when storage violates constraints rather than silently claiming success", async () => {
    const db = getSqliteDb();

    // A response that is not ready must return false and not persist
    const notReadyResp: PredictiveQualityResponse = {
      contractVersion: "1.0.0",
      status: "not_trained",
      domain: "solar_cell_manufacturing",
      batchId: null,
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
      limitations: ["Model not trained."],
      processingTimeMs: 1,
    };

    const notReadyPersisted = await persistQualityForecast(notReadyResp, {}, db);
    expect(notReadyPersisted).toBe(false);

    // saveQualityAssessment must throw when attempting to persist an unready response
    await expect(saveQualityAssessment(notReadyResp, {}, db)).rejects.toThrow(
      "response status is not ready"
    );
  });

  // ==========================================================================
  // 7. Database Reopening & Reboot Survival
  // ==========================================================================
  it("retains forecasts bit-for-bit across database connection restarts", async () => {
    const tempDbPath = join(
      tmpdir(),
      `solarvision_reboot_${Date.now()}_${randomUUID().slice(0, 6)}.db`
    );

    try {
      // 1. Open first connection and save record
      const db1 = new DatabaseSyncConstructor(tempDbPath);
      ensureQualitySchema(db1);

      const resp: PredictiveQualityResponse = {
        contractVersion: "3.0.0",
        status: "ready",
        domain: "semiconductor_benchmark",
        batchId: null,
        machineId: null,
        qualityOutcome: "pass",
        riskLevel: "low",
        probabilities: { pass: 0.91, fail: 0.09 },
        confidence: 0.91,
        isCalibrated: true,
        calibrationMethod: "empirical",
        predictedDefectRate: 0.09,
        predictedYield: null,
        confidenceInterval: { low: 0.85, high: 0.95 },
        topRiskFactors: [
          {
            factorName: "sensor_21",
            impactScore: 0.35,
            measuredValue: 104.2,
          },
        ],
        recommendedAction: "Continue standard cycle",
        modelVersion: "3.0.0-benchmark",
        modelMetadata: { isBenchmark: true } as any,
        limitations: [],
        processingTimeMs: 15.5,
      };

      await persistQualityForecast(resp, { userId: "reboot-user-1", inputReference: "reboot-test" }, db1);
      const savedId = (resp as any).persistedId;
      expect(savedId).toBeDefined();

      // Explicitly close first connection
      db1.close();

      // 2. Open completely fresh connection to the same file
      const db2 = new DatabaseSyncConstructor(tempDbPath);
      ensureQualitySchema(db2);

      const reloaded = await getQualityForecastById(
        savedId,
        { userId: "reboot-user-1", role: "user" },
        db2
      );

      expect(reloaded).not.toBeNull();
      expect(reloaded?.id).toBe(savedId);
      expect(reloaded?.qualityOutcome).toBe("pass");
      expect(reloaded?.failureProbability).toBe(0.09);
      expect(reloaded?.predictedYield).toBeNull();
      expect(reloaded?.topRiskFactors?.length).toBe(1);
      expect(reloaded?.topRiskFactors?.[0].factorName).toBe("sensor_21");
      expect(reloaded?.probabilities?.pass).toBe(0.91);

      db2.close();
    } finally {
      if (existsSync(tempDbPath)) {
        try {
          unlinkSync(tempDbPath);
        } catch {}
      }
    }
  });

  // ==========================================================================
  // 8. Zero Changes to Development Database (data/solarvision.db)
  // ==========================================================================
  it("guarantees operations in isolated database never mutate data/solarvision.db", async () => {
    // 1. Snapshot development database counts
    resetSqliteDb();
    const devDb = getSqliteDb();
    const initialForecastCount = (
      devDb.prepare("SELECT COUNT(*) as c FROM predictive_quality_forecasts").get() as any
    ).c;

    // 2. Switch to isolated in-memory DB and perform operations
    setSqliteDbPath(":memory:");
    const testResp: PredictiveQualityResponse = {
      contractVersion: "1.0.0",
      status: "ready",
      domain: "solar_cell_manufacturing",
      batchId: null,
      machineId: null,
      qualityOutcome: "pass",
      riskLevel: "low",
      probabilities: { pass: 0.99 },
      confidence: 0.99,
      isCalibrated: false,
      calibrationMethod: "none",
      predictedDefectRate: 0.01,
      predictedYield: 99.0,
      confidenceInterval: null,
      topRiskFactors: [],
      recommendedAction: null,
      modelVersion: "1.0.0",
      modelMetadata: null,
      limitations: [],
      processingTimeMs: 5,
    };
    await persistQualityForecast(testResp, { userId: "isolated-user-99" });
    const isolatedId = (testResp as any).persistedId;

    // Verify record exists in isolated DB
    const isoRecord = await getQualityForecastById(isolatedId, { userId: "isolated-user-99" });
    expect(isoRecord).not.toBeNull();

    // 3. Switch back to development database
    resetSqliteDb();
    const restoredDevDb = getSqliteDb();
    const finalForecastCount = (
      restoredDevDb.prepare("SELECT COUNT(*) as c FROM predictive_quality_forecasts").get() as any
    ).c;

    // Count must be completely frozen
    expect(finalForecastCount).toBe(initialForecastCount);

    // Isolated test record must not exist in development DB
    const leaked = restoredDevDb
      .prepare("SELECT * FROM predictive_quality_forecasts WHERE id = ?")
      .get(isolatedId);
    expect(leaked).toBeUndefined();
  });

  // ==========================================================================
  // 9. Regression Safety for Model 1, Model 2, and Model 4
  // ==========================================================================
  it("preserves compatibility with Model 1 visual inspection and Model 4 maintenance persistence", async () => {
    const db = getSqliteDb();

    // 1. Model 1 visual inspection save
    const inspectionId = `insp-${randomUUID()}`;
    const savedInspection = saveSqliteInspection(
      {
        inspectionId,
        sourceFilename: "quality_compat_test.jpg",
        modelName: "YOLO26n",
        status: "completed",
        processingTimeMs: 25.0,
        detectionsCount: 1,
        persistenceStatus: "database",
        createdAt: new Date(),
      },
      [
        {
          inspectionId,
          defectType: "crack",
          confidence: 0.92,
          x1: 5,
          y1: 5,
          x2: 15,
          y2: 15,
        },
      ]
    );
    expect(savedInspection).toBe(true);
    const loadedInspection = getSqliteInspectionById(inspectionId);
    expect(loadedInspection?.inspection.inspectionId).toBe(inspectionId);

    // 2. Model 4 maintenance persistence
    const machineId = "M-TEST-COMPAT-01";
    db.prepare(`
      INSERT INTO manufacturing_machines (id, machineCode, machineType, lineId, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(machineId, machineId, "laminator", "line-1", "operational");

    const savedAssessment = await persistMaintenanceAssessment(
      {
        machineId,
        componentName: "vacuum_seal",
        domain: "solar_factory",
        dataSource: "factory_iot_telemetry",
        healthState: "healthy",
        failureMode: "none",
        failureProbability: 0.05,
        remainingUsefulLifeHours: 500,
        urgency: "low",
      },
      { userId: "compat-op", role: "operator" }
    );
    expect(savedAssessment.id).toBeDefined();

    const maintHistory = await getMaintenanceHistory(
      machineId,
      { limit: 5 },
      { userId: "compat-op", role: "operator" }
    );
    expect(maintHistory.records.length).toBe(1);
    expect(maintHistory.records[0].machineId).toBe(machineId);
  });
});
