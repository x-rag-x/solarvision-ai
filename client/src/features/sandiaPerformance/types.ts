/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * Frontend TypeScript Type Definitions & State Contracts
 * 
 * Aligns strictly with backend/app/sandia_performance/schemas.py.
 * Zero fabrication guarantee: fields honestly reflect API state without simulated confidences.
 */

export type SandiaModelStatus =
  | "ready"
  | "not_trained"
  | "missing_features"
  | "validation_error"
  | "error";

export type FeatureDataType = "float" | "int" | "string" | "category";

export interface FeatureSpec {
  name: string;
  type: FeatureDataType | string;
  required: boolean;
  unit?: string | null;
  min_value?: number | null;
  max_value?: number | null;
  description?: string | null;
}

export interface FeatureSchemaManifest {
  schema_version: string;
  dataset_name?: string | null;
  features: FeatureSpec[];
  metadata?: Record<string, any>;
}

export interface TargetDefinitionManifest {
  target_name: string;
  target_type: "regression" | "classification" | string;
  target_unit?: string | null;
  description?: string | null;
  min_value?: number | null;
  max_value?: number | null;
  metadata?: Record<string, any>;
}

export interface SandiaPredictionInput {
  module_id?: string;
  timestamp?: string;
  features: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface SandiaBatchPredictionInput {
  items: SandiaPredictionInput[];
}

export interface SandiaPredictionItem {
  module_id?: string | null;
  prediction: number | string | number[] | Record<string, any>;
  prediction_label?: string | null;
  target_name?: string | null;
  target_unit?: string | null;
  confidence?: number | null;
  uncertainty?: number | null;
  features_used: string[];
  is_mock: boolean;
  warnings: string[];
}

export interface SandiaPredictionResponse {
  contract_version: string;
  status: SandiaModelStatus;
  model_name: string;
  model_version: string;
  is_mock: boolean;
  prediction?: SandiaPredictionItem | null;
  limitations: string[];
  processing_time_ms: number;
}

export interface SandiaBatchPredictionResponse {
  contract_version: string;
  status: SandiaModelStatus;
  model_name: string;
  model_version: string;
  is_mock: boolean;
  predictions: SandiaPredictionItem[];
  total_items: number;
  limitations: string[];
  processing_time_ms: number;
}

export interface SandiaModelStatusResponse {
  model_name: string;
  model_version: string;
  contract_version: string;
  is_ready: boolean;
  status: SandiaModelStatus;
  artifact_name: string;
  unavailability_reason?: string | null;
  feature_schema_loaded: boolean;
  feature_schema?: FeatureSchemaManifest | null;
  sample_input_loaded: boolean;
  sample_input?: Record<string, any> | null;
  target_definition_loaded: boolean;
  target_definition?: TargetDefinitionManifest | null;
  is_mock: boolean;
  trainer_handoff_pending: boolean;
  expected_dim?: number | null;
}

export interface SandiaMetadataResponse {
  modelId: string;
  modelName: string;
  framework: string;
  contractVersion: string;
  domain: string;
  sourceDataset: string;
  attribution: string;
  isReady: boolean;
  isMock: boolean;
  artifactName: string;
  limitations: string[];
}

export interface TrainerEvaluationMetrics {
  mae?: number;
  rmse?: number;
  r2?: number;
  mse?: number;
  mape?: number;
  heldOutTestSamples?: number;
  evaluationDate?: string;
  notes?: string[];
}

export interface SandiaPredictionHistoryItem {
  id: string;
  moduleId: string;
  timestamp: string;
  prediction: number | string;
  predictionLabel?: string;
  targetName: string;
  targetUnit: string;
  modelVersion: string;
  processingTimeMs: number;
  isMock: boolean;
  warnings: string[];
}

export type ModelVariantId =
  | "sandia_tabular"
  | "el_multimodal"
  | "next_obs_forecasting";

export interface ModelVariantInfo {
  id: ModelVariantId;
  name: string;
  headline: string;
  description: string;
  status: "operational" | "in_development" | "planned";
  badge: string;
  inputs: string[];
  target: string;
  readinessNotice: string;
}
