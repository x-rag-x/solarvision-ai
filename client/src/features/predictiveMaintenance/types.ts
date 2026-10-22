/**
 * SolarVision AI — Model 4: Predictive Maintenance & Equipment Health
 * Frontend TypeScript Contracts, Types & State Definitions
 * 
 * STRICT COMPLIANCE:
 * - Domain segregation between AI4I 2020 Benchmark and Solar Factory Equipment.
 * - Current-failure classification under operating condition, NOT Remaining Useful Life (RUL).
 * - Zero fabricated scores or arbitrary confidence percentages.
 * - Real persisted database history contracts.
 */

export type ProductType = "L" | "M" | "H";

export type MaintenanceDomain = "ai4i_synthetic_benchmark" | "solar_factory";

export type FailureClassification = "FAILURE" | "NO_FAILURE" | "WARNING" | "UNKNOWN";

export type MaintenanceRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";

export type FailureModeCode = "TWF" | "HDF" | "PWF" | "OSF" | "RNF";

export interface FailureModeInfo {
  code: FailureModeCode;
  name: string;
  description: string;
  thresholdExceeded: boolean;
  engineeringFormula: string;
  isRuleBased: true;
}

export interface MaintenanceInputMeasurements {
  productType: ProductType;
  airTemperatureK: number;
  processTemperatureK: number;
  rotationalSpeedRpm: number;
  torqueNm: number;
  toolWearMin: number;
  machineId?: string;
  subsystem?: string;
}

export interface DerivedPhysicalParameters {
  powerWatts: number;
  deltaTemperatureK: number;
  overstrainProductNmMin: number;
  isPowerAbnormal: boolean;
  isDeltaTAbnormal: boolean;
  isOverstrainAbnormal: boolean;
  isToolWearAbnormal: boolean;
}

export interface MaintenancePredictionResult {
  classification: FailureClassification;
  failureProbability: number | null;
  healthyProbability: number | null;
  riskLevel: MaintenanceRiskLevel;
  confidenceInterval: { low: number; high: number } | null;
  activeFailureMode: string | null;
  ruleBasedFailureModes: FailureModeInfo[];
  failureModes?: FailureModeInfo[];
  derivedParameters: DerivedPhysicalParameters;
  recommendedAction: string;
  modelVersion: string;
  domain: MaintenanceDomain;
  timestamp: string;
  executionTimeMs: number;
  inputMeasurements: MaintenanceInputMeasurements;
  limitations: string[];
  remainingUsefulLifeHours: "N/A" | null;
  rulExplanation: string;
}

export interface BenchmarkMetrics {
  accuracy: number;
  balancedAccuracy: number;
  rocAuc: number;
  prAuc: number;
  precision: number;
  recall: number;
  f1Score: number;
  specificityNormal: number;
  totalRecords: number;
  healthyCount: number;
  failureCount: number;
  imbalanceRatio: number;
  thresholdUsed: number;
  testSamples: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  brierScore: number;
  ece: number;
  failureModeBreakdown?: {
    twfCount: number;
    hdfCount: number;
    pwfCount: number;
    osfCount: number;
    rnfCount: number;
  };
}

export interface BenchmarkMetadata {
  datasetName: string;
  datasetDoi: string;
  datasetCitation: string;
  datasetLicense: string;
  datasetAuthor: string;
  framework: string;
  modelVersion: string;
  targetDescription: string;
  metrics: BenchmarkMetrics;
  limitations: string[];
}

export interface PresetMaintenanceSample {
  id: string;
  name: string;
  description: string;
  sourceCategory: "authentic_benchmark_record" | "synthetic_stress_scenario" | "custom_stress_scenario";
  sourceReference: string;
  measurements: MaintenanceInputMeasurements;
  targetLabel?: "Normal Operation" | "Machine Failure";
  expectedClassification?: FailureClassification;
  expectedFailureMode?: string;
}

export interface SolarEquipmentItem {
  id: string;
  name: string;
  station: string;
  subsystem: string;
  status: "NOT_TRAINED" | "DATASET_BLOCKED";
  criticalSensorTypes: string[];
  telemetryStreamCount: number;
  maintenanceLogCount: number;
  eligibleTrainingTrajectories: number;
}

export interface SolarMaintenanceReadiness {
  status: "NOT_TRAINED" | "DATASET_BLOCKED";
  schemaVersion: string;
  equipmentCount: number;
  tableCounts: {
    telemetryReadings: number;
    cmmsWorkOrders: number;
    verifiedFailureEvents: number;
    eligibleTrainingTrajectories: number;
  };
  blockingReasons: string[];
  prerequisites: string[];
  lastChecked: string;
}

/**
 * Persisted maintenance record shape from database table `maintenance_predictions`
 */
export interface PersistedMaintenanceRecord {
  id: string;
  machineId: string;
  domain: MaintenanceDomain | string;
  isBenchmark: boolean;
  healthState: "healthy" | "warning" | "failure" | "unknown";
  failureMode: string;
  failureProbability: number | null;
  healthyProbability: number | null;
  remainingUsefulLifeHours: number | null;
  urgency: string;
  confidence: number | null;
  recommendedAction: string | null;
  sensorValues: {
    product_type?: string | null;
    air_temperature_k?: number | null;
    process_temperature_k?: number | null;
    rotational_speed_rpm?: number | null;
    torque_nm?: number | null;
    tool_wear_min?: number | null;
    [key: string]: any;
  } | null;
  createdAt: string;
}

export type ActiveMaintenanceTab = "benchmark_eval" | "inference_simulator" | "solar_readiness" | "history";

