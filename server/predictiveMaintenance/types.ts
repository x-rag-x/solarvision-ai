/**
 * SolarVision AI — Model 4: Predictive Maintenance
 * TypeScript Contracts, Domain Interfaces & API Payloads
 */

export type Model4Domain = "ai4i_synthetic_benchmark" | "solar_factory";

export type Model4Status = "ready" | "not_trained" | "missing_features" | "error";

export type MachineHealthState = "healthy" | "warning" | "failure" | "unknown";

export type FailureMode =
  | "none"
  | "tool_wear_failure"
  | "heat_dissipation_failure"
  | "power_failure"
  | "overstrain_failure"
  | "random_failure"
  | "unknown";

export interface RiskFactor {
  factor_name: string;
  impact_score: number;
  measured_value?: number | null;
  nominal_baseline?: number | null;
  deviation_direction?: "high" | "low" | "nominal" | string | null;
  description?: string | null;
}

export interface Model4Manifest {
  model_id: string;
  model_name: string;
  version: string;
  framework: string;
  domain: Model4Domain;
  sha256: string;
  schema_version: string;
  expected_dim: number;
  feature_names: string[];
  target_classes: string[];
  source_dataset: string;
  evaluation_status: string;
  is_calibrated: boolean;
  calibration_method: string;
  is_benchmark: boolean;
  limitations: string[];
}

export interface PredictiveMaintenanceInput {
  machineId?: string | null;
  domain?: Model4Domain;
  productType?: "L" | "M" | "H" | string | null;
  airTemperatureK?: number | null;
  processTemperatureK?: number | null;
  rotationalSpeedRpm?: number | null;
  torqueNm?: number | null;
  toolWearMin?: number | null;
  rawFeatures?: Record<string, number> | null;
  featureVector?: number[] | null;
  confidenceThreshold?: number;
}

export interface PredictiveMaintenanceResponse {
  contractVersion: string;
  status: Model4Status;
  domain: Model4Domain;
  machineId: string | null;
  healthState: MachineHealthState;
  failureMode: FailureMode;
  failureProbability: number | null;
  healthyProbability: number | null;
  modeProbabilities: Record<string, number>;
  confidence: number | null;
  isCalibrated: boolean;
  calibrationMethod: string;
  topRiskFactors: RiskFactor[];
  recommendedAction: string | null;
  modelVersion: string;
  modelMetadata: Model4Manifest | null;
  limitations: string[];
  processingTimeMs: number;
}

export interface BenchmarkPredictInput {
  productType: "L" | "M" | "H" | string;
  airTemperatureK: number;
  processTemperatureK: number;
  rotationalSpeedRpm: number;
  torqueNm: number;
  toolWearMin: number;
  machineId?: string;
  confidenceThreshold?: number;
}

export interface Model4StatusInfo {
  modelName: string;
  isReady: boolean;
  modelVersion: string;
  domain: string;
  artifactPath: string;
  unavailabilityReason: string | null;
  expectedDim: number;
  schemaVersion: string;
  isCalibrated: boolean;
  calibrationMethod: string;
  manifest: Model4Manifest | null;
  benchmarkReady?: boolean;
  solarReady?: boolean;
}

export interface BenchmarkMetadataResponse {
  modelId: string;
  modelName: string;
  domain: string;
  sourceDataset: string;
  citation: string;
  license: string;
  targetClasses: string[];
  failureModes: Array<{
    code: string;
    name: string;
    description: string;
  }>;
  inputFeatureCount: number;
  featureNames: string[];
  isBenchmark: boolean;
  isCalibrated: boolean;
  calibrationMethod: string;
  calibrationMetrics: Record<string, any>;
  limitations: string[];
}
