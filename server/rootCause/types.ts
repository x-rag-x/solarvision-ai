/**
 * SolarVision AI — Model 2: Manufacturing Root Cause Analysis
 * TypeScript Type Definitions & Shared Response Contracts
 */

export type RootCauseStatus = "ready" | "not_trained" | "missing_process_data" | "error";

export interface DefectDetectionInput {
  defectType: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  classId?: number;
}

export interface SensorMeasurementInput {
  sensorType: string;
  measurementValue: number;
  unit?: string;
  isAnomaly?: boolean;
  anomalyScore?: number;
  recordedAt?: string;
}

export interface ProductionEventInput {
  eventType: string;
  severity?: "info" | "low" | "medium" | "high" | "critical";
  message?: string;
  details?: Record<string, unknown>;
  startedAt?: string;
  resolvedAt?: string;
}

export interface BatchInfoInput {
  batchId: string;
  batchNumber?: string;
  waferType?: string;
  cellLine?: string;
  targetQuantity?: number;
  actualQuantity?: number;
  status?: string;
}

export interface MachineInfoInput {
  machineId: string;
  machineCode?: string;
  machineType?: string;
  lineId?: string;
  status?: string;
  lastMaintenanceAt?: string;
  nextMaintenanceDue?: string;
}

export interface RootCauseAnalysisInput {
  inspectionId: string;
  batchId?: string;
  machineId?: string;
  operatorId?: string;
  detections?: DefectDetectionInput[];
  batch?: BatchInfoInput;
  machine?: MachineInfoInput;
  sensorMeasurements?: SensorMeasurementInput[];
  productionEvents?: ProductionEventInput[];
  confidenceThreshold?: number;
}

export interface ProbableCause {
  causeCode: string;
  label: string;
  confidence?: number;
  supportingEvidence?: string[];
  recommendedAction?: string;
  contributingFactors?: Record<string, number>;
  featureImportance?: Record<string, number>;
}

/**
 * Standard Model 2 Shared Response Contract
 */
export interface RootCauseResponse {
  inspectionId: string;
  batchId: string | null;
  machineId: string | null;
  status: RootCauseStatus;
  probableCauses: ProbableCause[];
  modelVersion: string;
  limitations: string[];
  featureSummary?: Record<string, number>;
  modelName?: string;
  processingTimeMs?: number;
}

export interface Model2StatusInfo {
  modelName: string;
  isReady: boolean;
  modelVersion: string;
  artifactPath: string;
  unavailabilityReason?: string;
}
