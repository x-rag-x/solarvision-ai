/**
 * SolarVision AI — Model 4: Predictive Maintenance
 * Module Barrel & Public Exports
 */

export * from "./types";
export * from "./featureContract";
export * from "./service";
export * from "./routerHandler";

// Selective export from persistence to avoid conflicting enum/interface duplicates with ./types
export {
  persistMaintenanceAssessment,
  getMaintenanceAssessmentById,
  getMaintenanceHistory,
  getRecentMaintenanceAssessments,
  getMaintenanceReadinessSummary,
  seedMaintenanceDemoSamples,
  getMaintenanceRepository,
  MaintenancePersistenceRepository,
  type SaveAssessmentInput,
  type MaintenanceAssessmentRecord,
  type RequesterContext,
  type HistoryQueryOptions,
  type RecentQueryOptions,
  type PaginatedResult,
  type MaintenanceReadinessSummary,
  type SensorValuesMap,
  type MaintenanceUrgency,
  type MaintenanceDataSource,
} from "./persistence";
