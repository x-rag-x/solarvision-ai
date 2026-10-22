/**
 * SolarVision AI — Phase 3B: Manufacturing Data Onboarding & Root Cause Review Types
 * 
 * Strict contracts for:
 * 1. Six CSV Import Entities & Schemas
 * 2. Client-side CSV validation results & row diagnostics
 * 3. Inspection-to-Batch lineage linking
 * 4. Expert Root Cause confirmation & human labeling
 * 5. Model 2 Dataset Readiness & DATASET_BLOCKED state
 */

// ============================================================================
// 1. CSV IMPORT ENTITIES & TEMPLATE CONTRACTS
// ============================================================================

export type ImportEntityType =
  | "batches"
  | "machines"
  | "sensor_readings"
  | "production_events"
  | "root_cause_annotations"
  | "inspection_batch_links";

export interface EntityColumnSpec {
  name: string;
  required: boolean;
  type: "string" | "number" | "boolean" | "datetime" | "enum";
  description: string;
  allowedValues?: string[];
}

export interface EntityTemplateSpec {
  entityType: ImportEntityType;
  displayName: string;
  description: string;
  requiredColumns: string[];
  allColumns: string[];
  columnSpecs: Record<string, EntityColumnSpec>;
  sampleFilename: string;
}

export interface CsvRowError {
  rowNumber: number;
  column?: string;
  message: string;
  severity: "error" | "warning";
  rawValue?: string;
}

export interface ImportValidationReport {
  entityType: ImportEntityType;
  filename: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  missingRequiredColumns: string[];
  unexpectedColumns: string[];
  rowErrors: CsvRowError[];
  parsedRows: Record<string, any>[];
  rejectedRows: { rowNumber: number; data: Record<string, string>; errors: string[] }[];
  isValid: boolean;
  validatedAt: string;
}

// ============================================================================
// 2. INSPECTION-TO-BATCH LINKING CONTRACT
// ============================================================================

export interface InspectionBatchLink {
  inspectionId: string;
  batchId: string;
  machineId: string;
  waferPosition?: string | null;
  recordedAt: string;
  linkedBy?: string | null;
  status: "active" | "quarantined" | "unverified";
}

export interface InspectionBatchLinkValidation {
  inspectionExists: boolean;
  batchExists: boolean;
  machineExists: boolean;
  errors: string[];
  isValid: boolean;
}

// ============================================================================
// 3. ROOT CAUSE CONFIRMATION & EXPERT REVIEW
// ============================================================================

export const ROOT_CAUSE_TAXONOMY = [
  "thermal_stress_soldering",
  "squeegee_pressure_drift",
  "screen_mesh_clogging",
  "firing_thermal_profile_excursion",
  "mechanical_handling_impact",
  "lamination_pressure_imbalance",
  "ingot_thermal_gradient",
  "chemical_texturing_contamination",
  "nominal_process_variation",
] as const;

export type RootCauseTaxonomyClass = (typeof ROOT_CAUSE_TAXONOMY)[number];

export const ROOT_CAUSE_DETAILS: Record<
  RootCauseTaxonomyClass,
  { label: string; description: string; category: "process" | "equipment" | "material" | "environment" }
> = {
  thermal_stress_soldering: {
    label: "Thermal Stress — Soldering",
    description: "Excessive thermal shock or temperature differential during tabber/stringer soldering of ribbons.",
    category: "process",
  },
  squeegee_pressure_drift: {
    label: "Squeegee Pressure Drift",
    description: "Squeegee blade force or speed drift during front/back screen printing causing paste deposition error.",
    category: "equipment",
  },
  screen_mesh_clogging: {
    label: "Screen Mesh Clogging",
    description: "Dried silver/aluminum paste or emulsion degradation occluding screen mesh openings.",
    category: "process",
  },
  firing_thermal_profile_excursion: {
    label: "Firing Thermal Excursion",
    description: "Metallization furnace peak temperature or belt speed excursion causing junction punch-through.",
    category: "process",
  },
  mechanical_handling_impact: {
    label: "Mechanical Handling Impact",
    description: "Cassette vacuum gripper shock, transfer belt deceleration, or mechanical pin misalignment.",
    category: "equipment",
  },
  lamination_pressure_imbalance: {
    label: "Lamination Pressure Imbalance",
    description: "Uneven bladder pressure distribution or vacuum leak during EVA encapsulation lamination.",
    category: "equipment",
  },
  ingot_thermal_gradient: {
    label: "Ingot Thermal Gradient",
    description: "Upstream crystal pulling thermal gradient instability or crucible contamination at wafer foundry.",
    category: "material",
  },
  chemical_texturing_contamination: {
    label: "Chemical Texturing Contamination",
    description: "Incomplete saw-damage etching or chemical texturing bath contamination altering wafer surface.",
    category: "material",
  },
  nominal_process_variation: {
    label: "Nominal Baseline Variation",
    description: "Standard statistical baseline process noise without identifiable mechanical/thermal excursion.",
    category: "process",
  },
};

export type ConfirmationConfidenceLevel = "confirmed" | "probable" | "investigative";

export interface ConfirmedRootCauseAnnotation {
  id: string;
  inspectionId: string;
  defectId?: number | null;
  confirmedCause: RootCauseTaxonomyClass;
  confidenceLevel: ConfirmationConfidenceLevel;
  investigationNotes: string;
  supportingEvidenceFactors?: string[];
  verifiedBy: string;
  verifiedAt: string;
  isCorrection?: boolean;
  priorAnnotationId?: string | null;
}

// ============================================================================
// 4. MODEL 2 DATASET READINESS CONTRACT
// ============================================================================

export type DatasetReadinessStatus = "DATASET_READY" | "DATASET_INCOMPLETE" | "DATASET_BLOCKED";

export interface BackendReadinessSummary {
  schemaVersion: string;
  canonicalFeatureCount: number;
  datasetStatus: "DATASET_BLOCKED" | "PARTIAL" | "READY";
  tableCounts: {
    batches: number;
    machines: number;
    sensors: number;
    events: number;
    predictions: number;
    annotations: number;
  };
  blockingReasons: string[];
}

export interface Model2DatasetReadinessStats {
  status: DatasetReadinessStatus;
  batchesCount: number;
  machinesCount: number;
  sensorRecordsCount: number;
  linkedInspectionsCount: number;
  expertAnnotationsCount: number;
  confirmedLabelsCount: number;
  trainingReadyExamplesCount: number;
  unlabeledOrInvalidCount: number;
  requiredMinimumExamples: number;
  minimumTaxonomyClassesRepresented: number;
  activeTaxonomyClassesCount: number;
  blockers: string[];
  lastAuditedAt: string;
}
