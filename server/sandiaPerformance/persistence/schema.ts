/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * SQLite Schema Initialization, Migrations, and Table Definitions
 */

import type { DatabaseSync } from "node:sqlite";

export const SANDIA_TABLE_NAME = "sandia_performance_predictions";

export const SANDIA_ADDITIVE_COLUMNS = [
  { name: "userId", type: "TEXT" },
  { name: "moduleId", type: "TEXT" },
  { name: "inputFeatures", type: "TEXT NOT NULL" },
  { name: "predictedValue", type: "REAL NOT NULL" },
  { name: "predictionLabel", type: "TEXT" },
  { name: "targetName", type: "TEXT NOT NULL" },
  { name: "targetUnit", type: "TEXT" },
  { name: "confidence", type: "REAL" },
  { name: "uncertainty", type: "REAL" },
  { name: "featuresUsed", type: "TEXT" },
  { name: "modelVersion", type: "TEXT NOT NULL DEFAULT '1.0.0'" },
  {
    name: "datasetProvenance",
    type: "TEXT NOT NULL DEFAULT 'Sandia National Laboratories PV Performance Modeling Telemetry'",
  },
  { name: "isMock", type: "INTEGER NOT NULL DEFAULT 0" },
  { name: "warnings", type: "TEXT" },
  { name: "metadata", type: "TEXT" },
  { name: "createdAt", type: "TEXT NOT NULL" },
];

/**
 * Idempotently applies additive schema columns to an existing SQLite table.
 */
export function migrateTableColumns(
  db: DatabaseSync,
  tableName: string,
  columnsToAdd: Array<{ name: string; type: string }>
): void {
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
      `[Sandia Schema] Column migration for ${tableName} noticed:`,
      err
    );
  }
}

/**
 * Ensures all Sandia performance prediction tables and indexes
 * are properly created in the SQLite database connection.
 */
export function ensureSandiaPerformanceSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${SANDIA_TABLE_NAME} (
      id TEXT PRIMARY KEY,
      userId TEXT,
      moduleId TEXT,
      inputFeatures TEXT NOT NULL,
      predictedValue REAL NOT NULL,
      predictionLabel TEXT,
      targetName TEXT NOT NULL,
      targetUnit TEXT,
      confidence REAL,
      uncertainty REAL,
      featuresUsed TEXT,
      modelVersion TEXT NOT NULL DEFAULT '1.0.0',
      datasetProvenance TEXT NOT NULL DEFAULT 'Sandia National Laboratories PV Performance Modeling Telemetry',
      isMock INTEGER NOT NULL DEFAULT 0,
      warnings TEXT,
      metadata TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sandia_user_created 
      ON ${SANDIA_TABLE_NAME}(userId, createdAt DESC);

    CREATE INDEX IF NOT EXISTS idx_sandia_module_created 
      ON ${SANDIA_TABLE_NAME}(moduleId, createdAt DESC);

    CREATE INDEX IF NOT EXISTS idx_sandia_created 
      ON ${SANDIA_TABLE_NAME}(createdAt DESC);
  `);

  migrateTableColumns(db, SANDIA_TABLE_NAME, SANDIA_ADDITIVE_COLUMNS);
}
