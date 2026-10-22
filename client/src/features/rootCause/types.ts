/**
 * SolarVision AI — Phase 3: Model 2 Root Cause Analysis Feature Types
 * 
 * Strict typed contracts for:
 * - Model 2 status and lifecycle
 * - Multi-cause ranked candidate etiologies
 * - Manufacturing batch, machine telemetry, and sensor observations
 * - Historical prediction records and validation feedback
 * - Root cause UI state machine
 */

export type Model2Status =
  | "not_trained"
  | "training"
  | "ready"
  | "unavailable"
  | "error";

export interface Model2StatusResponse {
  status: Model2Status;
  modelName: string;
  modelVersion: string;
  framework?: string;
  isReady: boolean;
  trainingStatus: string;
  lastTrainedAt?: string;
  checkpointSha256?: string;
  trainingDatasetRef?: string;
  validationAccuracy?: number;
  supportedCausesCount: number;
  limitations: string[];
}

export type CauseCategory =
  | "process"
  | "equipment"
  | "material"
  | "environment";

export type CauseUrgency = "critical" | "high" | "medium" | "low";

export interface CauseEvidence {
  id: string;
  factorName: string;
  description: string;
  observedValue: string | number;
  expectedBaseline: string | number;
  unit?: string;
  contributionWeight: number; // 0.0 to 1.0 (relative feature importance)
  isAnomaly: boolean;
}

export interface CandidateCause {
  rank: number;
  causeCode: string;
  title: string;
  category: CauseCategory;
  confidence: number; // 0.0 to 1.0 (real validated probability from Model 2)
  summary: string;
  recommendedAction: string;
  urgency: CauseUrgency;
  evidence: CauseEvidence[];
}

export interface RootCausePrediction {
  predictionId: string;
  inspectionId: string;
  defectId?: number;
  primaryDefectType: string;
  modelVersionId: string;
  status: "completed" | "failed" | "model_not_trained";
  candidateCauses: CandidateCause[];
  modelLimitations: string[];
  inferenceTimeMs: number;
  createdAt: string;
}

export interface ManufacturingBatchData {
  id: string;
  batchNumber: string;
  waferType: string;
  cellLine: string;
  targetQuantity: number;
  actualQuantity: number;
  status: "in_progress" | "completed" | "on_hold" | "aborted";
  startTime: string;
  endTime?: string | null;
  supplier?: string;
  ingotBatch?: string;
  dopingType?: string;
}

export interface ManufacturingMachineData {
  id: string;
  machineCode: string;
  machineType: string;
  lineId: string;
  location?: string | null;
  status: "operational" | "maintenance" | "offline" | "degraded";
  operatingHours: number;
  lastMaintenanceAt?: string | null;
  nextMaintenanceDue?: string | null;
  firmwareVersion?: string;
}

export interface SensorObservationData {
  id: string;
  sensorType: string;
  sensorLabel: string;
  measurementValue: number;
  unit: string;
  baselineMin: number;
  baselineMax: number;
  isAnomaly: boolean;
  anomalyScore?: number;
  recordedAt: string;
  stage: "crystallization" | "wafering" | "diffusion" | "metallization" | "firing" | "lamination";
}

export interface DetectedDefectSummary {
  id: number;
  defectType: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface InspectionContext {
  inspectionId: string;
  sourceFilename: string;
  createdAt: string;
  detectionsCount: number;
  annotatedImageUrl?: string | null;
  inputImageUrl?: string | null;
  detections: DetectedDefectSummary[];
  batchId?: string | null;
  machineId?: string | null;
  operatorId?: string | null;
}

export interface HistoricalPrediction {
  id: string;
  inspectionId: string;
  defectType: string;
  batchNumber?: string;
  machineCode?: string;
  topCause: string;
  topConfidence: number;
  category: CauseCategory;
  urgency: CauseUrgency;
  status: "verified" | "dismissed" | "pending";
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
}

export type RootCauseUIStatus =
  | "idle"
  | "loading"
  | "model_not_trained"
  | "no_manufacturing_data"
  | "ready"
  | "error";

export interface RootCauseState {
  uiStatus: RootCauseUIStatus;
  modelStatus: Model2StatusResponse | null;
  selectedInspection: InspectionContext | null;
  batchData: ManufacturingBatchData | null;
  machineData: ManufacturingMachineData | null;
  sensorObservations: SensorObservationData[];
  prediction: RootCausePrediction | null;
  history: HistoricalPrediction[];
  errorMessage?: string;
  errorDetails?: string;
}
