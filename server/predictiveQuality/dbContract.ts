/**
 * SolarVision AI — Model 3: Predictive Quality Monitoring
 * Database Persistence Specification and Bridge
 */

import { getSqliteDb } from "../sqlite";
import type { PredictiveQualityResponse, PredictiveQualityDbRecord } from "./types";

/**
 * Formats a PredictiveQualityResponse into database persistence records
 * for the `predictive_quality_forecasts` table.
 */
export function formatForecastForPersistence(
  response: PredictiveQualityResponse,
): PredictiveQualityDbRecord | null {
  if (response.status !== "ready" || !response.batchId) {
    return null;
  }

  const defectRate = response.predictedDefectRate ?? 0.0;
  const yieldPct = response.predictedYield ?? (100.0 * (1.0 - defectRate));

  return {
    id: `pq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    batchId: response.batchId,
    modelVersionId: response.modelVersion !== "none" ? response.modelVersion : null,
    predictedDefectRate: defectRate,
    predictedYield: yieldPct,
    riskLevel: response.riskLevel,
    forecastHorizonHours: 24,
    confidenceIntervalLow: response.confidenceInterval?.low ?? null,
    confidenceIntervalHigh: response.confidenceInterval?.high ?? null,
    factors: response.topRiskFactors && response.topRiskFactors.length > 0
      ? JSON.stringify(response.topRiskFactors)
      : null,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Persists a validated Model 3 forecast into SQLite.
 */
export async function persistQualityForecast(
  response: PredictiveQualityResponse,
): Promise<boolean> {
  const record = formatForecastForPersistence(response);
  if (!record) return false;

  try {
    const db = getSqliteDb();

    // Check if modelVersionId exists in model_versions table to prevent foreign key failure
    let safeModelVersionId: string | null = null;
    if (record.modelVersionId) {
      try {
        const mv = db.prepare("SELECT id FROM model_versions WHERE id = ?").get(record.modelVersionId);
        if (mv) {
          safeModelVersionId = record.modelVersionId;
        }
      } catch {
        safeModelVersionId = null;
      }
    }

    const stmt = db.prepare(`
      INSERT INTO predictive_quality_forecasts (
        id, batchId, modelVersionId, predictedDefectRate,
        predictedYield, riskLevel, forecastHorizonHours,
        confidenceIntervalLow, confidenceIntervalHigh, factors, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec("BEGIN IMMEDIATE;");
    try {
      stmt.run(
        record.id,
        record.batchId,
        safeModelVersionId,
        record.predictedDefectRate,
        record.predictedYield,
        record.riskLevel,
        record.forecastHorizonHours,
        record.confidenceIntervalLow ?? null,
        record.confidenceIntervalHigh ?? null,
        record.factors ?? null,
        record.createdAt,
      );
      db.exec("COMMIT;");
      return true;
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }
  } catch (err) {
    console.warn(`[PredictiveQuality] SQLite persistence error for batch ${response.batchId}:`, err);
    return false;
  }
}

/**
 * Retrieves historical predictive quality forecasts.
 */
export async function getQualityForecasts(filters?: {
  batchId?: string;
  riskLevel?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const db = getSqliteDb();
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

  query += " ORDER BY createdAt DESC LIMIT ? OFFSET ?";
  params.push(filters?.limit ?? 50, filters?.offset ?? 0);

  const rows = db.prepare(query).all(...params);
  return rows.map((r: any) => ({
    ...r,
    factors: r.factors ? JSON.parse(r.factors) : null,
  }));
}

/**
 * Retrieves a single forecast by ID.
 */
export async function getQualityForecastById(id: string): Promise<any | null> {
  const db = getSqliteDb();
  const row = db.prepare("SELECT * FROM predictive_quality_forecasts WHERE id = ?").get(id);
  if (!row) return null;
  return {
    ...row,
    factors: (row as any).factors ? JSON.parse((row as any).factors) : null,
  };
}

/**
 * Provides a dynamic readiness summary for Model 3.
 */
export async function getQualityReadinessSummary(): Promise<{
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
  const db = getSqliteDb();
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
