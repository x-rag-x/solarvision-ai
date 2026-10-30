import { createRequire } from "node:module";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { detections, inspections } from "../drizzle/schema";
import { ensureSandiaPerformanceSchema } from "./sandiaPerformance/persistence/schema";

const require = createRequire(import.meta.url);
const { DatabaseSync: DatabaseSyncConstructor } = require("node:sqlite") as {
  DatabaseSync: typeof DatabaseSync;
};

export type RequesterContext = {
  userId?: string | null;
  role?: "user" | "admin" | string | null;
};

let _sqliteDb: DatabaseSync | null = null;
let _sqliteDbPath: string | null = null;

/**
 * Overrides the active SQLite database path for isolated testing or custom persistence.
 * Closes the existing connection if open.
 */
export function setSqliteDbPath(customPath: string | null): void {
  if (_sqliteDb) {
    try {
      _sqliteDb.close();
    } catch {
      // Connection might already be closed or in-memory
    }
    _sqliteDb = null;
  }
  _sqliteDbPath = customPath;
}

/**
 * Resets the SQLite database path back to default and closes any active connection.
 */
export function resetSqliteDb(): void {
  if (_sqliteDb) {
    try {
      _sqliteDb.close();
    } catch {
      // ignore
    }
    _sqliteDb = null;
  }
  _sqliteDbPath = null;
}

/**
 * Resolves the active database path based on explicit override, environment variable,
 * or the default development path at `data/solarvision.db`.
 */
export function getSqliteDbPath(): string {
  return (
    _sqliteDbPath ||
    process.env.SQLITE_DB_PATH ||
    join(resolve(process.cwd(), "data"), "solarvision.db")
  );
}

export function getSqliteDb(): DatabaseSync {
  if (!_sqliteDb) {
    const dbPath = getSqliteDbPath();

    if (dbPath !== ":memory:") {
      const dataDir = resolve(dbPath, "..");
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }
    }
    _sqliteDb = new DatabaseSyncConstructor(dbPath);

    // Performance and integrity PRAGMAs (busy_timeout must be first to handle parallel test workers)
    _sqliteDb.exec("PRAGMA busy_timeout = 10000;");
    _sqliteDb.exec("PRAGMA foreign_keys = ON;");
    try {
      _sqliteDb.exec("PRAGMA journal_mode = WAL;");
    } catch {
      // WAL may already be active, not supported for in-memory DBs, or locked by another worker process
    }

    initSqliteSchema(_sqliteDb);
  }
  return _sqliteDb;
}

export function ensureSystemSettingsSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);
}

function initSqliteSchema(db: DatabaseSync) {
  // Base M1 inspection tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspectionId TEXT UNIQUE NOT NULL,
      sourceFilename TEXT NOT NULL,
      modelName TEXT NOT NULL,
      status TEXT NOT NULL,
      processingTimeMs REAL NOT NULL,
      inputImageUrl TEXT,
      annotatedImageUrl TEXT,
      detectionsCount INTEGER NOT NULL DEFAULT 0,
      persistenceStatus TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS detections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspectionId TEXT NOT NULL REFERENCES inspections(inspectionId) ON DELETE CASCADE,
      defectType TEXT NOT NULL,
      confidence REAL NOT NULL,
      x1 REAL NOT NULL,
      y1 REAL NOT NULL,
      x2 REAL NOT NULL,
      y2 REAL NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_detections_inspection_id ON detections(inspectionId);
    CREATE INDEX IF NOT EXISTS idx_detections_defect_type ON detections(defectType);
    CREATE INDEX IF NOT EXISTS idx_inspections_created_at ON inspections(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_inspections_id_lookup ON inspections(inspectionId);
  `);

  // Migrate inspections table with userId ownership and future model relation columns safely
  migrateTableColumns(db, "inspections", [
    { name: "userId", type: "TEXT" },
    { name: "batchId", type: "TEXT" },
    { name: "machineId", type: "TEXT" },
    { name: "modelVersionId", type: "TEXT" },
    { name: "operatorId", type: "TEXT" },
    { name: "isFlagged", type: "INTEGER DEFAULT 0" },
  ]);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_inspections_user_id ON inspections(userId);
  `);

  // Future Model Readiness: Batches, Machines, Sensors, Production Events, Predictions, Alerts
  db.exec(`
    CREATE TABLE IF NOT EXISTS model_versions (
      id TEXT PRIMARY KEY,
      modelName TEXT NOT NULL,
      version TEXT NOT NULL,
      framework TEXT NOT NULL,
      artifactUri TEXT,
      metrics TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      description TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS manufacturing_batches (
      id TEXT PRIMARY KEY,
      batchNumber TEXT UNIQUE NOT NULL,
      waferType TEXT NOT NULL,
      cellLine TEXT NOT NULL,
      targetQuantity INTEGER NOT NULL,
      actualQuantity INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'in_progress',
      startTime TEXT NOT NULL,
      endTime TEXT,
      metadata TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS manufacturing_machines (
      id TEXT PRIMARY KEY,
      machineCode TEXT UNIQUE NOT NULL,
      machineType TEXT NOT NULL,
      lineId TEXT NOT NULL,
      location TEXT,
      status TEXT NOT NULL DEFAULT 'operational',
      lastMaintenanceAt TEXT,
      nextMaintenanceDue TEXT,
      metadata TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sensor_measurements (
      id TEXT PRIMARY KEY,
      machineId TEXT NOT NULL REFERENCES manufacturing_machines(id) ON DELETE CASCADE,
      batchId TEXT REFERENCES manufacturing_batches(id) ON DELETE SET NULL,
      sensorType TEXT NOT NULL,
      measurementValue REAL NOT NULL,
      unit TEXT NOT NULL,
      isAnomaly INTEGER NOT NULL DEFAULT 0,
      anomalyScore REAL,
      recordedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS production_events (
      id TEXT PRIMARY KEY,
      machineId TEXT REFERENCES manufacturing_machines(id) ON DELETE SET NULL,
      batchId TEXT REFERENCES manufacturing_batches(id) ON DELETE SET NULL,
      eventType TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      details TEXT,
      startedAt TEXT NOT NULL,
      resolvedAt TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS root_cause_predictions (
      id TEXT PRIMARY KEY,
      inspectionId TEXT NOT NULL REFERENCES inspections(inspectionId) ON DELETE CASCADE,
      defectId INTEGER REFERENCES detections(id) ON DELETE SET NULL,
      modelVersionId TEXT REFERENCES model_versions(id) ON DELETE SET NULL,
      predictedCause TEXT NOT NULL,
      confidence REAL NOT NULL,
      featureImportance TEXT,
      contributingFactors TEXT,
      recommendedAction TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS predictive_quality_forecasts (
      id TEXT PRIMARY KEY,
      batchId TEXT REFERENCES manufacturing_batches(id) ON DELETE CASCADE,
      machineId TEXT REFERENCES manufacturing_machines(id) ON DELETE SET NULL,
      waferId TEXT,
      userId TEXT,
      modelVersionId TEXT REFERENCES model_versions(id) ON DELETE SET NULL,
      modelVersion TEXT,
      domain TEXT NOT NULL DEFAULT 'solar_cell_manufacturing',
      isBenchmark INTEGER NOT NULL DEFAULT 0,
      dataSource TEXT,
      provenance TEXT,
      qualityOutcome TEXT NOT NULL DEFAULT 'unknown',
      riskLevel TEXT NOT NULL DEFAULT 'low',
      failureProbability REAL,
      predictedDefectRate REAL,
      predictedYield REAL,
      confidence REAL,
      confidenceIntervalLow REAL,
      confidenceIntervalHigh REAL,
      confidenceInterval TEXT,
      forecastHorizonHours INTEGER DEFAULT 24,
      forecastHorizon TEXT,
      dominantRiskDefect TEXT,
      predictedLossPercentage REAL,
      topRiskFactors TEXT,
      factors TEXT,
      probabilities TEXT,
      inputReference TEXT,
      recommendedAction TEXT,
      createdAt TEXT NOT NULL,
      generatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS maintenance_predictions (
      id TEXT PRIMARY KEY,
      machineId TEXT NOT NULL REFERENCES manufacturing_machines(id) ON DELETE CASCADE,
      modelVersionId TEXT REFERENCES model_versions(id) ON DELETE SET NULL,
      component TEXT NOT NULL,
      estimatedRemainingLifeHours REAL,
      failureProbability7Days REAL NOT NULL,
      urgency TEXT NOT NULL DEFAULT 'low',
      recommendedAction TEXT,
      predictedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_records (
      id TEXT PRIMARY KEY,
      alertType TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      machineId TEXT REFERENCES manufacturing_machines(id) ON DELETE SET NULL,
      batchId TEXT REFERENCES manufacturing_batches(id) ON DELETE SET NULL,
      inspectionId TEXT REFERENCES inspections(inspectionId) ON DELETE SET NULL,
      acknowledged INTEGER NOT NULL DEFAULT 0,
      acknowledgedBy TEXT,
      acknowledgedAt TEXT,
      metadata TEXT,
      createdAt TEXT NOT NULL
    );

    -- Additional future indexes
    CREATE INDEX IF NOT EXISTS idx_sensor_machine_time ON sensor_measurements(machineId, recordedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_sensor_recorded_at ON sensor_measurements(recordedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_production_events_machine ON production_events(machineId, startedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_root_cause_inspection ON root_cause_predictions(inspectionId);
    CREATE INDEX IF NOT EXISTS idx_maintenance_machine ON maintenance_predictions(machineId, urgency);
    CREATE INDEX IF NOT EXISTS idx_alerts_unack ON alert_records(acknowledged, severity, createdAt DESC);

    CREATE TABLE IF NOT EXISTS cell_screening_predictions (
      id TEXT PRIMARY KEY,
      userId TEXT,
      modelVersionId TEXT NOT NULL DEFAULT 'solarvision_m2_elpv_binary_v1',
      sourceFilename TEXT NOT NULL,
      imageUrl TEXT,
      predictedClass TEXT NOT NULL,
      defectiveProbability REAL NOT NULL,
      threshold REAL NOT NULL,
      decision TEXT NOT NULL DEFAULT 'screening_only',
      reviewStatus TEXT NOT NULL DEFAULT 'pending',
      requiresManualReview INTEGER NOT NULL DEFAULT 1,
      dataProvenance TEXT NOT NULL DEFAULT 'ELPV',
      warning TEXT,
      metadata TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cell_screening_created_at ON cell_screening_predictions(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_cell_screening_user_id ON cell_screening_predictions(userId);
    CREATE INDEX IF NOT EXISTS idx_cell_screening_class ON cell_screening_predictions(predictedClass);

  `);

  // Ensure Model 3 Predictive Quality schema and migrations are active
  ensureQualitySchema(db);

  // Ensure Model 3 Sandia Solar Electrical Performance schema and migrations are active
  ensureSandiaPerformanceSchema(db);
  ensureSystemSettingsSchema(db);
}

export const MODEL3_ADDITIVE_COLUMNS = [
  { name: "userId", type: "TEXT" },
  {
    name: "machineId",
    type: "TEXT REFERENCES manufacturing_machines(id) ON DELETE SET NULL",
  },
  { name: "waferId", type: "TEXT" },
  { name: "modelVersion", type: "TEXT" },
  { name: "domain", type: "TEXT NOT NULL DEFAULT 'solar_cell_manufacturing'" },
  { name: "isBenchmark", type: "INTEGER NOT NULL DEFAULT 0" },
  { name: "dataSource", type: "TEXT" },
  { name: "provenance", type: "TEXT" },
  { name: "qualityOutcome", type: "TEXT NOT NULL DEFAULT 'unknown'" },
  { name: "failureProbability", type: "REAL" },
  { name: "predictedYield", type: "REAL" },
  { name: "confidence", type: "REAL" },
  { name: "confidenceIntervalLow", type: "REAL" },
  { name: "confidenceIntervalHigh", type: "REAL" },
  { name: "confidenceInterval", type: "TEXT" },
  { name: "forecastHorizonHours", type: "INTEGER DEFAULT 24" },
  { name: "forecastHorizon", type: "TEXT" },
  { name: "dominantRiskDefect", type: "TEXT" },
  { name: "predictedLossPercentage", type: "REAL" },
  { name: "topRiskFactors", type: "TEXT" },
  { name: "factors", type: "TEXT" },
  { name: "probabilities", type: "TEXT" },
  { name: "inputReference", type: "TEXT" },
  { name: "recommendedAction", type: "TEXT" },
  { name: "createdAt", type: "TEXT" },
  { name: "generatedAt", type: "TEXT" },
];

export function ensureQualitySchema(db: DatabaseSync): void {
  // 1. Ensure foreign key parent tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS model_versions (
      id TEXT PRIMARY KEY,
      modelName TEXT NOT NULL,
      version TEXT NOT NULL,
      framework TEXT NOT NULL,
      artifactUri TEXT,
      metrics TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      description TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS manufacturing_batches (
      id TEXT PRIMARY KEY,
      batchNumber TEXT UNIQUE NOT NULL,
      waferType TEXT NOT NULL,
      cellLine TEXT NOT NULL,
      targetQuantity INTEGER NOT NULL,
      actualQuantity INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'in_progress',
      startTime TEXT NOT NULL,
      endTime TEXT,
      metadata TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS manufacturing_machines (
      id TEXT PRIMARY KEY,
      machineCode TEXT UNIQUE NOT NULL,
      machineType TEXT NOT NULL,
      lineId TEXT NOT NULL,
      location TEXT,
      status TEXT NOT NULL DEFAULT 'operational',
      lastMaintenanceAt TEXT,
      nextMaintenanceDue TEXT,
      metadata TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  // 2. Base predictive_quality_forecasts table creation
  db.exec(`
    CREATE TABLE IF NOT EXISTS predictive_quality_forecasts (
      id TEXT PRIMARY KEY,
      batchId TEXT REFERENCES manufacturing_batches(id) ON DELETE CASCADE,
      machineId TEXT REFERENCES manufacturing_machines(id) ON DELETE SET NULL,
      waferId TEXT,
      userId TEXT,
      modelVersionId TEXT REFERENCES model_versions(id) ON DELETE SET NULL,
      modelVersion TEXT,
      domain TEXT NOT NULL DEFAULT 'solar_cell_manufacturing',
      isBenchmark INTEGER NOT NULL DEFAULT 0,
      dataSource TEXT,
      provenance TEXT,
      qualityOutcome TEXT NOT NULL DEFAULT 'unknown',
      riskLevel TEXT NOT NULL DEFAULT 'low',
      failureProbability REAL,
      predictedDefectRate REAL,
      predictedYield REAL,
      confidence REAL,
      confidenceIntervalLow REAL,
      confidenceIntervalHigh REAL,
      confidenceInterval TEXT,
      forecastHorizonHours INTEGER DEFAULT 24,
      forecastHorizon TEXT,
      dominantRiskDefect TEXT,
      predictedLossPercentage REAL,
      topRiskFactors TEXT,
      factors TEXT,
      probabilities TEXT,
      inputReference TEXT,
      recommendedAction TEXT,
      createdAt TEXT NOT NULL,
      generatedAt TEXT
    );
  `);

  // Idempotently apply additive columns
  migrateTableColumns(
    db,
    "predictive_quality_forecasts",
    MODEL3_ADDITIVE_COLUMNS
  );

  // Safely lift legacy NOT NULL constraints without data loss
  try {
    const tableInfo = db
      .prepare("PRAGMA table_info(predictive_quality_forecasts)")
      .all() as Array<{ name: string; notnull: number }>;
    const hasLegacyNotNull = tableInfo.some(
      c =>
        (c.name === "predictedYield" ||
          c.name === "batchId" ||
          c.name === "predictedDefectRate") &&
        c.notnull === 1
    );

    if (hasLegacyNotNull) {
      db.exec("PRAGMA foreign_keys = OFF;");
      try {
        db.exec("BEGIN IMMEDIATE;");
        db.exec(`
          CREATE TABLE IF NOT EXISTS predictive_quality_forecasts_canonical (
            id TEXT PRIMARY KEY,
            batchId TEXT REFERENCES manufacturing_batches(id) ON DELETE CASCADE,
            machineId TEXT REFERENCES manufacturing_machines(id) ON DELETE SET NULL,
            waferId TEXT,
            userId TEXT,
            modelVersionId TEXT REFERENCES model_versions(id) ON DELETE SET NULL,
            modelVersion TEXT,
            domain TEXT NOT NULL DEFAULT 'solar_cell_manufacturing',
            isBenchmark INTEGER NOT NULL DEFAULT 0,
            dataSource TEXT,
            provenance TEXT,
            qualityOutcome TEXT NOT NULL DEFAULT 'unknown',
            riskLevel TEXT NOT NULL DEFAULT 'low',
            failureProbability REAL,
            predictedDefectRate REAL,
            predictedYield REAL,
            confidence REAL,
            confidenceIntervalLow REAL,
            confidenceIntervalHigh REAL,
            confidenceInterval TEXT,
            forecastHorizonHours INTEGER DEFAULT 24,
            forecastHorizon TEXT,
            dominantRiskDefect TEXT,
            predictedLossPercentage REAL,
            topRiskFactors TEXT,
            factors TEXT,
            probabilities TEXT,
            inputReference TEXT,
            recommendedAction TEXT,
            createdAt TEXT,
            generatedAt TEXT
          );
        `);

        const allColNames = [
          "id",
          "batchId",
          "machineId",
          "waferId",
          "userId",
          "modelVersionId",
          "modelVersion",
          "domain",
          "isBenchmark",
          "dataSource",
          "provenance",
          "qualityOutcome",
          "riskLevel",
          "failureProbability",
          "predictedDefectRate",
          "predictedYield",
          "confidence",
          "confidenceIntervalLow",
          "confidenceIntervalHigh",
          "confidenceInterval",
          "forecastHorizonHours",
          "forecastHorizon",
          "dominantRiskDefect",
          "predictedLossPercentage",
          "topRiskFactors",
          "factors",
          "probabilities",
          "inputReference",
          "recommendedAction",
          "createdAt",
          "generatedAt",
        ];
        const existingNames = new Set(tableInfo.map(c => c.name));
        const sharedCols = allColNames.filter(c => existingNames.has(c));

        if (sharedCols.length > 0) {
          const sharedStr = sharedCols.join(", ");
          db.exec(
            `INSERT INTO predictive_quality_forecasts_canonical (${sharedStr}) SELECT ${sharedStr} FROM predictive_quality_forecasts;`
          );
        }
        db.exec("DROP TABLE predictive_quality_forecasts;");
        db.exec(
          "ALTER TABLE predictive_quality_forecasts_canonical RENAME TO predictive_quality_forecasts;"
        );
        db.exec("COMMIT;");
      } catch (err) {
        db.exec("ROLLBACK;");
        throw err;
      } finally {
        db.exec("PRAGMA foreign_keys = ON;");
      }
    }
  } catch (migErr) {
    console.warn("[Model 3 Migration] Nullable schema upgrade notice:", migErr);
  }

  // Ensure timestamps are synchronized between createdAt and generatedAt
  try {
    db.exec(`
      UPDATE predictive_quality_forecasts 
      SET createdAt = COALESCE(createdAt, generatedAt, datetime('now')),
          generatedAt = COALESCE(generatedAt, createdAt, datetime('now'))
      WHERE createdAt IS NULL OR generatedAt IS NULL;
    `);
  } catch {
    // Ignore if column absent
  }

  // Indexes for user isolation, domain filtering, and timestamp ordering
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_quality_forecast_batch 
      ON predictive_quality_forecasts(batchId);
    CREATE INDEX IF NOT EXISTS idx_quality_forecast_user 
      ON predictive_quality_forecasts(userId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_quality_forecast_domain 
      ON predictive_quality_forecasts(domain, isBenchmark);
    CREATE INDEX IF NOT EXISTS idx_quality_forecast_created 
      ON predictive_quality_forecasts(createdAt DESC);
  `);
}

export function migrateTableColumns(
  db: DatabaseSync,
  tableName: string,
  columnsToAdd: Array<{ name: string; type: string }>
) {
  try {
    const existing = db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as Array<{ name: string }>;
    const existingNames = new Set(existing.map(col => col.name));
    for (const col of columnsToAdd) {
      if (!existingNames.has(col.name)) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type};`);
      }
    }
  } catch (err) {
    console.warn(
      `[SQLite Migration] Column migration for ${tableName} noticed:`,
      err
    );
  }
}

export function saveSqliteInspection(
  input: typeof inspections.$inferInsert,
  items: Array<typeof detections.$inferInsert>
): boolean {
  const db = getSqliteDb();
  const createdAtStr =
    input.createdAt instanceof Date
      ? input.createdAt.toISOString()
      : typeof input.createdAt === "string"
        ? input.createdAt
        : new Date().toISOString();

  // Explicit immediate transaction for atomic write and orphan prevention
  db.exec("BEGIN IMMEDIATE;");
  try {
    // 1. Insert or update inspection record (prevent accidental duplication & crash on re-run)
    const upsertInspection = db.prepare(`
      INSERT INTO inspections (
        inspectionId, sourceFilename, modelName, status,
        processingTimeMs, inputImageUrl, annotatedImageUrl,
        detectionsCount, persistenceStatus, createdAt,
        userId, batchId, machineId, modelVersionId, operatorId, isFlagged
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(inspectionId) DO UPDATE SET
        sourceFilename = excluded.sourceFilename,
        modelName = excluded.modelName,
        status = excluded.status,
        processingTimeMs = excluded.processingTimeMs,
        inputImageUrl = excluded.inputImageUrl,
        annotatedImageUrl = excluded.annotatedImageUrl,
        detectionsCount = excluded.detectionsCount,
        persistenceStatus = excluded.persistenceStatus,
        userId = COALESCE(excluded.userId, inspections.userId),
        batchId = excluded.batchId,
        machineId = excluded.machineId,
        modelVersionId = excluded.modelVersionId,
        operatorId = excluded.operatorId,
        isFlagged = excluded.isFlagged
    `);

    upsertInspection.run(
      input.inspectionId,
      input.sourceFilename,
      input.modelName,
      input.status,
      input.processingTimeMs,
      input.inputImageUrl ?? null,
      input.annotatedImageUrl ?? null,
      input.detectionsCount ?? 0,
      input.persistenceStatus,
      createdAtStr,
      input.userId ?? (input as any).operatorId ?? null,
      (input as any).batchId ?? null,
      (input as any).machineId ?? null,
      (input as any).modelVersionId ?? null,
      (input as any).operatorId ?? null,
      (input as any).isFlagged ? 1 : 0
    );

    // 2. Clean previous detections if this is a retry/upsert to prevent duplicate clutter
    db.prepare(`DELETE FROM detections WHERE inspectionId = ?`).run(
      input.inspectionId
    );

    // 3. Insert detections
    if (items.length > 0) {
      const insertDetection = db.prepare(`
        INSERT INTO detections (
          inspectionId, defectType, confidence,
          x1, y1, x2, y2, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertDetection.run(
          item.inspectionId,
          item.defectType,
          Number(item.confidence),
          Number(item.x1),
          Number(item.y1),
          Number(item.x2),
          Number(item.y2),
          createdAtStr
        );
      }
    }

    db.exec("COMMIT;");
    return true;
  } catch (error) {
    db.exec("ROLLBACK;");
    console.error("[SQLite] saveInspection failed and was rolled back:", error);
    return false;
  }
}

export function getSqliteRecentInspections(
  limit = 25,
  requester?: RequesterContext
) {
  const db = getSqliteDb();
  const safeLimit = Math.max(1, Math.min(limit, 5000));

  let rows: any[];
  if (requester?.role === "admin") {
    // Admin has global visibility
    const stmt = db.prepare(`
      SELECT * FROM inspections
      ORDER BY datetime(createdAt) DESC
      LIMIT ?
    `);
    rows = stmt.all(safeLimit) as any[];
  } else if (requester?.userId) {
    // Authenticated user: only see their own inspections
    const stmt = db.prepare(`
      SELECT * FROM inspections
      WHERE userId = ? OR operatorId = ?
      ORDER BY datetime(createdAt) DESC
      LIMIT ?
    `);
    rows = stmt.all(requester.userId, requester.userId, safeLimit) as any[];
  } else {
    // Unauthenticated/anonymous caller: only see unowned/anonymous records
    const stmt = db.prepare(`
      SELECT * FROM inspections
      WHERE userId IS NULL AND operatorId IS NULL
      ORDER BY datetime(createdAt) DESC
      LIMIT ?
    `);
    rows = stmt.all(safeLimit) as any[];
  }

  return rows.map(r => ({
    id: r.id,
    inspectionId: String(r.inspectionId),
    userId: r.userId ? String(r.userId) : null,
    sourceFilename: String(r.sourceFilename),
    modelName: String(r.modelName),
    status: r.status as "completed" | "failed",
    processingTimeMs: Number(r.processingTimeMs),
    inputImageUrl: r.inputImageUrl ? String(r.inputImageUrl) : null,
    annotatedImageUrl: r.annotatedImageUrl ? String(r.annotatedImageUrl) : null,
    detectionsCount: Number(r.detectionsCount),
    persistenceStatus: String(r.persistenceStatus),
    createdAt: new Date(r.createdAt),
    batchId: r.batchId ? String(r.batchId) : null,
    machineId: r.machineId ? String(r.machineId) : null,
    modelVersionId: r.modelVersionId ? String(r.modelVersionId) : null,
    operatorId: r.operatorId ? String(r.operatorId) : null,
    isFlagged: Boolean(r.isFlagged),
  }));
}

export function getSqliteInspectionById(
  inspectionId: string,
  requester?: RequesterContext
) {
  const db = getSqliteDb();
  const inspectionStmt = db.prepare(`
    SELECT * FROM inspections WHERE inspectionId = ? LIMIT 1
  `);
  const inspection = inspectionStmt.get(inspectionId) as any;
  if (!inspection) return null;

  // Enforce requester ownership check
  const owner = inspection.userId || inspection.operatorId;
  if (owner) {
    // Record is owned by an authenticated user
    const isOwner = requester?.userId && requester.userId === owner;
    const isAdmin = requester?.role === "admin";
    if (!isOwner && !isAdmin) {
      // Cross-user retrieval denied
      return null;
    }
  } else {
    // Unowned / legacy inspection record
    // Admin can always access; callers with the exact inspectionId can view unowned records
    // but cannot access owned records
  }

  const detectionsStmt = db.prepare(`
    SELECT * FROM detections WHERE inspectionId = ? ORDER BY confidence DESC LIMIT 200
  `);
  const detectionsList = detectionsStmt.all(inspectionId) as any[];

  return {
    inspection: {
      id: inspection.id,
      inspectionId: String(inspection.inspectionId),
      userId: inspection.userId ? String(inspection.userId) : null,
      sourceFilename: String(inspection.sourceFilename),
      modelName: String(inspection.modelName),
      status: inspection.status as "completed" | "failed",
      processingTimeMs: Number(inspection.processingTimeMs),
      inputImageUrl: inspection.inputImageUrl
        ? String(inspection.inputImageUrl)
        : null,
      annotatedImageUrl: inspection.annotatedImageUrl
        ? String(inspection.annotatedImageUrl)
        : null,
      detectionsCount: Number(inspection.detectionsCount),
      persistenceStatus: String(inspection.persistenceStatus),
      createdAt: new Date(inspection.createdAt),
      batchId: inspection.batchId ? String(inspection.batchId) : null,
      machineId: inspection.machineId ? String(inspection.machineId) : null,
      modelVersionId: inspection.modelVersionId
        ? String(inspection.modelVersionId)
        : null,
      operatorId: inspection.operatorId ? String(inspection.operatorId) : null,
      isFlagged: Boolean(inspection.isFlagged),
    },
    detections: detectionsList.map(d => ({
      id: d.id,
      inspectionId: String(d.inspectionId),
      defectType: String(d.defectType),
      confidence: Number(d.confidence),
      x1: Number(d.x1),
      y1: Number(d.y1),
      x2: Number(d.x2),
      y2: Number(d.y2),
      createdAt: new Date(d.createdAt),
    })),
  };
}

export function getSqliteDashboardStats(requester?: RequesterContext) {
  const db = getSqliteDb();

  let inspectionStats: any;
  let detectionStats: any;

  if (requester?.userId && requester.role !== "admin") {
    // User-scoped dashboard stats
    inspectionStats = db
      .prepare(
        `
      SELECT COUNT(*) as count, AVG(processingTimeMs) as avgTime 
      FROM inspections 
      WHERE userId = ? OR operatorId = ?
    `
      )
      .get(requester.userId, requester.userId) as any;

    detectionStats = db
      .prepare(
        `
      SELECT COUNT(*) as count, COUNT(DISTINCT defectType) as typesCount 
      FROM detections 
      WHERE inspectionId IN (
        SELECT inspectionId FROM inspections WHERE userId = ? OR operatorId = ?
      )
    `
      )
      .get(requester.userId, requester.userId) as any;
  } else {
    // System-wide dashboard stats (Admin or unauthenticated global overview)
    inspectionStats = db
      .prepare(
        `
      SELECT COUNT(*) as count, AVG(processingTimeMs) as avgTime FROM inspections
    `
      )
      .get() as any;

    detectionStats = db
      .prepare(
        `
      SELECT COUNT(*) as count, COUNT(DISTINCT defectType) as typesCount FROM detections
    `
      )
      .get() as any;
  }

  const inspectionCount = Number(inspectionStats?.count ?? 0);
  const avgProcessingTimeMs =
    inspectionStats?.avgTime != null &&
    !Number.isNaN(Number(inspectionStats.avgTime))
      ? Number(inspectionStats.avgTime)
      : null;
  const detectionCount = Number(detectionStats?.count ?? 0);
  const defectTypes = Number(detectionStats?.typesCount ?? 0);

  return {
    configured: true,
    inspections: inspectionCount,
    detections: detectionCount,
    avgProcessingTimeMs,
    defectTypes,
  };
}

export function getSqliteDefectAnalytics(requester?: RequesterContext) {
  const db = getSqliteDb();

  let typeRows: any[];
  let trendRows: any[];

  if (requester?.userId && requester.role !== "admin") {
    // User-scoped defect analytics
    typeRows = db
      .prepare(
        `
      SELECT defectType, COUNT(*) as count, AVG(confidence) as avgConfidence
      FROM detections
      WHERE inspectionId IN (
        SELECT inspectionId FROM inspections WHERE userId = ? OR operatorId = ?
      )
      GROUP BY defectType
      ORDER BY count DESC
      LIMIT 50
    `
      )
      .all(requester.userId, requester.userId) as any[];

    trendRows = db
      .prepare(
        `
      SELECT substr(createdAt, 1, 10) as day, COUNT(*) as inspections, SUM(detectionsCount) as detections
      FROM inspections
      WHERE userId = ? OR operatorId = ?
      GROUP BY day
      ORDER BY day DESC
      LIMIT 14
    `
      )
      .all(requester.userId, requester.userId) as any[];
  } else {
    // System-wide defect analytics
    typeRows = db
      .prepare(
        `
      SELECT defectType, COUNT(*) as count, AVG(confidence) as avgConfidence
      FROM detections
      GROUP BY defectType
      ORDER BY count DESC
      LIMIT 50
    `
      )
      .all() as any[];

    trendRows = db
      .prepare(
        `
      SELECT substr(createdAt, 1, 10) as day, COUNT(*) as inspections, SUM(detectionsCount) as detections
      FROM inspections
      GROUP BY day
      ORDER BY day DESC
      LIMIT 14
    `
      )
      .all() as any[];
  }

  const byType = typeRows.map(r => ({
    defectType: String(r.defectType),
    count: Number(r.count),
    avgConfidence: Number(r.avgConfidence ?? 0),
  }));

  const recentTrend = trendRows.map(r => ({
    day: String(r.day),
    inspections: Number(r.inspections),
    detections: Number(r.detections ?? 0),
  }));

  return {
    configured: true,
    byType,
    recentTrend,
  };
}

export type CellScreeningRecord = {
  id: string;
  userId?: string | null;
  modelVersionId: string;
  sourceFilename: string;
  imageUrl?: string | null;
  predictedClass: "healthy" | "defective";
  defectiveProbability: number;
  threshold: number;
  decision: string;
  reviewStatus: string;
  requiresManualReview: boolean;
  dataProvenance: string;
  warning?: string | null;
  metadata?: any;
  createdAt: string;
};

export function saveSqliteCellScreening(record: {
  id: string;
  userId?: string | null;
  modelVersionId?: string;
  sourceFilename: string;
  imageUrl?: string | null;
  predictedClass: string;
  defectiveProbability: number;
  threshold: number;
  decision?: string;
  reviewStatus?: string;
  requiresManualReview?: boolean;
  dataProvenance?: string;
  warning?: string | null;
  metadata?: any;
  createdAt?: string;
}): void {
  const db = getSqliteDb();
  db.prepare(`
    INSERT INTO cell_screening_predictions (
      id, userId, modelVersionId, sourceFilename, imageUrl,
      predictedClass, defectiveProbability, threshold, decision,
      reviewStatus, requiresManualReview, dataProvenance, warning,
      metadata, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.userId ?? null,
    record.modelVersionId ?? 'solarvision_m2_elpv_binary_v1',
    record.sourceFilename,
    record.imageUrl ?? null,
    record.predictedClass,
    record.defectiveProbability,
    record.threshold,
    record.decision ?? 'screening_only',
    record.reviewStatus ?? 'pending',
    record.requiresManualReview !== false ? 1 : 0,
    record.dataProvenance ?? 'ELPV',
    record.warning ?? null,
    record.metadata ? JSON.stringify(record.metadata) : null,
    record.createdAt ?? new Date().toISOString()
  );
}

export function getSqliteCellScreenings(limit = 50, requester?: RequesterContext): CellScreeningRecord[] {
  const db = getSqliteDb();
  let rows: any[];
  if (requester?.userId && requester.role !== "admin") {
    rows = db.prepare(`
      SELECT * FROM cell_screening_predictions
      WHERE userId = ?
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(requester.userId, limit);
  } else {
    rows = db.prepare(`
      SELECT * FROM cell_screening_predictions
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(limit);
  }

  return rows.map(r => ({
    id: String(r.id),
    userId: r.userId ? String(r.userId) : null,
    modelVersionId: String(r.modelVersionId),
    sourceFilename: String(r.sourceFilename),
    imageUrl: r.imageUrl ? String(r.imageUrl) : null,
    predictedClass: r.predictedClass as "healthy" | "defective",
    defectiveProbability: Number(r.defectiveProbability),
    threshold: Number(r.threshold),
    decision: String(r.decision),
    reviewStatus: String(r.reviewStatus),
    requiresManualReview: Boolean(r.requiresManualReview),
    dataProvenance: String(r.dataProvenance),
    warning: r.warning ? String(r.warning) : null,
    metadata: r.metadata ? JSON.parse(r.metadata) : null,
    createdAt: String(r.createdAt),
  }));
}

export function getSqliteCellScreeningById(id: string, requester?: RequesterContext): CellScreeningRecord | null {
  const db = getSqliteDb();
  const row = db.prepare("SELECT * FROM cell_screening_predictions WHERE id = ?").get(id) as any;
  if (!row) return null;
  if (requester?.userId && requester.role !== "admin" && row.userId && row.userId !== requester.userId) {
    return null;
  }
  return {
    id: String(row.id),
    userId: row.userId ? String(row.userId) : null,
    modelVersionId: String(row.modelVersionId),
    sourceFilename: String(row.sourceFilename),
    imageUrl: row.imageUrl ? String(row.imageUrl) : null,
    predictedClass: row.predictedClass as "healthy" | "defective",
    defectiveProbability: Number(row.defectiveProbability),
    threshold: Number(row.threshold),
    decision: String(row.decision),
    reviewStatus: String(row.reviewStatus),
    requiresManualReview: Boolean(row.requiresManualReview),
    dataProvenance: String(row.dataProvenance),
    warning: row.warning ? String(row.warning) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: String(row.createdAt),
  };
}

export function getSystemSetting(key: string, defaultValue: string | null = null): string | null {
  try {
    const db = getSqliteDb();
    const row = db.prepare("SELECT value FROM system_settings WHERE key = ?").get(key) as { value: string } | undefined;
    return row ? row.value : defaultValue;
  } catch (err) {
    console.warn(`[SQLite] Failed to read system setting '${key}':`, err);
    return defaultValue;
  }
}

export function setSystemSetting(key: string, value: string): void {
  const db = getSqliteDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO system_settings (key, value, updatedAt)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
  `).run(key, value, now);
}

export function isRootCauseEnabled(): boolean {
  const val = getSystemSetting("enable_root_cause");
  if (val === null) {
    return false; // Default to disabled for a new configuration
  }
  return val === "true" || val === "1";
}

export function setRootCauseEnabled(enabled: boolean): void {
  setSystemSetting("enable_root_cause", enabled ? "true" : "false");
}
