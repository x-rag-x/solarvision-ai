/**
 * SolarVision AI — Phase Final: Agent 4 Independent Database QA
 * Regression Suite: Test Database Isolation & Zero-Pollution Guarantee
 *
 * Verifies that automated tests and isolated runs cannot contaminate or mutate
 * the development / production database (`data/solarvision.db`).
 */

import { describe, expect, it } from "vitest";
import {
  getSqliteDb,
  getSqliteDbPath,
  setSqliteDbPath,
  resetSqliteDb,
  saveSqliteInspection,
  getSqliteInspectionById,
} from "./sqlite";
import {
  persistMaintenanceAssessment,
  getMaintenanceHistory,
} from "./predictiveMaintenance/persistence";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";

describe("Database Test Isolation & Zero-Pollution Regression Suite", () => {
  it("resolves default database path to data/solarvision.db when unconfigured", () => {
    resetSqliteDb();
    const resolvedPath = getSqliteDbPath();
    expect(resolvedPath).toContain("solarvision.db");
  });

  it("dynamically respects process.env.SQLITE_DB_PATH override", () => {
    const originalEnv = process.env.SQLITE_DB_PATH;
    try {
      const mockCustomPath = join(tmpdir(), "solarvision_env_test.db");
      process.env.SQLITE_DB_PATH = mockCustomPath;
      resetSqliteDb();

      expect(getSqliteDbPath()).toBe(mockCustomPath);
    } finally {
      if (originalEnv !== undefined) {
        process.env.SQLITE_DB_PATH = originalEnv;
      } else {
        delete process.env.SQLITE_DB_PATH;
      }
      resetSqliteDb();
    }
  });

  it("guarantees operations in isolated :memory: database NEVER mutate data/solarvision.db", async () => {
    // 1. Snapshot development database state
    resetSqliteDb();
    const devDb = getSqliteDb();
    const initialInspectionsCount = Number(
      (devDb.prepare("SELECT COUNT(*) as count FROM inspections").get() as any)?.count ?? 0
    );
    const initialPredictionsCount = Number(
      (devDb.prepare("SELECT COUNT(*) as count FROM maintenance_predictions").get() as any)?.count ?? 0
    );

    // 2. Switch to isolated in-memory database
    setSqliteDbPath(":memory:");
    const testInspectionId = `test-iso-${randomUUID()}`;
    const testMachineId = "M-ISO-TEST-01";

    // Insert machine in isolated DB for foreign key constraint
    const isoDb = getSqliteDb();
    isoDb.prepare(`
      INSERT INTO manufacturing_machines (id, machineCode, machineType, lineId, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(testMachineId, testMachineId, "stringer", "line-iso", "operational");

    // Persist inspection in isolated DB
    const savedInspection = saveSqliteInspection(
      {
        inspectionId: testInspectionId,
        sourceFilename: "isolation_verify.jpg",
        modelName: "YOLO26n",
        status: "completed",
        processingTimeMs: 42.0,
        detectionsCount: 1,
        persistenceStatus: "database",
        userId: "isolated-user-01",
        createdAt: new Date(),
      },
      [
        {
          inspectionId: testInspectionId,
          defectType: "microcrack",
          confidence: 0.95,
          x1: 10,
          y1: 10,
          x2: 20,
          y2: 20,
        },
      ]
    );
    expect(savedInspection).toBe(true);

    // Persist Model 4 maintenance record in isolated DB
    const savedAssessment = await persistMaintenanceAssessment(
      {
        machineId: testMachineId,
        componentName: "inverter_cooling",
        domain: "solar_factory",
        dataSource: "factory_iot_telemetry",
        healthState: "warning",
        failureMode: "heat_dissipation_failure",
        failureProbability: 0.44,
        remainingUsefulLifeHours: 120.5,
        urgency: "medium",
      },
      { userId: "isolated-user-01", role: "operator" }
    );
    expect(savedAssessment.id).toBeDefined();

    // Verify records exist in isolated DB
    const isolatedInspection = getSqliteInspectionById(testInspectionId, {
      userId: "isolated-user-01",
      role: "operator",
    });
    expect(isolatedInspection).not.toBeNull();
    expect(isolatedInspection?.inspection.inspectionId).toBe(testInspectionId);

    const isolatedHistory = await getMaintenanceHistory(
      testMachineId,
      { limit: 10 },
      { userId: "isolated-user-01", role: "operator" }
    );
    expect(isolatedHistory.records.length).toBe(1);
    expect(isolatedHistory.records[0].machineId).toBe(testMachineId);

    // 3. Switch back to development database
    resetSqliteDb();
    const restoredDevDb = getSqliteDb();
    const finalInspectionsCount = Number(
      (restoredDevDb.prepare("SELECT COUNT(*) as count FROM inspections").get() as any)?.count ?? 0
    );
    const finalPredictionsCount = Number(
      (restoredDevDb.prepare("SELECT COUNT(*) as count FROM maintenance_predictions").get() as any)?.count ?? 0
    );

    // Development database must have ZERO added rows
    expect(finalInspectionsCount).toBe(initialInspectionsCount);
    expect(finalPredictionsCount).toBe(initialPredictionsCount);

    // Test record must NOT exist in development database
    const leakedInspection = restoredDevDb
      .prepare("SELECT * FROM inspections WHERE inspectionId = ?")
      .get(testInspectionId);
    expect(leakedInspection).toBeUndefined();

    const leakedPrediction = restoredDevDb
      .prepare("SELECT * FROM maintenance_predictions WHERE machineId = ?")
      .get(testMachineId);
    expect(leakedPrediction).toBeUndefined();
  });

  it("supports isolated temporary file database and cleans up cleanly", async () => {
    const tempDbPath = join(tmpdir(), `solarvision_temp_${Date.now()}_${randomUUID().slice(0, 8)}.db`);
    try {
      setSqliteDbPath(tempDbPath);
      const tempDb = getSqliteDb();

      expect(existsSync(tempDbPath)).toBe(true);

      const testId = `temp-run-${randomUUID()}`;
      const saved = saveSqliteInspection(
        {
          inspectionId: testId,
          sourceFilename: "temp_test.jpg",
          modelName: "YOLO26n",
          status: "completed",
          processingTimeMs: 15.0,
          detectionsCount: 0,
          persistenceStatus: "database",
          createdAt: new Date(),
        },
        []
      );
      expect(saved).toBe(true);

      const record = getSqliteInspectionById(testId);
      expect(record?.inspection.inspectionId).toBe(testId);
    } finally {
      resetSqliteDb();
      if (existsSync(tempDbPath)) {
        try {
          unlinkSync(tempDbPath);
        } catch {
          // File lock may release asynchronously on Windows
        }
      }
    }
  });
});
