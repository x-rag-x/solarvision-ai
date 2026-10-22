/**
 * SolarVision AI — Model 3: Predictive Quality Monitoring
 * Canonical Database Persistence Specification, Schema Migration & Query Bridge
 */

import type { DatabaseSync } from "node:sqlite";
import { getSqliteDb, ensureQualitySchema } from "../sqlite";
import type {
  PredictiveQualityResponse,
  PredictiveQualityDbRecord,
  QualityForecastRecord,
  QualityRequesterContext,
  QualityHistoryQueryOptions,
  RiskFactor,
  ModelDomain,
  QualityOutcome,
  RiskLevel,
} from "./types";

export { ensureQualitySchema };

/**
 * Formats a PredictiveQualityResponse into a canonical persistence record
 * for the `predictive_quality_forecasts` table.
 */
export function formatForecastForPersistence(
  response: PredictiveQualityResponse,
  context?: QualityRequesterContext & { inputReference?: string; waferId?: string },
): PredictiveQualityDbRecord | null {
  if (response.status !== "ready") {
    return null;
  }

  const isBenchmark =
    response.domain === "semiconductor_benchmark" ||
    !!response.modelMetadata?.isBenchmark;

  const failureProb =
    response.probabilities?.fail ?? response.predictedDefectRate ?? null;
  const defectRate = response.predictedDefectRate ?? failureProb ?? null;

  // Scientific Truthfulness: Never claim synthetic semiconductor benchmark output
  // is measured solar cell production yield. Only real solar domain forecasts may have yield.
  const yieldPct = isBenchmark
    ? null
    : response.predictedYield ??
      (defectRate != null ? Number((100.0 * (1.0 - defectRate)).toFixed(2)) : null);

  const nowStr = new Date().toISOString();
  const factorsJson =
    response.topRiskFactors && response.topRiskFactors.length > 0
      ? JSON.stringify(response.topRiskFactors)
      : null;
  const probabilitiesJson =
    response.probabilities && Object.keys(response.probabilities).length > 0
      ? JSON.stringify(response.probabilities)
      : null;

  return {
    id: `pq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    batchId: response.batchId ?? null,
    machineId: response.machineId ?? null,
    waferId: context?.waferId ?? null,
    userId: context?.userId ?? null,
    modelVersionId: response.modelVersion !== "none" ? response.modelVersion : null,
    modelVersion: response.modelVersion ?? null,
    domain: response.domain,
    isBenchmark: isBenchmark ? 1 : 0,
    dataSource: isBenchmark ? "uci_secom_benchmark" : "solar_cell_manufacturing_line",
    provenance: isBenchmark
      ? "uci_secom_semiconductor_benchmark_2008"
      : "solarvision_factory_telemetry",
    qualityOutcome: response.qualityOutcome ?? "unknown",
    riskLevel: response.riskLevel ?? "unknown",
    failureProbability: failureProb != null ? Number(failureProb) : null,
    predictedDefectRate: defectRate != null ? Number(defectRate) : null,
    predictedYield: yieldPct != null ? Number(yieldPct) : null,
    confidence: response.confidence != null ? Number(response.confidence) : null,
    forecastHorizonHours: 24,
    confidenceIntervalLow: response.confidenceInterval?.low ?? null,
    confidenceIntervalHigh: response.confidenceInterval?.high ?? null,
    confidenceInterval: response.confidenceInterval
      ? JSON.stringify(response.confidenceInterval)
      : null,
    topRiskFactors: factorsJson,
    factors: factorsJson,
    probabilities: probabilitiesJson,
    inputReference: context?.inputReference ?? null,
    recommendedAction: response.recommendedAction ?? null,
    createdAt: nowStr,
    generatedAt: nowStr,
  };
}

/**
 * Persists a validated Model 3 forecast into SQLite atomically.
 * Returns true on success and attaches persistedId to the response object.
 * Throws explicit errors on persistence or constraint failures.
 */
export async function persistQualityForecast(
  response: PredictiveQualityResponse,
  context?: QualityRequesterContext & { inputReference?: string; waferId?: string },
  customDb?: DatabaseSync,
): Promise<boolean> {
  if (response.status !== "ready") {
    return false;
  }

  const record = formatForecastForPersistence(response, context);
  if (!record) return false;

  const db = customDb || getSqliteDb();
  ensureQualitySchema(db);

  // Validate foreign keys safely without destructive parent record alteration
  let safeBatchId: string | null = null;
  if (record.batchId) {
    try {
      const b = db
        .prepare("SELECT id FROM manufacturing_batches WHERE id = ?")
        .get(record.batchId);
      if (b) {
        safeBatchId = record.batchId;
      } else {
        // Preserve unlinked batch identifier in inputReference
        if (!record.inputReference) {
          record.inputReference = `batch:${record.batchId}`;
        }
      }
    } catch {
      safeBatchId = null;
    }
  }

  let safeModelVersionId: string | null = null;
  if (record.modelVersionId) {
    try {
      const mv = db
        .prepare("SELECT id FROM model_versions WHERE id = ?")
        .get(record.modelVersionId);
      if (mv) {
        safeModelVersionId = record.modelVersionId;
      }
    } catch {
      safeModelVersionId = null;
    }
  }

  let safeMachineId: string | null = null;
  if (record.machineId) {
    try {
      const m = db
        .prepare("SELECT id FROM manufacturing_machines WHERE id = ?")
        .get(record.machineId);
      if (m) {
        safeMachineId = record.machineId;
      }
    } catch {
      safeMachineId = null;
    }
  }

  const stmt = db.prepare(`
    INSERT INTO predictive_quality_forecasts (
      id, batchId, machineId, waferId, userId,
      modelVersionId, modelVersion, domain, isBenchmark,
      dataSource, provenance, qualityOutcome, riskLevel,
      failureProbability, predictedDefectRate, predictedYield,
      confidence, confidenceIntervalLow, confidenceIntervalHigh,
      confidenceInterval, forecastHorizonHours, topRiskFactors,
      factors, probabilities, inputReference, recommendedAction,
      createdAt, generatedAt
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )
  `);

  db.exec("BEGIN IMMEDIATE;");
  try {
    stmt.run(
      record.id,
      safeBatchId,
      safeMachineId,
      record.waferId ?? null,
      record.userId ?? null,
      safeModelVersionId,
      record.modelVersion ?? null,
      record.domain,
      record.isBenchmark ? 1 : 0,
      record.dataSource ?? null,
      record.provenance ?? null,
      record.qualityOutcome,
      record.riskLevel,
      record.failureProbability !== undefined ? record.failureProbability : null,
      record.predictedDefectRate !== undefined ? record.predictedDefectRate : null,
      record.predictedYield !== undefined ? record.predictedYield : null,
      record.confidence !== undefined ? record.confidence : null,
      record.confidenceIntervalLow !== undefined ? record.confidenceIntervalLow : null,
      record.confidenceIntervalHigh !== undefined ? record.confidenceIntervalHigh : null,
      record.confidenceInterval ?? null,
      record.forecastHorizonHours ?? 24,
      record.topRiskFactors ?? null,
      record.factors ?? null,
      record.probabilities ?? null,
      record.inputReference ?? null,
      record.recommendedAction ?? null,
      record.createdAt,
      record.generatedAt ?? record.createdAt,
    );
    db.exec("COMMIT;");

    // Attach persisted assessment ID to caller response
    (response as any).persistedId = record.id;
    return true;
  } catch (err) {
    db.exec("ROLLBACK;");
    console.error(`[PredictiveQuality] SQLite persistence transaction failed for batch ${record.batchId}:`, err);
    throw err;
  }
}

/**
 * Persists a forecast and returns the full QualityForecastRecord.
 */
export async function saveQualityAssessment(
  response: PredictiveQualityResponse,
  context?: QualityRequesterContext & { inputReference?: string; waferId?: string },
  customDb?: DatabaseSync,
): Promise<QualityForecastRecord> {
  const success = await persistQualityForecast(response, context, customDb);
  if (!success) {
    throw new Error("Cannot save quality assessment: response status is not ready");
  }

  const persistedId = (response as any).persistedId;
  const saved = await getQualityForecastById(persistedId, { role: "admin" }, customDb);
  if (!saved) {
    throw new Error(`Failed to reload saved assessment with ID '${persistedId}'`);
  }
  return saved;
}

/**
 * Transforms a raw SQLite row into a strongly-typed QualityForecastRecord.
 */
function formatDbRowToRecord(r: any): QualityForecastRecord {
  let parsedFactors: RiskFactor[] | null = null;
  if (r.topRiskFactors) {
    try {
      parsedFactors = JSON.parse(r.topRiskFactors);
    } catch {}
  } else if (r.factors) {
    try {
      parsedFactors = JSON.parse(r.factors);
    } catch {}
  }

  let parsedProbabilities: Record<string, number> | null = null;
  if (r.probabilities) {
    try {
      parsedProbabilities = JSON.parse(r.probabilities);
    } catch {}
  }

  const failureProb =
    r.failureProbability != null
      ? Number(r.failureProbability)
      : r.predictedDefectRate != null
      ? Number(r.predictedDefectRate)
      : null;

  const defectRate =
    r.predictedDefectRate != null
      ? Number(r.predictedDefectRate)
      : failureProb;

  return {
    id: String(r.id),
    batchId: r.batchId ? String(r.batchId) : null,
    machineId: r.machineId ? String(r.machineId) : null,
    waferId: r.waferId ? String(r.waferId) : null,
    userId: r.userId ? String(r.userId) : null,
    modelVersionId: r.modelVersionId ? String(r.modelVersionId) : null,
    modelVersion: r.modelVersion ? String(r.modelVersion) : null,
    domain: (r.domain ?? "solar_cell_manufacturing") as ModelDomain,
    isBenchmark: Boolean(r.isBenchmark),
    dataSource: r.dataSource ? String(r.dataSource) : null,
    provenance: r.provenance ? String(r.provenance) : null,
    qualityOutcome: (r.qualityOutcome ?? "unknown") as QualityOutcome,
    riskLevel: (r.riskLevel ?? "unknown") as RiskLevel,
    failureProbability: failureProb,
    predictedDefectRate: defectRate,
    predictedYield: r.predictedYield != null ? Number(r.predictedYield) : null,
    confidence: r.confidence != null ? Number(r.confidence) : null,
    confidenceIntervalLow:
      r.confidenceIntervalLow != null ? Number(r.confidenceIntervalLow) : null,
    confidenceIntervalHigh:
      r.confidenceIntervalHigh != null ? Number(r.confidenceIntervalHigh) : null,
    forecastHorizonHours: Number(r.forecastHorizonHours ?? 24),
    topRiskFactors: parsedFactors,
    factors: parsedFactors,
    probabilities: parsedProbabilities,
    inputReference: r.inputReference ? String(r.inputReference) : null,
    recommendedAction: r.recommendedAction ? String(r.recommendedAction) : null,
    createdAt: String(r.createdAt || r.generatedAt || new Date().toISOString()),
    generatedAt: String(r.generatedAt || r.createdAt || new Date().toISOString()),
  };
}

/**
 * Retrieves historical predictive quality forecasts with filtering,
 * pagination, and multi-tenant user isolation.
 */
export async function getQualityForecasts(
  filters?: QualityHistoryQueryOptions,
  context?: QualityRequesterContext,
  customDb?: DatabaseSync,
): Promise<QualityForecastRecord[]> {
  const db = customDb || getSqliteDb();
  ensureQualitySchema(db);

  let query = "SELECT * FROM predictive_quality_forecasts WHERE 1=1";
  const params: any[] = [];

  if (filters?.batchId) {
    query += " AND batchId = ?";
    params.push(filters.batchId);
  }
  if (filters?.riskLevel) {
    query += " AND riskLevel = ?";
    params.push(filters.riskLevel);
  }
  if (filters?.domain) {
    query += " AND domain = ?";
    params.push(filters.domain);
  }
  if (filters?.isBenchmark !== undefined) {
    query += " AND isBenchmark = ?";
    params.push(filters.isBenchmark ? 1 : 0);
  }

  // Multi-tenant Access Scoping:
  // - Admins: global visibility across all forecasts.
  // - Authenticated users: view own forecasts (userId = context.userId),
  //   unowned legacy baseline records (userId IS NULL), and benchmark demo records (isBenchmark = 1).
  // - Other users' private solar production forecasts are strictly excluded.
  if (context?.role !== "admin") {
    if (context?.userId) {
      query += " AND (userId = ? OR userId IS NULL OR isBenchmark = 1)";
      params.push(context.userId);
    } else {
      query += " AND (userId IS NULL OR isBenchmark = 1)";
    }
  }

  query += " ORDER BY createdAt DESC LIMIT ? OFFSET ?";
  params.push(filters?.limit ?? 50, filters?.offset ?? 0);

  const rows = db.prepare(query).all(...params) as any[];
  return rows.map((r: any) => formatDbRowToRecord(r));
}

/**
 * Retrieves a single forecast by ID with multi-tenant access control.
 */
export async function getQualityForecastById(
  id: string,
  context?: QualityRequesterContext,
  customDb?: DatabaseSync,
): Promise<QualityForecastRecord | null> {
  const db = customDb || getSqliteDb();
  ensureQualitySchema(db);

  const row = db
    .prepare("SELECT * FROM predictive_quality_forecasts WHERE id = ?")
    .get(id) as any;
  if (!row) return null;

  const record = formatDbRowToRecord(row);

  // Cross-user access enforcement:
  // Admin, benchmark runs, or unowned records can be accessed.
  if (context?.role === "admin" || record.isBenchmark || record.userId === null) {
    return record;
  }
  if (context?.userId && record.userId === context.userId) {
    return record;
  }

  // Cross-user access to private user records denied
  return null;
}

/**
 * Provides a dynamic readiness summary for Model 3.
 */
export async function getQualityReadinessSummary(customDb?: DatabaseSync): Promise<{
  schemaVersion: string;
  canonicalFeatureCount: number;
  datasetStatus: "DATASET_BLOCKED" | "READY";
  tableCounts: {
    forecasts: number;
    batches: number;
    sensorReadings: number;
  };
  blockingReasons: string[];
}> {
  const db = customDb || getSqliteDb();
  ensureQualitySchema(db);

  const countTable = (t: string) => {
    try {
      const res = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get() as { c: number };
      return res?.c ?? 0;
    } catch {
      return 0;
    }
  };

  const forecasts = countTable("predictive_quality_forecasts");
  const batches = countTable("manufacturing_batches");
  const sensorReadings = countTable("sensor_measurements");

  const isBlocked = batches === 0 || sensorReadings === 0;

  return {
    schemaVersion: "1.0.0",
    canonicalFeatureCount: 32,
    datasetStatus: isBlocked ? "DATASET_BLOCKED" : "READY",
    tableCounts: {
      forecasts,
      batches,
      sensorReadings,
    },
    blockingReasons: isBlocked
      ? [
          "Zero historical manufacturing quality outcome labels available in database.",
          "Model 3 production checkpoint training requires validated factory yield data.",
          "Active artifact status is 'not_trained'; zero synthetic forecasts will be served in production.",
        ]
      : [],
  };
}
