/**
 * SolarVision AI — System Health & Live Application Console
 * System Types & Telemetry Contracts
 */

export type ServiceHealthState =
  | "ready"
  | "healthy"
  | "degraded"
  | "unavailable"
  | "not_trained"
  | "not_configured"
  | "unknown";

export type OverallHealthState = "healthy" | "degraded" | "unavailable";

export type DatabaseConnectionState = "connected" | "degraded" | "disconnected" | "not_configured";

export interface DatabaseTableInfo {
  name: string;
  rowCount: number;
  verified: boolean;
  modelTarget?: string;
}

export interface DatabaseHealthInfo {
  name: string;
  type: "sqlite" | "supabase" | "mysql";
  state: DatabaseConnectionState;
  pingLatencyMs: number | null;
  lastChecked: string;
  errorMessage?: string;
  details?: {
    path?: string;
    mode?: string;
    tablesVerified?: number;
    tables?: DatabaseTableInfo[];
    note?: string;
  };
}

export interface ModelHealthInfo {
  modelId: string;
  name: string;
  shortName: string;
  state: ServiceHealthState;
  artifactStatus: string;
  artifactPath?: string;
  artifactSha256Verified?: boolean;
  backendConnectivity: "fastapi_direct" | "cli_bridge" | "node_direct" | "offline";
  dbPersistenceAvailable: boolean;
  healthCheckLatencyMs: number;
  lastSuccessfulCheck: string | null;
  lastAttemptedCheck: string;
  errorMessage?: string;
  limitations: string[];
  capabilities: {
    canSelfTest: boolean;
    isScreeningOnly?: boolean;
    isBenchmarkOnly?: boolean;
    isGenuineNonMock?: boolean;
    threshold?: number;
  };
  details?: Record<string, any>;
}

export interface SystemHealthSummary {
  overallStatus: OverallHealthState;
  healthyCount: number;
  degradedCount: number;
  unavailableCount: number;
  notConfiguredCount: number;
  totalMonitored: number;
  lastRefreshed: string;
  databases: DatabaseHealthInfo[];
  models: {
    model1: ModelHealthInfo;
    model2: ModelHealthInfo;
    model3: ModelHealthInfo;
    model4: ModelHealthInfo;
  };
}

export interface ModelSelfTestResult {
  modelId: string;
  modelName: string;
  success: boolean;
  durationMs: number;
  executedAt: string;
  summary: string;
  verifiedOutputs: Record<string, any>;
  errorMessage?: string;
}

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export type LogService =
  | "SYSTEM"
  | "DATABASE"
  | "FASTAPI"
  | "MODEL 1"
  | "MODEL 2"
  | "MODEL 3"
  | "MODEL 4"
  | "API"
  | "AUTH";

export interface LogEntry {
  id: string;
  timestamp: string; // ISO 8601
  formattedTime: string; // HH:MM:SS
  level: LogLevel;
  service: LogService;
  message: string;
  metadata?: Record<string, any>;
}

export interface LogFilterInput {
  level?: LogLevel | "ALL";
  service?: LogService | "ALL";
  search?: string;
  limit?: number;
  sinceTimestamp?: string;
}

