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
  moduleId?: string;
  timestamp?: string;
  features: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface SandiaBatchPredictionInput {
  items: SandiaPredictionInput[];
}

export interface SandiaPredictionItem {
  module_id?: string | null;
  moduleId?: string | null;
  prediction: number | string | number[] | Record<string, any>;
  prediction_label?: string | null;
  predictionLabel?: string | null;
  target_name?: string | null;
  targetName?: string | null;
  target_unit?: string | null;
  targetUnit?: string | null;
  confidence?: number | null;
  uncertainty?: number | null;
  features_used?: string[];
  featuresUsed?: string[];
  is_mock?: boolean;
  isMock?: boolean;
  warnings?: string[];
}

export interface SandiaPredictionResponse {
  contract_version?: string;
  contractVersion?: string;
  status: SandiaModelStatus;
  model_name?: string;
  modelName?: string;
  model_version?: string;
  modelVersion?: string;
  is_mock?: boolean;
  isMock?: boolean;
  prediction?: SandiaPredictionItem | null;
  limitations: string[];
  processing_time_ms?: number;
  processingTimeMs?: number;
  persistedId?: string | null;
}

export interface SandiaBatchPredictionResponse {
  contract_version?: string;
  contractVersion?: string;
  status: SandiaModelStatus;
  model_name?: string;
  modelName?: string;
  model_version?: string;
  modelVersion?: string;
  is_mock?: boolean;
  isMock?: boolean;
  predictions: SandiaPredictionItem[];
  total_items?: number;
  totalItems?: number;
  limitations: string[];
  processing_time_ms?: number;
  processingTimeMs?: number;
  persistedIds?: string[];
}

export interface SandiaModelStatusResponse {
  model_name?: string;
  modelName?: string;
  model_version?: string;
  modelVersion?: string;
  contract_version?: string;
  contractVersion?: string;
  is_ready?: boolean;
  isReady?: boolean;
  status: SandiaModelStatus;
  artifact_name?: string;
  artifactName?: string;
  unavailability_reason?: string | null;
  unavailabilityReason?: string | null;
  feature_schema_loaded?: boolean;
  featureSchemaLoaded?: boolean;
  feature_schema?: FeatureSchemaManifest | null;
  featureSchema?: FeatureSchemaManifest | null;
  sample_input_loaded?: boolean;
  sampleInputLoaded?: boolean;
  sample_input?: Record<string, any> | null;
  sampleInput?: Record<string, any> | null;
  target_definition_loaded?: boolean;
  targetDefinitionLoaded?: boolean;
  target_definition?: TargetDefinitionManifest | null;
  targetDefinition?: TargetDefinitionManifest | null;
  is_mock?: boolean;
  isMock?: boolean;
  trainer_handoff_pending?: boolean;
  trainerHandoffPending?: boolean;
  expected_dim?: number | null;
  expectedDim?: number | null;
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
  inputFeatures?: Record<string, any>;
  userId?: string | null;
}

export interface SandiaHistoryQueryOptions {
  moduleId?: string;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

export interface SandiaPredictionRecord {
  id: string;
  userId?: string | null;
  moduleId?: string | null;
  inputFeatures: Record<string, any>;
  predictedValue: number;
  predictionLabel?: string | null;
  targetName: string;
  targetUnit?: string | null;
  confidence?: number | null;
  uncertainty?: number | null;
  featuresUsed?: string[] | null;
  modelVersion: string;
  datasetProvenance: string;
  isMock: boolean;
  warnings?: string[] | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface PaginatedSandiaResult {
  items: SandiaPredictionRecord[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
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
