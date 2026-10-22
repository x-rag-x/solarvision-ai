/**
 * SolarVision AI — Model 2: Manufacturing Root Cause Analysis
 * Database Persistence Specification and Contract
 */

import { getSqliteDb } from "../sqlite";
import type { RootCauseResponse, ProbableCause } from "./types";

/**
 * Normalized database record for `root_cause_predictions` table
 * Supported across SQLite, MySQL (Drizzle), and Supabase PostgreSQL.
 */
export interface RootCauseDbRecord {
  id: string;
  inspectionId: string;
  defectId?: number | string | null;
  modelVersionId?: string | null;
  predictedCause: string;
  confidence: number;
  featureImportance?: Record<string, number> | string | null;
  contributingFactors?: Record<string, number> | string | null;
  recommendedAction?: string | null;
  createdAt: string;
}

export interface RootCauseAggregateStats {
  totalPredictions: number;
  topCauses: Array<{ cause: string; count: number; avgConfidence: number }>;
  recentAlertsCount: number;
}

/**
 * Converts a Model 2 RootCauseResponse into persistence-ready records
 * for the `root_cause_predictions` database table.
 */
export function formatPredictionsForPersistence(
  response: RootCauseResponse,
  defectId?: number | string | null,
): RootCauseDbRecord[] {
  if (response.status !== "ready" || !response.probableCauses.length) {
    return [];
  }

  const now = new Date().toISOString();
  return response.probableCauses.map((cause, index) => ({
    id: `rc_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
    inspectionId: response.inspectionId,
    defectId: defectId ?? null,
    modelVersionId: response.modelVersion !== "none" ? response.modelVersion : null,
    predictedCause: `${cause.causeCode}: ${cause.label}`,
    confidence: cause.confidence ?? 0.0,
    featureImportance: cause.featureImportance ?? null,
    contributingFactors: cause.contributingFactors ?? null,
    recommendedAction: cause.recommendedAction ?? null,
    createdAt: now,
  }));
}

/**
 * Persists validated Model 2 predictions into the existing database schema.
 */
export async function persistRootCauseResponse(
  response: RootCauseResponse,
  defectId?: number | string | null,
): Promise<boolean> {
  const records = formatPredictionsForPersistence(response, defectId);
  if (!records.length) return false;

  try {
    const db = getSqliteDb();
    const insertStmt = db.prepare(`
      INSERT INTO root_cause_predictions (
        id, inspectionId, defectId, modelVersionId,
        predictedCause, confidence, featureImportance,
        contributingFactors, recommendedAction, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec("BEGIN IMMEDIATE;");
    try {
      for (const rec of records) {
        insertStmt.run(
          rec.id,
          rec.inspectionId,
          rec.defectId ?? null,
          rec.modelVersionId ?? null,
          rec.predictedCause,
          rec.confidence,
          rec.featureImportance ? JSON.stringify(rec.featureImportance) : null,
          rec.contributingFactors ? JSON.stringify(rec.contributingFactors) : null,
          rec.recommendedAction ?? null,
          rec.createdAt,
        );
      }
      db.exec("COMMIT;");
      return true;
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }
  } catch (err) {
    console.warn(`[RootCause] SQLite persistence error for inspection ${response.inspectionId}:`, err);
    return false;
  }
}

/**
 * Retrieves manufacturing batches from SQLite with optional filtering.
 */
export async function getManufacturingBatches(filters?: {
  status?: string;
  waferType?: string;
  cellLine?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const db = getSqliteDb();
  let query = "SELECT * FROM manufacturing_batches WHERE 1=1";
  const params: any[] = [];
  if (filters?.status) {
    query += " AND status = ?";
    params.push(filters.status);
  }
  if (filters?.waferType) {
    query += " AND waferType = ?";
    params.push(filters.waferType);
  }
  if (filters?.cellLine) {
    query += " AND cellLine = ?";
    params.push(filters.cellLine);
  }
  query += " ORDER BY createdAt DESC LIMIT ? OFFSET ?";
  params.push(filters?.limit ?? 50, filters?.offset ?? 0);
  return db.prepare(query).all(...params);
}

export async function getManufacturingBatchById(batchId: string): Promise<any | null> {
  const db = getSqliteDb();
  const row = db.prepare("SELECT * FROM manufacturing_batches WHERE id = ? OR batchNumber = ?").get(batchId, batchId);
  return row || null;
}

/**
 * Retrieves manufacturing machines from SQLite with optional filtering.
 */
export async function getManufacturingMachines(filters?: {
  machineType?: string;
  lineId?: string;
  status?: string;
}): Promise<any[]> {
  const db = getSqliteDb();
  let query = "SELECT * FROM manufacturing_machines WHERE 1=1";
  const params: any[] = [];
  if (filters?.machineType) {
    query += " AND machineType = ?";
    params.push(filters.machineType);
  }
  if (filters?.lineId) {
    query += " AND lineId = ?";
    params.push(filters.lineId);
  }
  if (filters?.status) {
    query += " AND status = ?";
    params.push(filters.status);
  }
  query += " ORDER BY machineCode ASC";
  return db.prepare(query).all(...params);
}

export async function getManufacturingMachineById(machineId: string): Promise<any | null> {
  const db = getSqliteDb();
  const row = db.prepare("SELECT * FROM manufacturing_machines WHERE id = ? OR machineCode = ?").get(machineId, machineId);
  return row || null;
}

/**
 * Retrieves sensor history within a time window or for specific machine/batch.
 */
export async function getSensorHistory(filters?: {
  machineId?: string;
  batchId?: string;
  sensorType?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
}): Promise<any[]> {
  const db = getSqliteDb();
  let query = "SELECT * FROM sensor_measurements WHERE 1=1";
  const params: any[] = [];
  if (filters?.machineId) {
    query += " AND machineId = ?";
    params.push(filters.machineId);
  }
  if (filters?.batchId) {
    query += " AND batchId = ?";
    params.push(filters.batchId);
  }
  if (filters?.sensorType) {
    query += " AND sensorType = ?";
    params.push(filters.sensorType);
  }
  if (filters?.startTime) {
    query += " AND recordedAt >= ?";
    params.push(filters.startTime);
  }
  if (filters?.endTime) {
    query += " AND recordedAt <= ?";
    params.push(filters.endTime);
  }
  query += " ORDER BY recordedAt DESC LIMIT ?";
  params.push(filters?.limit ?? 100);
  return db.prepare(query).all(...params);
}

/**
 * Retrieves production events logged on the factory line.
 */
export async function getProductionEvents(filters?: {
  machineId?: string;
  batchId?: string;
  severity?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
}): Promise<any[]> {
  const db = getSqliteDb();
  let query = "SELECT * FROM production_events WHERE 1=1";
  const params: any[] = [];
  if (filters?.machineId) {
    query += " AND machineId = ?";
    params.push(filters.machineId);
  }
  if (filters?.batchId) {
    query += " AND batchId = ?";
    params.push(filters.batchId);
  }
  if (filters?.severity) {
    query += " AND severity = ?";
    params.push(filters.severity);
  }
  if (filters?.startTime) {
    query += " AND startedAt >= ?";
    params.push(filters.startTime);
  }
  if (filters?.endTime) {
    query += " AND startedAt <= ?";
    params.push(filters.endTime);
  }
  query += " ORDER BY startedAt DESC LIMIT ?";
  params.push(filters?.limit ?? 100);
  return db.prepare(query).all(...params);
}

function ensureRootCauseAnnotationsTable(): void {
  const db = getSqliteDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS root_cause_annotations (
      id TEXT PRIMARY KEY,
      inspectionId TEXT NOT NULL,
      defectId TEXT,
      confirmedCause TEXT NOT NULL,
      confidenceLevel TEXT NOT NULL,
      verifiedBy TEXT NOT NULL,
      verifiedAt TEXT NOT NULL,
      investigationNotes TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_annotations_inspection ON root_cause_annotations(inspectionId);
  `);
}

/**
 * Retrieves confirmed failure analysis root cause annotations for an inspection.
 */
export async function getConfirmedRootCauseAnnotations(inspectionId: string): Promise<any[]> {
  ensureRootCauseAnnotationsTable();
  const db = getSqliteDb();
  return db.prepare("SELECT * FROM root_cause_annotations WHERE inspectionId = ? ORDER BY verifiedAt DESC").all(inspectionId);
}

/**
 * Retrieves all confirmed root cause annotations with optional filters and pagination.
 */
export async function getAllConfirmedRootCauseAnnotations(filters?: {
  limit?: number;
  offset?: number;
  cause?: string;
  confidenceLevel?: string;
}): Promise<any[]> {
  ensureRootCauseAnnotationsTable();
  const db = getSqliteDb();
  let query = "SELECT * FROM root_cause_annotations WHERE 1=1";
  const params: any[] = [];
  if (filters?.cause) {
    query += " AND confirmedCause = ?";
    params.push(filters.cause);
  }
  if (filters?.confidenceLevel) {
    query += " AND confidenceLevel = ?";
    params.push(filters.confidenceLevel);
  }
  query += " ORDER BY verifiedAt DESC LIMIT ? OFFSET ?";
  params.push(filters?.limit ?? 100, filters?.offset ?? 0);
  return db.prepare(query).all(...params);
}

/**
 * Saves a quality engineer confirmed root-cause annotation.
 * Explicitly segregates human-verified annotations from model-generated predictions.
 */
export async function saveConfirmedRootCauseAnnotation(input: {
  inspectionId: string;
  defectId?: string | number | null;
  confirmedCause: string;
  confidenceLevel: "confirmed" | "probable" | "investigative";
  verifiedBy: string;
  investigationNotes?: string | null;
  supportingEvidenceFactors?: string[] | null;
  isCorrection?: boolean;
  priorAnnotationId?: string | null;
}): Promise<string> {
  ensureRootCauseAnnotationsTable();
  const db = getSqliteDb();
  const id = `annot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  let notes = input.investigationNotes ?? "";
  if (input.supportingEvidenceFactors && input.supportingEvidenceFactors.length > 0) {
    notes += ` [Evidence: ${input.supportingEvidenceFactors.join(", ")}]`;
  }
  if (input.isCorrection && input.priorAnnotationId) {
    notes += ` [Corrects prior annotation: ${input.priorAnnotationId}]`;
  }

  db.prepare(`
    INSERT INTO root_cause_annotations (
      id, inspectionId, defectId, confirmedCause, confidenceLevel,
      verifiedBy, verifiedAt, investigationNotes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.inspectionId,
    input.defectId ? (Number.isNaN(Number(input.defectId)) ? null : Number(input.defectId)) : null,
    input.confirmedCause,
    input.confidenceLevel,
    input.verifiedBy,
    now,
    notes || null,
    now,
  );
  return id;
}

/**
 * Retrieves stored root-cause predictions for an inspection.
 */
export async function getRootCausePredictionHistory(inspectionId: string): Promise<any[]> {
  const db = getSqliteDb();
  const rows = db.prepare(`
    SELECT * FROM root_cause_predictions
    WHERE inspectionId = ?
    ORDER BY createdAt DESC
  `).all(inspectionId);

  return rows.map((r: any) => ({
    ...r,
    featureImportance: r.featureImportance ? JSON.parse(r.featureImportance) : null,
    contributingFactors: r.contributingFactors ? JSON.parse(r.contributingFactors) : null,
  }));
}

/**
 * Provides a comprehensive, live data readiness summary across all manufacturing entities.
 * Returns dynamic, non-hardcoded counts queried directly from SQLite.
 */
export async function getRootCauseReadinessSummary(): Promise<{
  status: "DATASET_READY" | "DATASET_INCOMPLETE" | "DATASET_BLOCKED";
  datasetStatus: "DATASET_READY" | "DATASET_INCOMPLETE" | "DATASET_BLOCKED";
  schemaVersion: string;
  canonicalFeatureCount: number;
  batchesCount: number;
  machinesCount: number;
  sensorRecordsCount: number;
  productionEventsCount: number;
  linkedInspectionsCount: number;
  expertAnnotationsCount: number;
  confirmedLabelsCount: number;
  trainingReadyExamplesCount: number;
  unlabeledOrInvalidCount: number;
  requiredMinimumExamples: number;
  minimumTaxonomyClassesRepresented: number;
  activeTaxonomyClassesCount: number;
  tableCounts: {
    batches: number;
    machines: number;
    sensors: number;
    events: number;
    predictions: number;
    annotations: number;
    linkedInspections: number;
    trainingEligible: number;
  };
  blockers: string[];
  blockingReasons: string[];
  lastAuditedAt: string;
}> {
  ensureRootCauseAnnotationsTable();
  const db = getSqliteDb();
  const countTable = (t: string) => {
    try {
      const res = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get() as { c: number };
      return res?.c ?? 0;
    } catch {
      return 0;
    }
  };

  const batches = countTable("manufacturing_batches");
  const machines = countTable("manufacturing_machines");
  const sensors = countTable("sensor_measurements");
  const events = countTable("production_events");
  const predictions = countTable("root_cause_predictions");
  const annotations = countTable("root_cause_annotations");

  let linkedInspections = 0;
  let totalInspections = 0;
  let trainingEligible = 0;
  let activeTaxonomyClassesCount = 0;

  try {
    const totalRow = db.prepare("SELECT COUNT(*) as c FROM inspections").get() as { c: number };
    totalInspections = totalRow?.c ?? 0;

    const linkedRow = db.prepare("SELECT COUNT(*) as c FROM inspections WHERE batchId IS NOT NULL AND batchId != ''").get() as { c: number };
    linkedInspections = linkedRow?.c ?? 0;

    const eligibleRow = db.prepare(`
      SELECT COUNT(DISTINCT i.inspectionId) as c
      FROM inspections i
      INNER JOIN root_cause_annotations a ON i.inspectionId = a.inspectionId
      WHERE i.batchId IS NOT NULL AND i.batchId != ''
    `).get() as { c: number };
    trainingEligible = eligibleRow?.c ?? 0;

    const classRow = db.prepare("SELECT COUNT(DISTINCT confirmedCause) as c FROM root_cause_annotations WHERE confirmedCause IS NOT NULL AND confirmedCause != ''").get() as { c: number };
    activeTaxonomyClassesCount = classRow?.c ?? 0;
  } catch {
    // Fallback if inspections table not ready
  }

  const blockers: string[] = [];
  if (batches === 0) blockers.push("Zero manufacturing batches registered in database.");
  if (machines === 0) blockers.push("Zero fabrication machines registered in database.");
  if (sensors === 0) blockers.push("Zero SCADA / furnace sensor time-series measurements logged.");
  if (annotations === 0) blockers.push("Zero expert-confirmed root-cause annotations recorded in training set.");
  if (linkedInspections === 0 && totalInspections > 0) blockers.push("100% of stored Model 1 inspection records lack batchId and machineId linkage.");
  if (trainingEligible < 100) blockers.push(`Only ${trainingEligible}/100 minimum required training-eligible samples available.`);
  if (activeTaxonomyClassesCount < 5) blockers.push(`Only ${activeTaxonomyClassesCount}/5 minimum distinct root-cause taxonomy classes represented.`);

  const isBlocked = batches === 0 || machines === 0 || sensors === 0 || annotations === 0 || linkedInspections === 0;
  const isReady = trainingEligible >= 100 && activeTaxonomyClassesCount >= 5 && !isBlocked;
  const status: "DATASET_READY" | "DATASET_INCOMPLETE" | "DATASET_BLOCKED" = isReady ? "DATASET_READY" : (trainingEligible > 0 ? "DATASET_INCOMPLETE" : "DATASET_BLOCKED");

  return {
    status,
    datasetStatus: status,
    schemaVersion: "2.0.0",
    canonicalFeatureCount: 48,
    batchesCount: batches,
    machinesCount: machines,
    sensorRecordsCount: sensors,
    productionEventsCount: events,
    linkedInspectionsCount: linkedInspections,
    expertAnnotationsCount: annotations,
    confirmedLabelsCount: annotations,
    trainingReadyExamplesCount: trainingEligible,
    unlabeledOrInvalidCount: Math.max(0, totalInspections - trainingEligible),
    requiredMinimumExamples: 100,
    minimumTaxonomyClassesRepresented: 5,
    activeTaxonomyClassesCount,
    tableCounts: {
      batches,
      machines,
      sensors,
      events,
      predictions,
      annotations,
      linkedInspections,
      trainingEligible,
    },
    blockers,
    blockingReasons: blockers,
    lastAuditedAt: new Date().toISOString(),
  };
}
