/**
 * SolarVision AI — Model 4: Predictive Maintenance
 * Persistence Data Contracts, Schema Types & Query Interfaces
 */

export type Model4Domain = "ai4i_synthetic_benchmark" | "solar_factory";

export type MachineHealthState = "healthy" | "warning" | "failure" | "unknown";

export type FailureMode =
  | "none"
  | "tool_wear_failure"
  | "heat_dissipation_failure"
  | "power_failure"
  | "overstrain_failure"
  | "random_failure"
  | "unknown";

export type MaintenanceUrgency =
  | "routine"
  | "warning"
  | "critical"
  | "low"
  | "medium"
  | "high";

export type MaintenanceDataSource =
  | "edge_gateway"
  | "scada_modbus"
  | "ai4i_synthetic_benchmark_demo"
  | "demo_seed"
  | "factory_sensor"
  | "manual_entry";

export interface RiskFactor {
  factor_name: string;
  impact_score: number;
  measured_value?: number | null;
  nominal_baseline?: number | null;
  deviation_direction?: "high" | "low" | "nominal" | string | null;
  description?: string | null;
}

export interface SensorValuesMap {
  product_type?: string | number | null;
  air_temperature_k?: number | null;
  process_temperature_k?: number | null;
  rotational_speed_rpm?: number | null;
  torque_nm?: number | null;
  tool_wear_min?: number | null;
  vibration_rms?: number | null;
  vacuum_pressure_mbar?: number | null;
  [key: string]: any;
}

/**
 * Normalized database record for `maintenance_predictions`
 * Supported across SQLite, MySQL (Drizzle), and PostgreSQL/Supabase.
 */
export interface MaintenanceAssessmentRecord {
  id: string;
  machineId: string;
  userId: string | null;
  modelVersionId: string | null;
  machineCategory: string;
  componentName: string;
  domain: Model4Domain;
  dataSource: MaintenanceDataSource | string;
  isBenchmark: boolean;
  measurementTimestamp: string;
  sensorValues: SensorValuesMap | null;
  healthState: MachineHealthState;
  failureMode: FailureMode;
  failureProbability: number | null;
  healthyProbability: number | null;
  remainingUsefulLifeHours: number | null;
  urgency: MaintenanceUrgency;
  confidence: number | null;
  riskFactors: RiskFactor[] | null;
  modeProbabilities: Record<string, number> | null;
  recommendedAction: string | null;
  createdAt: string;
}

/**
 * Input contract for persisting an assessment (provided by Agent 1 Inference Service)
 */
export interface SaveAssessmentInput {
  id?: string;
  machineId: string;
  userId?: string | null;
  modelVersionId?: string | null;
  machineCategory?: string;
  componentName?: string;
  domain: Model4Domain;
  dataSource: MaintenanceDataSource | string;
  isBenchmark?: boolean;
  measurementTimestamp?: string;
  sensorValues?: SensorValuesMap | null;
  healthState: MachineHealthState;
  failureMode?: FailureMode;
  failureProbability?: number | null;
  healthyProbability?: number | null;
  remainingUsefulLifeHours?: number | null;
  urgency?: MaintenanceUrgency;
  confidence?: number | null;
  riskFactors?: RiskFactor[] | null;
  modeProbabilities?: Record<string, number> | null;
  recommendedAction?: string | null;
  createdAt?: string;
  skipFkCheck?: boolean; // For isolated testing only
}

export interface RequesterContext {
  userId?: string | null;
  role?: "user" | "admin" | string | null;
}

export interface HistoryQueryOptions {
  domain?: Model4Domain | string;
  isBenchmark?: boolean;
  healthState?: MachineHealthState | string;
  urgency?: MaintenanceUrgency | string;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

export interface RecentQueryOptions {
  domain?: Model4Domain | string;
  isBenchmark?: boolean;
  urgency?: MaintenanceUrgency | string;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  records: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface MaintenanceReadinessSummary {
  schemaVersion: string;
  canonicalFeatureCount: number;
  datasetStatus: "DATASET_BLOCKED" | "READY";
  tableCounts: {
    totalAssessments: number;
    genuineFactoryAssessments: number;
    benchmarkDemoAssessments: number;
    registeredMachines: number;
    sensorMeasurements: number;
  };
  equipmentBreakdown: Array<{
    machineId: string;
    machineCode: string;
    machineType: string;
    status: string;
    assessmentCount: number;
    latestAssessmentAt: string | null;
    latestHealthState: string | null;
  }>;
  blockingReasons: string[];
}
