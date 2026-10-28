/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * TypeScript Interfaces, Enums, and Type Contracts
 */

export const SANDIA_CONTRACT_VERSION = "1.0.0";
export const MAX_SANDIA_BATCH_SIZE = 100;
export const DEFAULT_SANDIA_TIMEOUT_MS = 15000;

export type SandiaModelStatus =
  | "ready"
  | "not_trained"
  | "missing_features"
  | "validation_error"
  | "error";

export interface FeatureSpec {
  name: string;
  type?: string;
  required?: boolean;
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
  target_type?: string;
  target_unit?: string | null;
  description?: string | null;
  min_value?: number | null;
  max_value?: number | null;
  metadata?: Record<string, any>;
}

export interface SandiaPredictionInput {
  moduleId?: string | null;
  timestamp?: string | null;
  features: Record<string, any>;
  metadata?: Record<string, any> | null;
}

export interface SandiaBatchPredictionInput {
  items: SandiaPredictionInput[];
}

export interface SandiaPredictionItem {
  moduleId?: string | null;
  prediction: number | string | any;
  predictionLabel?: string | null;
  targetName?: string | null;
  targetUnit?: string | null;
  confidence?: number | null;
  uncertainty?: number | null;
  featuresUsed?: string[];
  isMock: boolean;
  warnings?: string[];
}

export interface SandiaPredictionResponse {
  contractVersion: string;
  status: SandiaModelStatus;
  modelName: string;
  modelVersion: string;
  isMock: boolean;
  prediction?: SandiaPredictionItem | null;
  limitations: string[];
  processingTimeMs: number;
  persistedId?: string | null;
}

export interface SandiaBatchPredictionResponse {
  contractVersion: string;
  status: SandiaModelStatus;
  modelName: string;
  modelVersion: string;
  isMock: boolean;
  predictions: SandiaPredictionItem[];
  totalItems: number;
  limitations: string[];
  processingTimeMs: number;
  persistedIds?: string[];
}

export interface SandiaModelStatusResponse {
  modelName: string;
  modelVersion: string;
  contractVersion: string;
  isReady: boolean;
  status: SandiaModelStatus;
  artifactName: string;
  unavailabilityReason?: string | null;
  featureSchemaLoaded: boolean;
  featureSchema?: FeatureSchemaManifest | null;
  sampleInputLoaded: boolean;
  sampleInput?: Record<string, any> | null;
  targetDefinitionLoaded: boolean;
  targetDefinition?: TargetDefinitionManifest | null;
  isMock: boolean;
  trainerHandoffPending: boolean;
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

export interface RequesterContext {
  userId?: string | null;
  role?: "user" | "admin" | string | null;
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

export interface InsertSandiaPredictionRecord {
  id?: string;
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
  isMock?: boolean;
  warnings?: string[] | null;
  metadata?: Record<string, any> | null;
  createdAt?: string;
}

export interface SandiaHistoryQueryOptions {
  limit?: number;
  offset?: number;
  moduleId?: string;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedSandiaResult {
  items: SandiaPredictionRecord[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface SandiaReadinessSummary {
  modelStatus: SandiaModelStatusResponse;
  storedPredictionsCount: number;
  recentModulesCount: number;
  latestPredictionTimestamp?: string | null;
}
