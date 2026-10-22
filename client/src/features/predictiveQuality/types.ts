/**
 * SolarVision AI — Model 3: Predictive Quality Monitoring
 * Frontend TypeScript Type Definitions & State Contracts
 */

export type ModelDomain = "semiconductor_benchmark" | "solar_cell_manufacturing";

export type BenchmarkStatus = "BENCHMARK_EVALUATED_READY" | "ready" | "not_trained" | "error" | "offline";

export type SolarModelStatus = "NOT_TRAINED" | "DATASET_BLOCKED";

export type QualityOutcome = "PASS" | "FAIL" | "WARNING" | "UNKNOWN";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";

export interface BenchmarkMetrics {
  accuracy: number;
  balancedAccuracy: number;
  precisionFail: number;
  recallFail: number;
  specificityPass: number;
  f1Fail: number;
  f1Pass: number;
  macroF1: number;
  weightedF1: number;
  rocAuc: number;
  prAuc: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  totalSamples: number;
  thresholdUsed: number;
  brierScore: number;
  ece: number;
}

export interface CalibrationBin {
  binLow: number;
  binHigh: number;
  count: number;
  accuracy: number | null;
  confidence: number | null;
  gap: number;
}

export interface BenchmarkMetadata {
  modelName: string;
  modelVersion: string;
  createdAt: string;
  domain: string;
  framework: string;
  datasetName: string;
  datasetDoi: string;
  datasetLicense: string;
  trainingSamples: number;
  valSamples: number;
  testSamples: number;
  totalSamples: number;
  inputFeatureCount: number;
  retainedFeatureCount: number;
  outputFeatureCount: number;
  classDistribution: {
    passCount: number;
    passPct: number;
    failCount: number;
    failPct: number;
    imbalanceRatio: number;
  };
  metrics: BenchmarkMetrics;
  calibrationBins: CalibrationBin[];
  sha256Hash: string;
  limitations: string[];
}

export interface ContributingFeature {
  featureIndex: number;
  featureName?: string;
  measuredValue: number;
  zScore: number;
  impactDirection: "increases_risk" | "decreases_risk";
  impactScore: number;
  description?: string;
}

export interface BenchmarkPredictionResult {
  outcome: "PASS" | "FAIL";
  probabilityFail: number;
  probabilityPass: number;
  confidenceInterval: { low: number; high: number };
  riskLevel: RiskLevel;
  thresholdUsed: number;
  topFeatures: ContributingFeature[];
  recommendedAction: string;
  modelVersion: string;
  timestamp: string;
  executionTimeMs: number;
  domain: "semiconductor_benchmark";
  isBenchmarkDisclaimerAcknowledged?: boolean;
}

export interface PresetSampleVector {
  id: string;
  name: string;
  description: string;
  expectedOutcome: "PASS" | "FAIL";
  expectedRisk: RiskLevel;
  tag: string;
  features: number[];
}

export interface SolarReadinessData {
  status: SolarModelStatus;
  canonicalFeatureCount: number;
  schemaVersion: string;
  tableCounts: {
    batches: number;
    sensorReadings: number;
    qualityOutcomeLabels: number;
    linkedInspections: number;
    eligibleTrainingExamples: number;
  };
  blockingReasons: string[];
  prerequisites: string[];
  lastChecked: string;
}

export type ActiveTab = "benchmark" | "prediction" | "solar_readiness";
