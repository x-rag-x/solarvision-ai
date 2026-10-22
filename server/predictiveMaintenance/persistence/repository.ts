/**
 * SolarVision AI — Model 4: Predictive Maintenance
 * Equipment Data Persistence Repository & Query Adapter
 */

import type { DatabaseSync } from "node:sqlite";
import { getSqliteDb } from "../../sqlite";
import { ensureMaintenanceSchema } from "./schema";
import { validateSaveAssessmentInput, PersistenceValidationError } from "./validation";
import { BENCHMARK_MACHINES, DEMO_BENCHMARK_SAMPLES } from "./demoData";
import type {
  SaveAssessmentInput,
  MaintenanceAssessmentRecord,
  RequesterContext,
  HistoryQueryOptions,
  RecentQueryOptions,
  PaginatedResult,
  MaintenanceReadinessSummary,
  SensorValuesMap,
  RiskFactor,
} from "./types";

export class MaintenancePersistenceRepository {
  private dbInstance: DatabaseSync | null = null;

  constructor(customDb?: DatabaseSync) {
    if (customDb) {
      this.dbInstance = customDb;
      ensureMaintenanceSchema(this.dbInstance);
    }
  }

  private getDb(): DatabaseSync {
    if (this.dbInstance) {
      return this.dbInstance;
    }
    const db = getSqliteDb();
    ensureMaintenanceSchema(db);
    return db;
  }

  /**
   * Parses a raw database row into a strongly typed MaintenanceAssessmentRecord.
   */
  private mapRowToRecord(row: any): MaintenanceAssessmentRecord {
    let sensorValues: SensorValuesMap | null = null;
    let riskFactors: RiskFactor[] | null = null;
    let modeProbabilities: Record<string, number> | null = null;

    if (row.sensorValues) {
      try {
        sensorValues = typeof row.sensorValues === "string" ? JSON.parse(row.sensorValues) : row.sensorValues;
      } catch {
        sensorValues = null;
      }
    }

    if (row.riskFactors) {
      try {
        riskFactors = typeof row.riskFactors === "string" ? JSON.parse(row.riskFactors) : row.riskFactors;
      } catch {
        riskFactors = null;
      }
    }

    if (row.modeProbabilities) {
      try {
        modeProbabilities =
          typeof row.modeProbabilities === "string" ? JSON.parse(row.modeProbabilities) : row.modeProbabilities;
      } catch {
        modeProbabilities = null;
      }
    }

    const rawFailureProb = row.failureProbability ?? row.failureProbability7Days;
    const failureProbability =
      rawFailureProb !== null && rawFailureProb !== undefined ? Number(rawFailureProb) : null;

    const rawRul = row.remainingUsefulLifeHours ?? row.estimatedRemainingLifeHours;
    const remainingUsefulLifeHours =
      rawRul !== null && rawRul !== undefined ? Number(rawRul) : null;

    return {
      id: row.id,
      machineId: row.machineId,
      userId: row.userId ?? null,
      modelVersionId: row.modelVersionId ?? null,
      machineCategory: row.machineCategory ?? "general_equipment",
      componentName: row.componentName ?? row.component ?? "main_subsystem",
      domain: row.domain ?? "solar_factory",
      dataSource: row.dataSource ?? (row.domain === "ai4i_synthetic_benchmark" ? "ai4i_synthetic_benchmark_demo" : "factory_edge"),
      isBenchmark: Boolean(row.isBenchmark),
      measurementTimestamp: row.measurementTimestamp ?? row.createdAt,
      sensorValues,
      healthState: row.healthState ?? "unknown",
      failureMode: row.failureMode ?? "none",
      failureProbability,
      healthyProbability: row.healthyProbability !== null && row.healthyProbability !== undefined
        ? Number(row.healthyProbability)
        : null,
      remainingUsefulLifeHours,
      urgency: row.urgency ?? "routine",
      confidence: row.confidence !== null && row.confidence !== undefined ? Number(row.confidence) : null,
      riskFactors,
      modeProbabilities,
      recommendedAction: row.recommendedAction ?? row.explanation ?? null,
      createdAt: row.createdAt ?? row.predictedAt,
    };
  }

  /**
   * Persists a validated Model 4 maintenance assessment into SQLite.
   * Atomic immediate transaction with foreign key and boundary validation.
   */
  public async saveAssessment(
    input: SaveAssessmentInput,
    context?: RequesterContext
  ): Promise<MaintenanceAssessmentRecord> {
    const db = this.getDb();

    // 1. Validate inputs and foreign keys
    validateSaveAssessmentInput(input, db);

    // 2. Resolve ownership and identity
    const effectiveUserId =
      context?.role === "admin" && input.userId !== undefined
        ? input.userId
        : context?.userId ?? input.userId ?? null;

    const id = input.id ?? `pdm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();
    const createdAt = input.createdAt ?? nowIso;
    const measurementTimestamp = input.measurementTimestamp ?? nowIso;
    const isBenchmarkInt = input.isBenchmark ? 1 : input.domain === "ai4i_synthetic_benchmark" ? 1 : 0;
    const componentName = input.componentName ?? "main_subsystem";
    const machineCategory = input.machineCategory ?? "general_equipment";

    // 3. Serialize structured JSON payloads safely
    const sensorValuesJson = input.sensorValues ? JSON.stringify(input.sensorValues) : null;
    const riskFactorsJson = input.riskFactors ? JSON.stringify(input.riskFactors) : null;
    const modeProbabilitiesJson = input.modeProbabilities ? JSON.stringify(input.modeProbabilities) : null;

    // 4. Safe foreign key checking for modelVersionId if provided
    let safeModelVersionId: string | null = null;
    if (input.modelVersionId) {
      try {
        const mv = db.prepare("SELECT id FROM model_versions WHERE id = ?").get(input.modelVersionId);
        if (mv) safeModelVersionId = input.modelVersionId;
      } catch {
        safeModelVersionId = null;
      }
    }

    const stmt = db.prepare(`
      INSERT INTO maintenance_predictions (
        id, machineId, userId, modelVersionId, machineCategory,
        componentName, component, domain, dataSource, isBenchmark,
        measurementTimestamp, sensorValues, healthState, failureMode,
        failureProbability, failureProbability7Days, healthyProbability,
        remainingUsefulLifeHours, estimatedRemainingLifeHours,
        urgency, confidence, riskFactors, modeProbabilities,
        recommendedAction, explanation, recommendedServiceDate,
        createdAt, predictedAt
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        failureProbability = excluded.failureProbability,
        healthState = excluded.healthState,
        remainingUsefulLifeHours = excluded.remainingUsefulLifeHours,
        urgency = excluded.urgency,
        recommendedAction = excluded.recommendedAction,
        riskFactors = excluded.riskFactors,
        modeProbabilities = excluded.modeProbabilities;
    `);

    db.exec("BEGIN IMMEDIATE;");
    try {
      stmt.run(
        id,
        input.machineId,
        effectiveUserId,
        safeModelVersionId,
        machineCategory,
        componentName,
        componentName, // component alias
        input.domain,
        input.dataSource,
        isBenchmarkInt,
        measurementTimestamp,
        sensorValuesJson,
        input.healthState,
        input.failureMode ?? "none",
        input.failureProbability !== undefined ? input.failureProbability : null,
        input.failureProbability !== undefined ? input.failureProbability : null, // failureProbability7Days alias
        input.healthyProbability ?? null,
        input.remainingUsefulLifeHours !== undefined ? input.remainingUsefulLifeHours : null,
        input.remainingUsefulLifeHours !== undefined ? input.remainingUsefulLifeHours : null, // estimatedRemainingLifeHours alias
        input.urgency ?? "routine",
        input.confidence ?? null,
        riskFactorsJson,
        modeProbabilitiesJson,
        input.recommendedAction ?? null,
        input.recommendedAction ?? null, // explanation alias
        null, // recommendedServiceDate
        createdAt,
        createdAt // predictedAt alias
      );
      db.exec("COMMIT;");
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }

    // 5. Retrieve saved record to return fully populated object
    const saved = db.prepare("SELECT * FROM maintenance_predictions WHERE id = ?").get(id);
    return this.mapRowToRecord(saved);
  }

  /**
   * Retrieves an assessment by ID with strict cross-user ownership checking.
   */
  public async getAssessmentById(
    id: string,
    context?: RequesterContext
  ): Promise<MaintenanceAssessmentRecord | null> {
    const db = this.getDb();
    const row = db.prepare("SELECT * FROM maintenance_predictions WHERE id = ?").get(id);
    if (!row) return null;

    const record = this.mapRowToRecord(row);

    // Cross-user ownership enforcement:
    // Benchmark samples (isBenchmark = true) are visible to all operators.
    // Genuine factory records require matching userId, or admin privilege.
    if (context?.role === "admin") {
      return record;
    }

    if (record.isBenchmark) {
      return record;
    }

    if (context?.userId) {
      if (record.userId === context.userId) {
        return record;
      }
      // If record is unowned legacy record (userId is null)
      if (record.userId === null) {
        return record;
      }
      // Attempting to access another user's genuine assessment
      return null;
    }

    // Anonymous requester cannot view private user assessments
    return record.userId === null ? record : null;
  }

  /**
   * Retrieves paginated history for a specific machine with cross-user isolation.
   */
  public async getMachineHistory(
    machineId: string,
    options: HistoryQueryOptions = {},
    context?: RequesterContext
  ): Promise<PaginatedResult<MaintenanceAssessmentRecord>> {
    const db = this.getDb();
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const offset = Math.max(options.offset ?? 0, 0);

    let whereClause = "WHERE machineId = ?";
    const params: any[] = [machineId];

    if (options.domain) {
      whereClause += " AND domain = ?";
      params.push(options.domain);
    }

    if (options.isBenchmark !== undefined) {
      whereClause += " AND isBenchmark = ?";
      params.push(options.isBenchmark ? 1 : 0);
    }

    if (options.healthState) {
      whereClause += " AND healthState = ?";
      params.push(options.healthState);
    }

    if (options.urgency) {
      whereClause += " AND urgency = ?";
      params.push(options.urgency);
    }

    if (options.startDate) {
      whereClause += " AND createdAt >= ?";
      params.push(options.startDate);
    }

    if (options.endDate) {
      whereClause += " AND createdAt <= ?";
      params.push(options.endDate);
    }

    // Cross-user access control
    if (context?.role !== "admin") {
      if (context?.userId) {
        whereClause += " AND (userId = ? OR userId IS NULL OR isBenchmark = 1)";
        params.push(context.userId);
      } else {
        whereClause += " AND (userId IS NULL OR isBenchmark = 1)";
      }
    }

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM maintenance_predictions ${whereClause}`;
    const countRow = db.prepare(countSql).get(...params) as { total: number };
    const total = countRow?.total ?? 0;

    // Get paginated records
    const querySql = `
      SELECT * FROM maintenance_predictions 
      ${whereClause} 
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `;
    const rows = db.prepare(querySql).all(...params, limit, offset);

    return {
      records: rows.map((r) => this.mapRowToRecord(r)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Retrieves recent assessments across all equipment with cross-user isolation.
   */
  public async getRecentAssessments(
    options: RecentQueryOptions = {},
    context?: RequesterContext
  ): Promise<PaginatedResult<MaintenanceAssessmentRecord>> {
    const db = this.getDb();
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const offset = Math.max(options.offset ?? 0, 0);

    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (options.domain) {
      whereClause += " AND domain = ?";
      params.push(options.domain);
    }

    if (options.isBenchmark !== undefined) {
      whereClause += " AND isBenchmark = ?";
      params.push(options.isBenchmark ? 1 : 0);
    }

    if (options.urgency) {
      whereClause += " AND urgency = ?";
      params.push(options.urgency);
    }

    // Cross-user access control
    if (context?.role !== "admin") {
      if (context?.userId) {
        whereClause += " AND (userId = ? OR userId IS NULL OR isBenchmark = 1)";
        params.push(context.userId);
      } else {
        whereClause += " AND (userId IS NULL OR isBenchmark = 1)";
      }
    }

    const countSql = `SELECT COUNT(*) as total FROM maintenance_predictions ${whereClause}`;
    const countRow = db.prepare(countSql).get(...params) as { total: number };
    const total = countRow?.total ?? 0;

    const querySql = `
      SELECT * FROM maintenance_predictions 
      ${whereClause} 
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `;
    const rows = db.prepare(querySql).all(...params, limit, offset);

    return {
      records: rows.map((r) => this.mapRowToRecord(r)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Computes dataset readiness summary and equipment breakdown for Model 4.
   */
  public async getDatasetReadinessCounts(
    _context?: RequesterContext
  ): Promise<MaintenanceReadinessSummary> {
    const db = this.getDb();

    const countTable = (query: string, params: any[] = []): number => {
      try {
        const res = db.prepare(query).get(...params) as { c: number };
        return res?.c ?? 0;
      } catch {
        return 0;
      }
    };

    const totalAssessments = countTable("SELECT COUNT(*) as c FROM maintenance_predictions");
    const genuineFactoryAssessments = countTable(
      "SELECT COUNT(*) as c FROM maintenance_predictions WHERE isBenchmark = 0 AND domain = 'solar_factory'"
    );
    const benchmarkDemoAssessments = countTable(
      "SELECT COUNT(*) as c FROM maintenance_predictions WHERE isBenchmark = 1 OR domain = 'ai4i_synthetic_benchmark'"
    );
    const registeredMachines = countTable("SELECT COUNT(*) as c FROM manufacturing_machines");
    const sensorMeasurements = countTable("SELECT COUNT(*) as c FROM sensor_measurements");

    // Equipment breakdown
    let equipmentBreakdown: any[] = [];
    try {
      const machines = db.prepare(`
        SELECT m.id, m.machineCode, m.machineType, m.status,
               COUNT(p.id) as assessmentCount,
               MAX(p.createdAt) as latestAssessmentAt,
               (
                 SELECT p2.healthState 
                 FROM maintenance_predictions p2 
                 WHERE p2.machineId = m.id 
                 ORDER BY p2.createdAt DESC 
                 LIMIT 1
               ) as latestHealthState
        FROM manufacturing_machines m
        LEFT JOIN maintenance_predictions p ON p.machineId = m.id
        GROUP BY m.id
        ORDER BY m.machineCode ASC
      `).all() as any[];

      equipmentBreakdown = machines.map((m) => ({
        machineId: m.id,
        machineCode: m.machineCode,
        machineType: m.machineType,
        status: m.status,
        assessmentCount: Number(m.assessmentCount ?? 0),
        latestAssessmentAt: m.latestAssessmentAt ?? null,
        latestHealthState: m.latestHealthState ?? null,
      }));
    } catch (err) {
      console.warn("[Model 4 Readiness] Failed to query equipment breakdown:", err);
    }

    const isBlocked = genuineFactoryAssessments === 0 || sensorMeasurements === 0;

    const blockingReasons: string[] = [];
    if (genuineFactoryAssessments === 0) {
      blockingReasons.push(
        "Zero genuine solar manufacturing equipment maintenance records exist in the database."
      );
    }
    if (sensorMeasurements === 0) {
      blockingReasons.push(
        "Zero physical machine sensor measurements (vibration, temperature, current) ingested from factory floor."
      );
    }
    if (isBlocked) {
      blockingReasons.push(
        "Model 4 production training requires real factory telemetry. Academic benchmark samples cannot be used for solar production deployment."
      );
    }

    return {
      schemaVersion: "1.0.0",
      canonicalFeatureCount: 6,
      datasetStatus: isBlocked ? "DATASET_BLOCKED" : "READY",
      tableCounts: {
        totalAssessments,
        genuineFactoryAssessments,
        benchmarkDemoAssessments,
        registeredMachines,
        sensorMeasurements,
      },
      equipmentBreakdown,
      blockingReasons,
    };
  }

  /**
   * Seeds curated academic benchmark samples for Model 4 demonstration.
   * Explicitly sets isBenchmark = 1 and registers benchmark machines.
   */
  public async seedDemoBenchmarkSamples(
    context?: RequesterContext,
    count?: number
  ): Promise<{ inserted: number; sampleIds: string[] }> {
    const db = this.getDb();

    // 1. Ensure benchmark machines are registered in manufacturing_machines
    const nowIso = new Date().toISOString();
    const insertMachineStmt = db.prepare(`
      INSERT OR IGNORE INTO manufacturing_machines (
        id, machineCode, machineType, lineId, location, status, metadata, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec("BEGIN IMMEDIATE;");
    try {
      for (const m of BENCHMARK_MACHINES) {
        insertMachineStmt.run(
          m.id,
          m.machineCode,
          m.machineType,
          m.lineId,
          m.location,
          m.status,
          m.metadata,
          nowIso,
          nowIso
        );
      }
      db.exec("COMMIT;");
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }

    // 2. Insert demo benchmark samples
    const samplesToInsert = count
      ? DEMO_BENCHMARK_SAMPLES.slice(0, count)
      : DEMO_BENCHMARK_SAMPLES;

    const sampleIds: string[] = [];
    for (const sample of samplesToInsert) {
      const rec = await this.saveAssessment(
        {
          ...sample,
          isBenchmark: true,
          domain: "ai4i_synthetic_benchmark",
          dataSource: "ai4i_synthetic_benchmark_demo",
          userId: context?.userId ?? null,
        },
        context
      );
      sampleIds.push(rec.id);
    }

    return {
      inserted: sampleIds.length,
      sampleIds,
    };
  }

  /**
   * Deletes all benchmark demonstration records safely.
   */
  public async clearDemoBenchmarkSamples(
    _context?: RequesterContext
  ): Promise<{ deleted: number }> {
    const db = this.getDb();
    const countBefore = (
      db.prepare("SELECT COUNT(*) as c FROM maintenance_predictions WHERE isBenchmark = 1").get() as { c: number }
    )?.c ?? 0;

    db.exec("BEGIN IMMEDIATE;");
    try {
      db.exec("DELETE FROM maintenance_predictions WHERE isBenchmark = 1;");
      db.exec("COMMIT;");
      return { deleted: countBefore };
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }
  }
}

// Default singleton instance connected to operational SQLite database
let _defaultRepo: MaintenancePersistenceRepository | null = null;

export function getMaintenanceRepository(): MaintenancePersistenceRepository {
  if (!_defaultRepo) {
    _defaultRepo = new MaintenancePersistenceRepository();
  }
  return _defaultRepo;
}
