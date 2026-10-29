/**
 * SolarVision AI — Model 2: Manufacturing Root Cause Analysis
 * Integration and Unit Test Suite for server/rootCause/
 */

import { describe, expect, it } from "vitest";
import {
  hasSufficientManufacturingData,
  SENSOR_SPECIFICATIONS,
  CANONICAL_FEATURE_ORDER,
  CANONICAL_FEATURES_V2,
  CANONICAL_FEATURE_COUNT_V2,
  FEATURE_SCHEMA_VERSION,
  ROOT_CAUSE_TAXONOMY,
  RECONCILED_ROOT_CAUSE_CATALOG,
} from "./featureContract";
import {
  formatPredictionsForPersistence,
  getManufacturingBatches,
  getManufacturingMachines,
  getSensorHistory,
  getProductionEvents,
  saveConfirmedRootCauseAnnotation,
  getConfirmedRootCauseAnnotations,
  getAllConfirmedRootCauseAnnotations,
  getRootCauseReadinessSummary,
} from "./dbContract";
import {
  validateAndPreviewCsv,
  commitImportCsv,
  linkInspectionToBatch,
  parseCsvText,
} from "./csvImport";
import { analyzeRootCause, getModel2Status } from "./service";
import { rootCauseAnalysisInputSchema } from "./routerHandler";
import type { RootCauseResponse } from "./types";

describe("Model 2: Root Cause Feature Contract", () => {
  it("correctly identifies when process data is missing", () => {
    expect(hasSufficientManufacturingData({})).toBe(false);
    expect(hasSufficientManufacturingData({ sensorMeasurements: [] })).toBe(false);
  });

  it("correctly identifies when manufacturing process data is present", () => {
    expect(
      hasSufficientManufacturingData({
        sensorMeasurements: [{ sensorType: "soldering_temp", measurementValue: 340 }],
      }),
    ).toBe(true);

    expect(
      hasSufficientManufacturingData({
        machine: { machineId: "M1", machineType: "stringer" },
      }),
    ).toBe(true);

    expect(
      hasSufficientManufacturingData({
        batch: { batchId: "B1", waferType: "mono" },
      }),
    ).toBe(true);

    expect(
      hasSufficientManufacturingData({
        productionEvents: [{ eventType: "thermal_drift" }],
      }),
    ).toBe(true);
  });

  it("exports valid sensor specifications and canonical taxonomies", () => {
    expect(SENSOR_SPECIFICATIONS.soldering_temp_top_c.nominalMean).toBe(225.0);
    expect(SENSOR_SPECIFICATIONS.lamination_temp_c.min).toBe(120.0);
    expect(CANONICAL_FEATURE_ORDER).toHaveLength(40);
    expect(ROOT_CAUSE_TAXONOMY).toContain("thermal_stress_soldering");
    expect(ROOT_CAUSE_TAXONOMY).toContain("mechanical_handling_impact");
  });

  it("exports Version 2.0.0 unified 48-feature specification", () => {
    expect(FEATURE_SCHEMA_VERSION).toBe("2.0.0");
    expect(CANONICAL_FEATURE_COUNT_V2).toBe(48);
    expect(CANONICAL_FEATURES_V2).toHaveLength(48);
    expect(CANONICAL_FEATURES_V2[0].name).toBe("defect_count_crack");
    expect(CANONICAL_FEATURES_V2[47].name).toBe("events_operator_override_flag");

    // Check Reconciled Catalog
    expect(RECONCILED_ROOT_CAUSE_CATALOG.thermal_stress_soldering.causeCode).toBe("RC-SOLD-01");
    expect(RECONCILED_ROOT_CAUSE_CATALOG.mechanical_handling_impact.causeCode).toBe("RC-MECH-01");
  });
});

describe("Model 2: Database Persistence Formatter", () => {
  it("formats ready root cause response into database records", () => {
    const mockResponse: RootCauseResponse = {
      inspectionId: "insp-001",
      batchId: "batch-A",
      machineId: "machine-B",
      status: "ready",
      modelVersion: "2.1.0",
      limitations: [],
      probableCauses: [
        {
          causeCode: "RC-SOLD-01",
          label: "Soldering Tip Drift",
          confidence: 0.88,
          recommendedAction: "Recalibrate PID controller",
          supportingEvidence: ["Temp +25°C anomaly"],
          featureImportance: { sensor_temp: 0.5 },
        },
      ],
    };

    const records = formatPredictionsForPersistence(mockResponse, 42);
    expect(records).toHaveLength(1);
    expect(records[0].inspectionId).toBe("insp-001");
    expect(records[0].defectId).toBe(42);
    expect(records[0].modelVersionId).toBe("2.1.0");
    expect(records[0].predictedCause).toBe("RC-SOLD-01: Soldering Tip Drift");
    expect(records[0].confidence).toBe(0.88);
    expect(records[0].recommendedAction).toBe("Recalibrate PID controller");
  });

  it("returns empty array when status is not_trained or missing_process_data", () => {
    const untrainedResponse: RootCauseResponse = {
      inspectionId: "insp-002",
      batchId: null,
      machineId: null,
      status: "not_trained",
      modelVersion: "none",
      limitations: ["Model not deployed"],
      probableCauses: [],
    };
    expect(formatPredictionsForPersistence(untrainedResponse)).toHaveLength(0);
  });
});

describe("Model 2: Manufacturing Data Query APIs", () => {
  it("queries manufacturing batches safely without crashing", async () => {
    const batches = await getManufacturingBatches({ limit: 10 });
    expect(Array.isArray(batches)).toBe(true);
  });

  it("queries manufacturing machines safely without crashing", async () => {
    const machines = await getManufacturingMachines();
    expect(Array.isArray(machines)).toBe(true);
  });

  it("queries sensor history telemetry safely", async () => {
    const history = await getSensorHistory({ limit: 10 });
    expect(Array.isArray(history)).toBe(true);
  });

  it("queries production events safely", async () => {
    const events = await getProductionEvents({ limit: 10 });
    expect(Array.isArray(events)).toBe(true);
  });

  it("saves and retrieves confirmed root cause annotations", async () => {
    const { getSqliteDb } = await import("../sqlite");
    const db = getSqliteDb();
    const existing = db.prepare("SELECT inspectionId FROM inspections LIMIT 1").get() as
      | { inspectionId: string }
      | undefined;
    const testInspectionId = "00675a4b-2d6e-41f8-8756-3a02b1d61218";

    // Ensure test inspection record exists in the database
    db.prepare(`
      INSERT OR IGNORE INTO inspections (inspectionId, sourceFilename, modelName, status, processingTimeMs, persistenceStatus, createdAt)
      VALUES (?, 'fixture_test.jpg', 'YOLO26n', 'completed', 10.0, 'sqlite_local', datetime('now'))
    `).run(testInspectionId);

    const annotId = await saveConfirmedRootCauseAnnotation({
      inspectionId: testInspectionId,
      defectId: null,
      confirmedCause: "thermal_stress_soldering",
      confidenceLevel: "confirmed",
      verifiedBy: "quality_eng_01",
      investigationNotes: "SEM analysis confirmed thermal microcrack",
    });
    expect(annotId).toBeDefined();

    const annots = await getConfirmedRootCauseAnnotations(testInspectionId);
    expect(annots.length).toBeGreaterThan(0);
    expect(annots[0].confirmedCause).toBe("thermal_stress_soldering");
    expect(annots[0].verifiedBy).toBe("quality_eng_01");
  });

  it("returns comprehensive data readiness summary", async () => {
    const summary = await getRootCauseReadinessSummary();
    expect(summary.schemaVersion).toBe("2.0.0");
    expect(summary.canonicalFeatureCount).toBe(48);
    expect(summary.tableCounts).toBeDefined();
    expect(typeof summary.tableCounts.batches).toBe("number");
  });
});

describe("Model 2: Orchestration Service", () => {
  it("rejects invalid inspection ID gracefully", async () => {
    // @ts-expect-error Testing invalid input type
    const res = await analyzeRootCause({ inspectionId: "" });
    expect(res.status).toBe("error");
    expect(res.limitations[0]).toContain("Invalid inspectionId");
  });

  it("returns missing_process_data early when no process data is supplied", async () => {
    const res = await analyzeRootCause({
      inspectionId: "insp-no-proc-data",
      detections: [
        { defectType: "crack", confidence: 0.9, x1: 10, y1: 10, x2: 50, y2: 50 },
      ],
    });

    expect(res.status).toBe("missing_process_data");
    expect(res.probableCauses).toEqual([]);
    expect(res.modelVersion).toBe("none");
    expect(res.limitations[0]).toContain("Missing manufacturing process telemetry");
  });

  it("invokes Python engine and returns not_trained truthfully when checkpoint does not exist", async () => {
    const res = await analyzeRootCause({
      inspectionId: "insp-with-telemetry-no-model",
      batchId: "batch-TEST-01",
      machineId: "machine-STR-01",
      detections: [
        { defectType: "soldering_defect", confidence: 0.85, x1: 10, y1: 10, x2: 50, y2: 50 },
      ],
      machine: {
        machineId: "machine-STR-01",
        machineType: "stringer",
        status: "operational",
      },
      sensorMeasurements: [
        { sensorType: "soldering_temp", measurementValue: 335.0, unit: "°C" },
      ],
    });

    expect(res.status).toBe("not_trained");
    expect(res.inspectionId).toBe("insp-with-telemetry-no-model");
    expect(res.batchId).toBe("batch-TEST-01");
    expect(res.machineId).toBe("machine-STR-01");
    expect(res.probableCauses).toEqual([]);
    expect(res.modelVersion).toBe("none");
    expect(res.limitations.some(lim => lim.toLowerCase().includes("not trained"))).toBe(true);
  });

  it("probes Model 2 status truthfully", async () => {
    const status = await getModel2Status();
    expect(status.modelName).toBe("SolarVision-RC-Model2");
    expect(status.isReady).toBe(false);
    expect(status.modelVersion).toBe("none");
    expect(status.unavailabilityReason).toBeDefined();
  });
});

describe("Model 2: Router Input Validation Schema", () => {
  it("validates well-formed inputs", () => {
    const valid = {
      inspectionId: "insp-schema-01",
      batchId: "b1",
      machineId: "m1",
      detections: [
        { defectType: "crack", confidence: 0.8, x1: 0, y1: 0, x2: 10, y2: 10 },
      ],
      sensorMeasurements: [
        { sensorType: "laminator_temp", measurementValue: 145.0 },
      ],
    };
    const parsed = rootCauseAnalysisInputSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("rejects input missing inspectionId", () => {
    const invalid = {
      batchId: "b1",
    };
    const parsed = rootCauseAnalysisInputSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid detection confidence values", () => {
    const invalid = {
      inspectionId: "insp-01",
      detections: [
        { defectType: "crack", confidence: 1.5, x1: 0, y1: 0, x2: 10, y2: 10 },
      ],
    };
    const parsed = rootCauseAnalysisInputSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});

describe("Model 2: CSV Import Engine & Validation (Stage 1 Preview)", () => {
  it("successfully previews a valid batches CSV", () => {
    const csv = `batch_id,batch_number,wafer_supplier,ingot_type,cell_line,target_quantity,actual_quantity,start_time,end_time,status
B-TEST-100,LOT-2026-001,VendorA,monocrystalline_m10,Line-1,1000,990,2026-10-22T08:00:00Z,2026-10-22T16:00:00Z,completed`;
    const report = validateAndPreviewCsv("batches", csv, "test_batches.csv");
    expect(report.isValid).toBe(true);
    expect(report.totalRows).toBe(1);
    expect(report.validRows).toBe(1);
    expect(report.invalidRows).toBe(0);
    expect(report.missingRequiredColumns).toEqual([]);
    expect(report.parsedRows[0].batch_id).toBe("B-TEST-100");
  });

  it("detects missing required columns", () => {
    const csv = `batch_number,cell_line,status
LOT-001,Line-1,completed`;
    const report = validateAndPreviewCsv("batches", csv);
    expect(report.isValid).toBe(false);
    expect(report.missingRequiredColumns).toContain("batch_id");
    expect(report.missingRequiredColumns).toContain("target_quantity");
    expect(report.missingRequiredColumns).toContain("start_time");
  });

  it("rejects out-of-range sensor measurements against physical bounds", () => {
    // SENSOR_SPECIFICATIONS.soldering_temp_top_c has max 300.0°C
    const csv = `id,machine_id,sensor_type,measurement_value,unit,recorded_at
SENS-999,M-STR-01,soldering_temp_top_c,550.0,C,2026-10-22T09:00:00Z`;
    const report = validateAndPreviewCsv("sensor_readings", csv);
    expect(report.isValid).toBe(false);
    expect(report.invalidRows).toBe(1);
    expect(report.rowErrors.some(e => e.message.includes("outside valid physical bounds"))).toBe(true);
  });

  it("rejects unknown root cause taxonomy entries", () => {
    const csv = `id,inspection_id,defect_id,confirmed_cause,confidence_level,verified_by,verified_at,investigation_notes
AN-01,00675a4b-2d6e-41f8-8756-3a02b1d61218,,alien_interference,confirmed,quality_eng_01,2026-10-22T10:00:00Z,notes`;
    const report = validateAndPreviewCsv("root_cause_annotations", csv);
    expect(report.isValid).toBe(false);
    expect(report.rowErrors.some(e => e.message.includes("not recognized in the root-cause taxonomy"))).toBe(true);
  });
});

describe("Model 2: CSV Ingestion Engine & Database Commit (Stage 2 Commit)", () => {
  it("atomically commits batches and machines to the database", () => {
    const batchCsv = `batch_id,batch_number,wafer_supplier,ingot_type,cell_line,target_quantity,actual_quantity,start_time,end_time,status
B-API-TEST-01,LOT-API-001,VendorX,topcon_m10,Line-A,2500,2480,2026-10-22T07:00:00Z,,in_production`;
    const batchRes = commitImportCsv("batches", batchCsv, { operatorName: "test_engineer" });
    expect(batchRes.success).toBe(true);
    expect(batchRes.status).toBe("SUCCESS");
    expect(batchRes.insertedRecords).toBe(1);

    const machineCsv = `machine_id,machine_code,machine_type,line_id,location,status,last_maintenance_at,next_maintenance_due
M-API-TEST-01,STR-99,stringer,Line-A,Bay-3,running,2026-10-01T00:00:00Z,2026-11-01T00:00:00Z`;
    const machineRes = commitImportCsv("machines", machineCsv, { operatorName: "test_engineer" });
    expect(machineRes.success).toBe(true);
    expect(machineRes.status).toBe("SUCCESS");
    expect(machineRes.insertedRecords).toBe(1);
  });

  it("atomically commits sensor telemetry linked to existing machine", () => {
    const sensorCsv = `id,machine_id,batch_id,sensor_type,measurement_value,unit,is_anomaly,anomaly_score,recorded_at
SENS-API-01,M-API-TEST-01,B-API-TEST-01,soldering_temp_top_c,228.5,C,0,,2026-10-22T10:15:00Z`;
    const sensorRes = commitImportCsv("sensor_readings", sensorCsv, { operatorName: "test_engineer" });
    expect(sensorRes.success).toBe(true);
    expect(sensorRes.insertedRecords).toBe(1);
  });

  it("rolls back cleanly on transaction failure", () => {
    // Malformed rows that fail during insert
    const invalidBatch = `batch_id,batch_number,cell_line,target_quantity,start_time,status
B-FAIL-01,LOT-FAIL,Line-1,invalid_qty,2026-10-22T08:00:00Z,in_production`;
    const res = commitImportCsv("batches", invalidBatch);
    expect(res.success).toBe(false);
    expect(res.status).toBe("REJECTED");
    expect(res.insertedRecords).toBe(0);
  });
});

describe("Model 2: Inspection Linking & Dynamic Readiness", () => {
  it("links an inspection to verified manufacturing batch and machine", async () => {
    const { getSqliteDb } = await import("../sqlite");
    const db = getSqliteDb();
    const existing = db.prepare("SELECT inspectionId FROM inspections LIMIT 1").get() as
      | { inspectionId: string }
      | undefined;
    const testInspectionId = "00675a4b-2d6e-41f8-8756-3a02b1d61218";

    // Ensure test inspection record exists in the database
    db.prepare(`
      INSERT OR IGNORE INTO inspections (inspectionId, sourceFilename, modelName, status, processingTimeMs, persistenceStatus, createdAt)
      VALUES (?, 'fixture_test.jpg', 'YOLO26n', 'completed', 10.0, 'sqlite_local', datetime('now'))
    `).run(testInspectionId);

    const linkRes = await linkInspectionToBatch({
      inspectionId: testInspectionId,
      batchId: "B-API-TEST-01",
      machineId: "M-API-TEST-01",
      waferPosition: "slot-12",
    });

    expect(linkRes.success).toBe(true);
    expect(linkRes.inspectionId).toBe(testInspectionId);
    expect(linkRes.batchId).toBe("B-API-TEST-01");
    expect(linkRes.machineId).toBe("M-API-TEST-01");

    // Verify in database
    const row = db.prepare("SELECT batchId, machineId FROM inspections WHERE inspectionId = ?").get(testInspectionId) as any;
    expect(row.batchId).toBe("B-API-TEST-01");
    expect(row.machineId).toBe("M-API-TEST-01");
  });

  it("rejects linking with nonexistent batch ID", async () => {
    await expect(
      linkInspectionToBatch({
        inspectionId: "some-insp",
        batchId: "nonexistent-batch-id-9999",
        machineId: "M-API-TEST-01",
      })
    ).rejects.toThrow("does not exist");
  });

  it("reflects live database counts in getRootCauseReadinessSummary", async () => {
    const summary = await getRootCauseReadinessSummary();
    expect(summary.schemaVersion).toBe("2.0.0");
    expect(summary.canonicalFeatureCount).toBe(48);
    expect(summary.batchesCount).toBeGreaterThanOrEqual(1);
    expect(summary.machinesCount).toBeGreaterThanOrEqual(1);
    expect(summary.sensorRecordsCount).toBeGreaterThanOrEqual(1);
    expect(summary.linkedInspectionsCount).toBeGreaterThanOrEqual(1);
    expect(typeof summary.trainingReadyExamplesCount).toBe("number");
    expect(Array.isArray(summary.blockers)).toBe(true);
  });

  it("queries all confirmed root cause annotations", async () => {
    const annotations = await getAllConfirmedRootCauseAnnotations({ limit: 10 });
    expect(Array.isArray(annotations)).toBe(true);
    expect(annotations.length).toBeGreaterThan(0);
  });
});
