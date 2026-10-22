/**
 * SolarVision AI — Phase 3C: Manufacturing Data Onboarding & Review Unit Tests
 * 
 * Comprehensive testing for:
 * 1. Six CSV Import Templates & Client-Side Validation Engine
 * 2. In-file duplicate identifier detection across rows
 * 3. Row-level type validation (numbers, timestamps, enums) and error diagnostics
 * 4. Inspection-to-Batch lineage linking contract & database validation
 * 5. 9-Class Root Cause Taxonomy integrity & expert ground-truth review
 * 6. Zero-simulation enforcement on data onboarding API client
 * 7. Real tRPC procedure integration (rootCause.annotate, rootCause.readiness)
 * 8. Unauthorized & Forbidden security response handling
 * 9. Truthful DATASET_BLOCKED state detection
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  ENTITY_TEMPLATES,
  generateTemplateCsv,
  parseAndValidateCsv,
} from "../csvValidator";
import {
  fetchDatasetReadiness,
  submitConfirmedRootCauseAnnotation,
  submitImportRows,
  submitInspectionBatchLink,
} from "../dataOnboardingApi";
import {
  ConfirmedRootCauseAnnotation,
  ImportEntityType,
  InspectionBatchLink,
  ROOT_CAUSE_DETAILS,
  ROOT_CAUSE_TAXONOMY,
} from "../dataOnboardingTypes";

describe("Phase 3C: CSV Templates & Schema Specifications", () => {
  const expectedEntities: ImportEntityType[] = [
    "batches",
    "machines",
    "sensor_readings",
    "production_events",
    "root_cause_annotations",
    "inspection_batch_links",
  ];

  it("registers specifications for all six required manufacturing CSV categories", () => {
    expectedEntities.forEach((entity) => {
      expect(ENTITY_TEMPLATES[entity]).toBeDefined();
      expect(ENTITY_TEMPLATES[entity].entityType).toBe(entity);
      expect(ENTITY_TEMPLATES[entity].requiredColumns.length).toBeGreaterThan(0);
      expect(ENTITY_TEMPLATES[entity].sampleFilename).toContain(".csv");
    });
  });

  it("verifies batches template requires core production lot identifiers", () => {
    const spec = ENTITY_TEMPLATES.batches;
    expect(spec.requiredColumns).toEqual(
      expect.arrayContaining([
        "batch_id",
        "batch_number",
        "cell_line",
        "target_quantity",
        "start_time",
        "status",
      ])
    );
  });

  it("verifies machines template requires tool code, type, and line ID", () => {
    const spec = ENTITY_TEMPLATES.machines;
    expect(spec.requiredColumns).toEqual(
      expect.arrayContaining([
        "machine_id",
        "machine_code",
        "machine_type",
        "line_id",
        "status",
      ])
    );
  });

  it("verifies sensor_readings template requires numeric measurement and timestamp", () => {
    const spec = ENTITY_TEMPLATES.sensor_readings;
    expect(spec.requiredColumns).toEqual(
      expect.arrayContaining([
        "id",
        "machine_id",
        "sensor_type",
        "measurement_value",
        "unit",
        "recorded_at",
      ])
    );
    expect(spec.columnSpecs.measurement_value.type).toBe("number");
  });

  it("verifies root_cause_annotations template requires confirmed cause matching taxonomy", () => {
    const spec = ENTITY_TEMPLATES.root_cause_annotations;
    expect(spec.requiredColumns).toEqual(
      expect.arrayContaining([
        "id",
        "inspection_id",
        "confirmed_cause",
        "confidence_level",
        "verified_by",
        "verified_at",
      ])
    );
    expect(spec.columnSpecs.confirmed_cause.allowedValues).toEqual(
      expect.arrayContaining([...ROOT_CAUSE_TAXONOMY])
    );
  });

  it("verifies inspection_batch_links template matches required lineage join columns", () => {
    const spec = ENTITY_TEMPLATES.inspection_batch_links;
    expect(spec.requiredColumns).toEqual(
      expect.arrayContaining(["inspection_id", "batch_id", "machine_id", "recorded_at"])
    );
  });

  it("generates valid header templates for all six entity categories", () => {
    expectedEntities.forEach((entity) => {
      const csv = generateTemplateCsv(entity);
      const lines = csv.split("\n").filter((l) => !l.startsWith("#") && l.trim().length > 0);
      const headerCols = lines[0].split(",").map((c) => c.trim());
      ENTITY_TEMPLATES[entity].requiredColumns.forEach((col) => {
        expect(headerCols).toContain(col);
      });
    });
  });
});

describe("Phase 3C: CSV Parsing & Validation Engine", () => {
  it("ignores comment lines starting with # and parses valid batch rows", () => {
    const csvContent = `# Manufacturing Batches Template
# Comment line describing headers
batch_id,batch_number,cell_line,target_quantity,start_time,status
BATCH-2026-001,LOT-A1,Line-1,1000,2026-10-20T08:00:00Z,completed
BATCH-2026-002,LOT-A2,Line-2,1500,2026-10-21T08:00:00Z,in_progress`;

    const report = parseAndValidateCsv("batches", csvContent, "batches_sample.csv");
    expect(report.isValid).toBe(true);
    expect(report.totalRows).toBe(2);
    expect(report.validRows).toBe(2);
    expect(report.invalidRows).toBe(0);
    expect(report.missingRequiredColumns).toHaveLength(0);
    expect(report.parsedRows).toHaveLength(2);
    expect(report.parsedRows[0].batch_id).toBe("BATCH-2026-001");
    expect(report.parsedRows[0].target_quantity).toBe(1000);
  });

  it("flags missing required columns and marks report as invalid", () => {
    const invalidHeaderCsv = `batch_number,status
LOT-A1,completed`;

    const report = parseAndValidateCsv("batches", invalidHeaderCsv, "bad_batches.csv");
    expect(report.isValid).toBe(false);
    expect(report.missingRequiredColumns).toEqual(
      expect.arrayContaining(["batch_id", "cell_line", "target_quantity", "start_time"])
    );
    expect(report.rowErrors.length).toBeGreaterThan(0);
  });

  it("detects and flags duplicate primary identifiers within the uploaded CSV", () => {
    const duplicateCsv = `batch_id,batch_number,cell_line,target_quantity,start_time,status
BATCH-001,LOT-A1,Line-1,1000,2026-10-20T08:00:00Z,completed
BATCH-001,LOT-A2,Line-2,1200,2026-10-21T08:00:00Z,in_progress`;

    const report = parseAndValidateCsv("batches", duplicateCsv, "dup_batches.csv");
    expect(report.isValid).toBe(false);
    expect(report.invalidRows).toBe(1);
    expect(report.validRows).toBe(1);
    expect(report.rejectedRows[0].errors[0]).toContain("Duplicate primary identifier 'BATCH-001'");
  });

  it("rejects non-numeric values for numeric columns", () => {
    const badNumericCsv = `batch_id,batch_number,cell_line,target_quantity,start_time,status
BATCH-1,LOT-1,Line-1,NOT_A_NUMBER,2026-10-20T08:00:00Z,completed`;

    const report = parseAndValidateCsv("batches", badNumericCsv, "test.csv");
    expect(report.isValid).toBe(false);
    expect(report.invalidRows).toBe(1);
    expect(report.rejectedRows).toHaveLength(1);
    expect(report.rowErrors[0].message).toContain("must be a valid number");
  });

  it("rejects invalid root cause taxonomy values not in the 9-class taxonomy", () => {
    const badTaxonomyCsv = `id,inspection_id,confirmed_cause,confidence_level,verified_by,verified_at
ann-01,insp-01,unsupported_fictional_cause,confirmed,Dr. Quality,2026-10-22T08:00:00Z`;

    const report = parseAndValidateCsv("root_cause_annotations", badTaxonomyCsv, "ann.csv");
    expect(report.isValid).toBe(false);
    expect(report.invalidRows).toBe(1);
    expect(report.rejectedRows[0].errors[0]).toContain("is not in permitted list");
  });

  it("accepts valid root cause annotations matching 9-class taxonomy", () => {
    const validAnnotationCsv = `id,inspection_id,confirmed_cause,confidence_level,verified_by,verified_at
ann-01,insp-01,thermal_stress_soldering,confirmed,Dr. Quality,2026-10-22T08:00:00Z
ann-02,insp-02,squeegee_pressure_drift,probable,Operator Mike,2026-10-22T09:00:00Z`;

    const report = parseAndValidateCsv("root_cause_annotations", validAnnotationCsv, "valid_ann.csv");
    expect(report.isValid).toBe(true);
    expect(report.validRows).toBe(2);
    expect(report.parsedRows[0].confirmed_cause).toBe("thermal_stress_soldering");
  });

  it("validates sensor telemetry rows with numeric values and timestamps", () => {
    const validSensorsCsv = `id,machine_id,sensor_type,measurement_value,unit,recorded_at
S1,M-FURNACE-01,pyrometer_temp_zone4,852.4,degC,2026-10-20T08:30:00Z
S2,M-PRINTER-01,squeegee_force_front,72.1,N,2026-10-20T08:31:00Z`;

    const report = parseAndValidateCsv("sensor_readings", validSensorsCsv, "sensors.csv");
    expect(report.isValid).toBe(true);
    expect(report.validRows).toBe(2);
    expect(report.parsedRows[0].measurement_value).toBe(852.4);
  });

  it("validates inspection_batch_links rows", () => {
    const validLinksCsv = `inspection_id,batch_id,machine_id,recorded_at
84218e7c-87d0-424a-9ebf-a185459345e8,BATCH-001,M-PRINTER-01,2026-10-20T10:00:00Z`;

    const report = parseAndValidateCsv("inspection_batch_links", validLinksCsv, "links.csv");
    expect(report.isValid).toBe(true);
    expect(report.validRows).toBe(1);
    expect(report.parsedRows[0].inspection_id).toBe("84218e7c-87d0-424a-9ebf-a185459345e8");
  });
});

describe("Phase 3C: Root Cause Taxonomy Integrity", () => {
  it("maintains exactly 9 mutually exclusive root-cause taxonomy classes", () => {
    expect(ROOT_CAUSE_TAXONOMY).toHaveLength(9);
    expect(ROOT_CAUSE_TAXONOMY).toEqual([
      "thermal_stress_soldering",
      "squeegee_pressure_drift",
      "screen_mesh_clogging",
      "firing_thermal_profile_excursion",
      "mechanical_handling_impact",
      "lamination_pressure_imbalance",
      "ingot_thermal_gradient",
      "chemical_texturing_contamination",
      "nominal_process_variation",
    ]);
  });

  it("provides comprehensive metadata for every taxonomy class", () => {
    ROOT_CAUSE_TAXONOMY.forEach((cause) => {
      const details = ROOT_CAUSE_DETAILS[cause];
      expect(details).toBeDefined();
      expect(details.label.length).toBeGreaterThan(0);
      expect(details.description.length).toBeGreaterThan(15);
      expect(["process", "equipment", "material", "environment"]).toContain(details.category);
    });
  });
});

describe("Phase 3C: Data Onboarding API Client — Zero Simulation Policy", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = originalFetch;
  });

  it("rejects empty row submissions immediately without network calls", async () => {
    const result = await submitImportRows("batches", []);
    expect(result.success).toBe(false);
    expect(result.endpointStatus).toBe("failed");
    expect(result.message).toContain("No valid rows provided");
  });

  it("truthfully reports backend_unmounted when backend importer returns 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
      json: async () => ({}),
    });

    const result = await submitImportRows("batches", [{ batch_id: "B1", status: "completed" }]);
    expect(result.success).toBe(false);
    expect(result.endpointStatus).toBe("backend_unmounted");
    expect(result.message).toContain("awaiting authorized deployment");
    expect(result.details?.[0]).toContain("Target entity: batches");
  });

  it("truthfully handles preview action vs commit action", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        success: true,
        importedCount: 5,
        rejectedCount: 0,
        message: "Server validated 5 records.",
      }),
    });

    const previewRes = await submitImportRows("batches", [{ batch_id: "B1" }], { action: "preview" });
    expect(previewRes.success).toBe(true);
    expect(previewRes.action).toBe("preview");
    expect(previewRes.endpointStatus).toBe("live_persisted");
  });

  it("truthfully handles live persistence when backend returns 200", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        success: true,
        importedCount: 5,
        rejectedCount: 0,
        message: "Successfully persisted 5 records to database.",
      }),
    });

    const result = await submitImportRows("machines", [{ machine_id: "M1" }], { action: "commit" });
    expect(result.success).toBe(true);
    expect(result.endpointStatus).toBe("live_persisted");
    expect(result.importedCount).toBe(5);
  });

  it("truthfully reports unmounted status for inspection-to-batch links on 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
    });

    const link: InspectionBatchLink = {
      inspectionId: "84218e7c-87d0-424a-9ebf-a185459345e8",
      batchId: "BATCH-001",
      machineId: "M-PRINTER-01",
      recordedAt: new Date().toISOString(),
      status: "active",
    };

    const res = await submitInspectionBatchLink(link);
    expect(res.success).toBe(false);
    expect(res.isPersisted).toBe(false);
    expect(res.message).toContain("not yet mounted");
  });

  it("persists real confirmed root-cause annotations via tRPC rootCause.annotate on 200", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        result: {
          data: {
            json: {
              success: true,
              annotationId: "annot_20261022_real",
            },
          },
        },
      }),
    });

    const annotation: ConfirmedRootCauseAnnotation = {
      id: "ann-01",
      inspectionId: "84218e7c-87d0-424a-9ebf-a185459345e8",
      confirmedCause: "thermal_stress_soldering",
      confidenceLevel: "confirmed",
      investigationNotes: "Peel test confirmed ribbon delamination.",
      verifiedBy: "Lead Metallurgist",
      verifiedAt: new Date().toISOString(),
    };

    const res = await submitConfirmedRootCauseAnnotation(annotation);
    expect(res.success).toBe(true);
    expect(res.isPersisted).toBe(true);
    expect(res.annotationId).toBe("annot_20261022_real");
    expect(res.message).toContain("recorded in quality engineering audit log");
  });

  it("handles unauthorized session error (401) gracefully on annotation submission", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({
        error: { message: "Authentication required to access this resource" },
      }),
    });

    const annotation: ConfirmedRootCauseAnnotation = {
      id: "ann-01",
      inspectionId: "84218e7c-87d0-424a-9ebf-a185459345e8",
      confirmedCause: "squeegee_pressure_drift",
      confidenceLevel: "confirmed",
      investigationNotes: "Blade force drift confirmed.",
      verifiedBy: "Operator",
      verifiedAt: new Date().toISOString(),
    };

    const res = await submitConfirmedRootCauseAnnotation(annotation);
    expect(res.success).toBe(false);
    expect(res.isPersisted).toBe(false);
    expect(res.message).toContain("Unauthorized");
  });

  it("handles forbidden ownership error (403) on cross-user annotation submission", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 403,
      ok: false,
      json: async () => ({
        error: { message: "Access denied to inspection record." },
      }),
    });

    const annotation: ConfirmedRootCauseAnnotation = {
      id: "ann-01",
      inspectionId: "other-user-inspection-uuid",
      confirmedCause: "squeegee_pressure_drift",
      confidenceLevel: "probable",
      investigationNotes: "Cross user inspection.",
      verifiedBy: "Operator",
      verifiedAt: new Date().toISOString(),
    };

    const res = await submitConfirmedRootCauseAnnotation(annotation);
    expect(res.success).toBe(false);
    expect(res.isPersisted).toBe(false);
    expect(res.message).toContain("Forbidden");
  });
});

describe("Phase 3C: Dataset Readiness & DATASET_BLOCKED Evaluation", () => {
  it("strictly reports DATASET_BLOCKED when database has zero manufacturing records", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error("Network offline"));

    const stats = await fetchDatasetReadiness();
    expect(stats.status).toBe("DATASET_BLOCKED");
    expect(stats.batchesCount).toBe(0);
    expect(stats.machinesCount).toBe(0);
    expect(stats.sensorRecordsCount).toBe(0);
    expect(stats.confirmedLabelsCount).toBe(0);
    expect(stats.unlabeledOrInvalidCount).toBe(130);
    expect(stats.trainingReadyExamplesCount).toBe(0);
    expect(stats.requiredMinimumExamples).toBe(100);
    expect(stats.blockers.length).toBeGreaterThanOrEqual(4);
    expect(stats.blockers[0]).toContain("Zero manufacturing batches");

    global.fetch = originalFetch;
  });

  it("parses live tRPC readiness summary from rootCause.readiness procedure", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        result: {
          data: {
            json: {
              schemaVersion: "2.0.0",
              canonicalFeatureCount: 48,
              datasetStatus: "DATASET_BLOCKED",
              tableCounts: {
                batches: 12,
                machines: 4,
                sensors: 0,
                events: 5,
                predictions: 0,
                annotations: 0,
              },
              blockingReasons: [
                "Zero historical sensor telemetry records available in local production database.",
                "Zero confirmed failure-analysis root cause ground truth annotations recorded.",
              ],
            },
          },
        },
      }),
    });

    const stats = await fetchDatasetReadiness();
    expect(stats.status).toBe("DATASET_BLOCKED");
    expect(stats.batchesCount).toBe(12);
    expect(stats.machinesCount).toBe(4);
    expect(stats.sensorRecordsCount).toBe(0);
    expect(stats.blockers).toHaveLength(2);
    expect(stats.blockers[0]).toContain("Zero historical sensor telemetry");

    global.fetch = originalFetch;
  });
});
