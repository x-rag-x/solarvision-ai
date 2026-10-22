/**
 * SolarVision AI — Model 3: Predictive Quality Monitoring
 * TypeScript Type Definitions & Response Contracts
 */

export type PredictiveQualityStatus = "ready" | "not_trained" | "missing_features" | "error";

export type QualityOutcome = "pass" | "warning" | "fail" | "unknown";

export type RiskLevel = "low" | "medium" | "high" | "critical" | "unknown";

export type ModelDomain = "solar_cell_manufacturing" | "semiconductor_benchmark";

export interface SensorMeasurementInput {
  sensorType: string;
  measurementValue: number;
  unit?: string;
  recordedAt?: string;
}

export interface DefectSummaryInput {
  totalDefectCount?: number;
  crackCount?: number;
  fingerInterruptionCount?: number;
  busbarDefectCount?: number;
  defectAreaRatio?: number;
  meanConfidence?: number;
}

export interface ElectricalParametersInput {
  voc_v?: number;
  isc_a?: number;
  fillFactorPct?: number;
  seriesResistanceMohm?: number;
  shuntResistanceOhm?: number;
  cellEfficiencyPct?: number;
}

export interface EnvironmentalContextInput {
  cleanroomTempC?: number;
  cleanroomHumidityPct?: number;
  cleanroomParticulatesPm25?: number;
  batchProgressRatio?: number;
}

export interface PredictiveQualityInput {
  batchId?: string;
  machineId?: string;
  waferId?: string;
  domain?: ModelDomain;
  featureVector?: number[];
  rawFeatures?: Record<string, number>;
  sensorMeasurements?: SensorMeasurementInput[];
  defectSummary?: DefectSummaryInput;
  electricalParameters?: ElectricalParametersInput;
  environmentalContext?: EnvironmentalContextInput;
  confidenceThreshold?: number;
}

export interface RiskFactor {
  factorName: string;
  impactScore: number;
  measuredValue?: number;
  nominalBaseline?: number;
  deviationDirection?: "high" | "low" | "nominal";
  description?: string;
}

export interface ConfidenceInterval {
  low: number;
  high: number;
}

export interface Model3Manifest {
  modelId: string;
  modelName: string;
  version: string;
  framework: string;
  domain: ModelDomain;
  sha256: string;
  schemaVersion: string;
  expectedDim: number;
  featureNames: string[];
  targetClasses: string[];
  sourceDataset: string;
  labelMeaning: string;
  evaluationStatus: string;
  calibrationMethod: string;
  isCalibrated: boolean;
  isBenchmark: boolean;
  limitations: string[];
}

export interface PredictiveQualityResponse {
  contractVersion: string;
  status: PredictiveQualityStatus;
  domain: ModelDomain;
  batchId: string | null;
  machineId: string | null;
  qualityOutcome: QualityOutcome;
  riskLevel: RiskLevel;
  probabilities: Record<string, number>;
  confidence: number | null;
  isCalibrated: boolean;
  calibrationMethod: string;
  predictedDefectRate: number | null;
  predictedYield: number | null;
  confidenceInterval: ConfidenceInterval | null;
  topRiskFactors: RiskFactor[];
  recommendedAction: string | null;
  modelVersion: string;
  modelMetadata: Model3Manifest | null;
  limitations: string[];
  processingTimeMs: number;
  persistedId?: string;
}

export interface Model3StatusInfo {
  modelName: string;
  isReady: boolean;
  modelVersion: string;
  domain: ModelDomain;
  artifactPath: string;
  unavailabilityReason?: string;
  expectedDim: number;
  schemaVersion: string;
  isCalibrated: boolean;
  calibrationMethod: string;
}

export interface QualityRequesterContext {
  userId?: string | null;
  role?: "user" | "admin" | string | null;
}

export interface QualityHistoryQueryOptions {
  batchId?: string;
  riskLevel?: string;
  domain?: ModelDomain | string;
  isBenchmark?: boolean;
  limit?: number;
  offset?: number;
}

export interface PredictiveQualityDbRecord {
  id: string;
  batchId: string | null;
  machineId?: string | null;
  waferId?: string | null;
  userId?: string | null;
  modelVersionId?: string | null;
  modelVersion?: string | null;
  domain: ModelDomain;
  isBenchmark: boolean | number;
  dataSource?: string | null;
  provenance?: string | null;
  qualityOutcome: QualityOutcome;
  riskLevel: RiskLevel | string;
  failureProbability?: number | null;
  predictedDefectRate?: number | null;
  predictedYield?: number | null;
  confidence?: number | null;
  confidenceIntervalLow?: number | null;
  confidenceIntervalHigh?: number | null;
  confidenceInterval?: string | null;
  forecastHorizonHours?: number;
  forecastHorizon?: string | null;
  dominantRiskDefect?: string | null;
  predictedLossPercentage?: number | null;
  topRiskFactors?: string | null;
  factors?: string | null;
  probabilities?: string | null;
  inputReference?: string | null;
  recommendedAction?: string | null;
  createdAt: string;
  generatedAt?: string | null;
}

export interface QualityForecastRecord {
  id: string;
  batchId: string | null;
  machineId: string | null;
  waferId: string | null;
  userId: string | null;
  modelVersionId: string | null;
  modelVersion: string | null;
  domain: ModelDomain;
  isBenchmark: boolean;
  dataSource: string | null;
  provenance: string | null;
  qualityOutcome: QualityOutcome;
  riskLevel: RiskLevel;
  failureProbability: number | null;
  predictedDefectRate: number | null;
  predictedYield: number | null;
  confidence: number | null;
  confidenceIntervalLow: number | null;
  confidenceIntervalHigh: number | null;
  forecastHorizonHours: number;
  topRiskFactors: RiskFactor[] | null;
  factors: RiskFactor[] | null;
  probabilities: Record<string, number> | null;
  inputReference: string | null;
  recommendedAction: string | null;
  createdAt: string;
  generatedAt: string;
}

export interface BenchmarkPredictInput {
  features: number[];
  batchId?: string;
  waferId?: string;
}

export interface BenchmarkMetadataResponse {
  benchmarkName: string;
  datasetName: string;
  doi: string;
  license: string;
  domain: string;
  targetClasses: string[];
  labelMeaning: string;
  inputFeatureCount: number;
  retainedFeatureCount: number;
  transformedFeatureCount: number;
  optimalThreshold: number;
  calibrationMetrics?: Record<string, any>;
  isReady: boolean;
  sha256?: string | null;
  disclaimer: string;
}

