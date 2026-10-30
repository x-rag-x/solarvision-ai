/**
 * SolarVision AI — Model 2: ELPV Cell Defectiveness Screening
 * Type contracts and validation definitions
 */

export interface Model2ScreeningResult {
  model_id: "solarvision_m2_elpv_binary_v1";
  predicted_class: "healthy" | "defective";
  defective_probability: number;
  threshold: number;
  requires_manual_review: true;
  decision: "screening_only";
  review_status: "pending";
  input_scope: "complete_single_cell_EL_image";
  warning: string;
}

export interface CellScreeningInput {
  filename: string;
  mimeType: string;
  base64Data: string;
}

export interface CellScreeningResponse {
  screeningId: string;
  imageUrl: string;
  sourceFilename: string;
  modelId: string;
  predictedClass: "healthy" | "defective";
  defectiveScorePct: number;
  rawDefectiveScore: number;
  thresholdPct: number;
  rawThreshold: number;
  requiresManualReview: true;
  decision: "screening_only";
  reviewStatus: "pending";
  inputScope: "complete_single_cell_EL_image";
  warning: string;
  summary: string;
  dataProvenance: "ELPV";
  createdAt: string;
}

export interface Model2BenchmarkCaveats {
  modelId: string;
  dataset: string;
  license: string;
  accuracy: number;
  defectiveRecall: number;
  defectivePrecision: number;
  f1Defective: number;
  threshold: number;
  testSetSize: number;
  testHealthyCount: number;
  testDefectiveCount: number;
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  splitStrategy: string;
  trueModuleIdsPresent: boolean;
  limitations: string[];
}

export interface Model2ScreeningStatusInfo {
  modelId: string;
  artifactsPresent: boolean;
  checkpointPath: string;
  inputScope: "complete_single_cell_EL_image";
  threshold: number;
  benchmark: Model2BenchmarkCaveats;
}
