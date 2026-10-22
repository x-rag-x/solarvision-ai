/**
 * SolarVision AI — Model 4: Predictive Maintenance
 * Database Schema Initialization, Additive Migrations & Indexing
 */

import type { DatabaseSync } from "node:sqlite";

export const MODEL4_ADDITIVE_COLUMNS = [
  { name: "userId", type: "TEXT" },
  { name: "machineCategory", type: "TEXT" },
  { name: "componentName", type: "TEXT" },
  { name: "component", type: "TEXT" }, // Legacy alias for backward compatibility
  { name: "domain", type: "TEXT NOT NULL DEFAULT 'solar_factory'" },
  { name: "dataSource", type: "TEXT" },
  { name: "isBenchmark", type: "INTEGER NOT NULL DEFAULT 0" },
  { name: "measurementTimestamp", type: "TEXT" },
  { name: "sensorValues", type: "TEXT" },
  { name: "healthState", type: "TEXT NOT NULL DEFAULT 'unknown'" },
  { name: "failureMode", type: "TEXT NOT NULL DEFAULT 'none'" },
  { name: "failureProbability", type: "REAL" }, // Nullable: missing does not mean zero risk
  { name: "failureProbability7Days", type: "REAL" }, // Legacy alias
  { name: "healthyProbability", type: "REAL" },
  { name: "remainingUsefulLifeHours", type: "REAL" }, // Nullable: missing does not mean zero hours remaining
  { name: "estimatedRemainingLifeHours", type: "REAL" }, // Legacy alias
  { name: "urgency", type: "TEXT NOT NULL DEFAULT 'routine'" },
  { name: "confidence", type: "REAL" },
  { name: "riskFactors", type: "TEXT" },
  { name: "modeProbabilities", type: "TEXT" },
  { name: "recommendedAction", type: "TEXT" },
  { name: "explanation", type: "TEXT" }, // Legacy alias
  { name: "recommendedServiceDate", type: "TEXT" },
  { name: "createdAt", type: "TEXT" },
  { name: "predictedAt", type: "TEXT" }, // Legacy alias
];

/**
 * Idempotently applies additive schema columns to an existing SQLite table.
 */
export function migrateTableColumns(
  db: DatabaseSync,
  tableName: string,
  columnsToAdd: Array<{ name: string; type: string }>,
): void {
  try {
    const existing = db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as Array<{ name: string }>;
    const existingNames = new Set(existing.map((col) => col.name));

    for (const col of columnsToAdd) {
      if (!existingNames.has(col.name)) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type};`);
      }
    }
  } catch (err) {
    console.warn(`[Model 4 Schema] Column migration for ${tableName} noticed:`, err);
  }
}

/**
 * Ensures all Model 4 equipment persistence tables, columns and indexes
 * are properly initialized in the provided SQLite database connection.
 */
export function ensureMaintenanceSchema(db: DatabaseSync): void {
  // 1. Ensure foreign key targets exist (machines and model versions)
  db.exec(`
    PRAGMA foreign_keys = ON;

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

    CREATE TABLE IF NOT EXISTS sensor_measurements (
      id TEXT PRIMARY KEY,
      machineId TEXT NOT NULL REFERENCES manufacturing_machines(id) ON DELETE CASCADE,
      batchId TEXT,
      sensorType TEXT NOT NULL,
      measurementValue REAL NOT NULL,
      unit TEXT NOT NULL,
      isAnomaly INTEGER NOT NULL DEFAULT 0,
      anomalyScore REAL,
      recordedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  // 2. Base maintenance_predictions table creation (if not existing)
  db.exec(`
    CREATE TABLE IF NOT EXISTS maintenance_predictions (
      id TEXT PRIMARY KEY,
      machineId TEXT NOT NULL REFERENCES manufacturing_machines(id) ON DELETE CASCADE,
      modelVersionId TEXT REFERENCES model_versions(id) ON DELETE SET NULL,
      componentName TEXT NOT NULL DEFAULT 'main_subsystem',
      remainingUsefulLifeHours REAL,
      failureProbability REAL,
      urgency TEXT NOT NULL DEFAULT 'routine',
      recommendedServiceDate TEXT,
      explanation TEXT,
      createdAt TEXT NOT NULL
    );
  `);

  // 3. Additive migration for Model 4 columns
  migrateTableColumns(db, "maintenance_predictions", MODEL4_ADDITIVE_COLUMNS);

  // Lift any legacy NOT NULL constraints on failureProbability or remainingUsefulLifeHours (Task 1: Nullable unavailable states)
  try {
    const tableInfo = db
      .prepare("PRAGMA table_info(maintenance_predictions)")
      .all() as Array<{ name: string; notnull: number }>;
    const hasLegacyNotNull = tableInfo.some(
      (c) =>
        (c.name === "failureProbability" ||
          c.name === "remainingUsefulLifeHours" ||
          c.name === "failureProbability7Days") &&
        c.notnull === 1
    );

    if (hasLegacyNotNull) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS maintenance_predictions_nullable (
          id TEXT PRIMARY KEY,
          machineId TEXT NOT NULL REFERENCES manufacturing_machines(id) ON DELETE CASCADE,
          userId TEXT,
          modelVersionId TEXT REFERENCES model_versions(id) ON DELETE SET NULL,
          machineCategory TEXT,
          componentName TEXT DEFAULT 'main_subsystem',
          component TEXT,
          domain TEXT NOT NULL DEFAULT 'solar_factory',
          dataSource TEXT,
          isBenchmark INTEGER NOT NULL DEFAULT 0,
          measurementTimestamp TEXT,
          sensorValues TEXT,
          healthState TEXT NOT NULL DEFAULT 'unknown',
          failureMode TEXT NOT NULL DEFAULT 'none',
          failureProbability REAL,
          failureProbability7Days REAL,
          healthyProbability REAL,
          remainingUsefulLifeHours REAL,
          estimatedRemainingLifeHours REAL,
          urgency TEXT NOT NULL DEFAULT 'routine',
          confidence REAL,
          riskFactors TEXT,
          modeProbabilities TEXT,
          recommendedAction TEXT,
          explanation TEXT,
          recommendedServiceDate TEXT,
          createdAt TEXT,
          predictedAt TEXT
        );
      `);

      const allColNames = [
        "id", "machineId", "userId", "modelVersionId", "machineCategory",
        "componentName", "component", "domain", "dataSource", "isBenchmark",
        "measurementTimestamp", "sensorValues", "healthState", "failureMode",
        "failureProbability", "failureProbability7Days", "healthyProbability",
        "remainingUsefulLifeHours", "estimatedRemainingLifeHours", "urgency",
        "confidence", "riskFactors", "modeProbabilities", "recommendedAction",
        "explanation", "recommendedServiceDate", "createdAt", "predictedAt"
      ];
      const existingNames = new Set(tableInfo.map((c) => c.name));
      const sharedCols = allColNames.filter((c) => existingNames.has(c));

      if (sharedCols.length > 0) {
        const sharedStr = sharedCols.join(", ");
        db.exec(`INSERT INTO maintenance_predictions_nullable (${sharedStr}) SELECT ${sharedStr} FROM maintenance_predictions;`);
      }
      db.exec("DROP TABLE maintenance_predictions;");
      db.exec("ALTER TABLE maintenance_predictions_nullable RENAME TO maintenance_predictions;");
    }
  } catch (migErr) {
    console.warn("[Model 4 Migration] Nullable schema upgrade notice:", migErr);
  }

  // Sync createdAt from legacy predictedAt if migrating an older database
  try {
    db.exec(`
      UPDATE maintenance_predictions 
      SET createdAt = COALESCE(createdAt, predictedAt, datetime('now'))
      WHERE createdAt IS NULL;
    `);
  } catch {
    // Ignore if column absent
  }

  // 4. Performance, ownership and domain-isolation indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_maintenance_user_machine 
      ON maintenance_predictions(userId, machineId, createdAt DESC);

    CREATE INDEX IF NOT EXISTS idx_maintenance_domain_bench 
      ON maintenance_predictions(domain, isBenchmark);

    CREATE INDEX IF NOT EXISTS idx_maintenance_machine_created 
      ON maintenance_predictions(machineId, createdAt DESC);

    CREATE INDEX IF NOT EXISTS idx_maintenance_urgency 
      ON maintenance_predictions(urgency, createdAt DESC);
  `);
}
