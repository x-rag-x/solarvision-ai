import { createRequire } from "node:module";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { detections, inspections } from "../drizzle/schema";

const require = createRequire(import.meta.url);
const { DatabaseSync: DatabaseSyncConstructor } = require("node:sqlite") as {
  DatabaseSync: typeof DatabaseSync;
};

let _sqliteDb: DatabaseSync | null = null;

export function getSqliteDb(): DatabaseSync {
  if (!_sqliteDb) {
    const dataDir = resolve(process.cwd(), "data");
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = join(dataDir, "solarvision.db");
    _sqliteDb = new DatabaseSyncConstructor(dbPath);
    initSqliteSchema(_sqliteDb);
  }
  return _sqliteDb;
}

function initSqliteSchema(db: DatabaseSync) {
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
      inspectionId TEXT NOT NULL,
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
  `);
}

export function saveSqliteInspection(
  input: typeof inspections.$inferInsert,
  items: Array<typeof detections.$inferInsert>
): boolean {
  try {
    const db = getSqliteDb();
    const createdAtStr =
      input.createdAt instanceof Date
        ? input.createdAt.toISOString()
        : typeof input.createdAt === "string"
        ? input.createdAt
        : new Date().toISOString();

    const insertInspection = db.prepare(`
      INSERT INTO inspections (
        inspectionId, sourceFilename, modelName, status,
        processingTimeMs, inputImageUrl, annotatedImageUrl,
        detectionsCount, persistenceStatus, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertInspection.run(
      input.inspectionId,
      input.sourceFilename,
      input.modelName,
      input.status,
      input.processingTimeMs,
      input.inputImageUrl ?? null,
      input.annotatedImageUrl ?? null,
      input.detectionsCount ?? 0,
      input.persistenceStatus,
      createdAtStr
    );

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
    return true;
  } catch (error) {
    console.error("[SQLite] saveInspection failed:", error);
    return false;
  }
}

export function getSqliteRecentInspections(limit = 25) {
  const db = getSqliteDb();
  const stmt = db.prepare(`
    SELECT * FROM inspections
    ORDER BY datetime(createdAt) DESC
    LIMIT ?
  `);
  const rows = stmt.all(limit) as any[];
  return rows.map(r => ({
    inspectionId: String(r.inspectionId),
    sourceFilename: String(r.sourceFilename),
    modelName: String(r.modelName),
    status: r.status as "completed" | "failed",
    processingTimeMs: Number(r.processingTimeMs),
    inputImageUrl: r.inputImageUrl ? String(r.inputImageUrl) : null,
    annotatedImageUrl: r.annotatedImageUrl ? String(r.annotatedImageUrl) : null,
    detectionsCount: Number(r.detectionsCount),
    persistenceStatus: String(r.persistenceStatus),
    createdAt: new Date(r.createdAt),
  }));
}

export function getSqliteInspectionById(inspectionId: string) {
  const db = getSqliteDb();
  const inspectionStmt = db.prepare(`
    SELECT * FROM inspections WHERE inspectionId = ? LIMIT 1
  `);
  const inspection = inspectionStmt.get(inspectionId) as any;
  if (!inspection) return null;

  const detectionsStmt = db.prepare(`
    SELECT * FROM detections WHERE inspectionId = ? LIMIT 200
  `);
  const detectionsList = detectionsStmt.all(inspectionId) as any[];

  return {
    inspection: {
      ...inspection,
      createdAt: new Date(inspection.createdAt),
    },
    detections: detectionsList.map(d => ({
      ...d,
      createdAt: new Date(d.createdAt),
    })),
  };
}

export function getSqliteDashboardStats() {
  const db = getSqliteDb();
  const inspectionStats = db.prepare(`
    SELECT COUNT(*) as count, AVG(processingTimeMs) as avgTime FROM inspections
  `).get() as any;

  const detectionStats = db.prepare(`
    SELECT COUNT(*) as count, COUNT(DISTINCT defectType) as typesCount FROM detections
  `).get() as any;

  const inspectionCount = Number(inspectionStats?.count ?? 0);
  const avgProcessingTimeMs =
    inspectionStats?.avgTime != null ? Number(inspectionStats.avgTime) : null;
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

export function getSqliteDefectAnalytics() {
  const db = getSqliteDb();
  const typeRows = db.prepare(`
    SELECT defectType, COUNT(*) as count, AVG(confidence) as avgConfidence
    FROM detections
    GROUP BY defectType
    ORDER BY count DESC
    LIMIT 50
  `).all() as any[];

  const byType = typeRows.map(r => ({
    defectType: String(r.defectType),
    count: Number(r.count),
    avgConfidence: Number(r.avgConfidence ?? 0),
  }));

  const trendRows = db.prepare(`
    SELECT substr(createdAt, 1, 10) as day, COUNT(*) as inspections, SUM(detectionsCount) as detections
    FROM inspections
    GROUP BY day
    ORDER BY day DESC
    LIMIT 14
  `).all() as any[];

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
