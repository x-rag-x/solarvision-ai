/**
 * SolarVision AI — Model 4: Predictive Maintenance
 * Persistence Layer Public Barrel & Integration Handoff
 *
 * Provides persistence adapters for:
 * - Agent 1: Inference service persistence (`persistMaintenanceAssessment`)
 * - Agent 5: Shared integration & tRPC routers (`getMaintenanceAssessmentById`, `getMaintenanceHistory`, etc.)
 */

import { getMaintenanceRepository, MaintenancePersistenceRepository } from "./repository";
import type {
  SaveAssessmentInput,
  MaintenanceAssessmentRecord,
  RequesterContext,
  HistoryQueryOptions,
  RecentQueryOptions,
  PaginatedResult,
  MaintenanceReadinessSummary,
} from "./types";

export * from "./types";
export * from "./schema";
export * from "./validation";
export * from "./demoData";
export { MaintenancePersistenceRepository, getMaintenanceRepository };

// ----------------------------------------------------------------------------
// HANDOFF INTERFACES FOR AGENT 1 (Inference Service)
// ----------------------------------------------------------------------------

/**
 * Persists an evaluation or prediction produced by Model 4 inference service.
 * Performs physical boundary validation, foreign key checks, and atomic insertion.
 */
export async function persistMaintenanceAssessment(
  input: SaveAssessmentInput,
  context?: RequesterContext
): Promise<MaintenanceAssessmentRecord> {
  const repo = getMaintenanceRepository();
  return repo.saveAssessment(input, context);
}

// ----------------------------------------------------------------------------
// HANDOFF INTERFACES FOR AGENT 5 (Shared Integration Routes / tRPC Handlers)
// ----------------------------------------------------------------------------

/**
 * Retrieves a single maintenance assessment by ID with cross-user ownership verification.
 */
export async function getMaintenanceAssessmentById(
  id: string,
  context?: RequesterContext
): Promise<MaintenanceAssessmentRecord | null> {
  const repo = getMaintenanceRepository();
  return repo.getAssessmentById(id, context);
}

/**
 * Retrieves paginated historical assessments for a specific machine ID.
 */
export async function getMaintenanceHistory(
  machineId: string,
  options?: HistoryQueryOptions,
  context?: RequesterContext
): Promise<PaginatedResult<MaintenanceAssessmentRecord>> {
  const repo = getMaintenanceRepository();
  return repo.getMachineHistory(machineId, options, context);
}

/**
 * Retrieves recent assessments across all equipment with cross-user isolation.
 */
export async function getRecentMaintenanceAssessments(
  options?: RecentQueryOptions,
  context?: RequesterContext
): Promise<PaginatedResult<MaintenanceAssessmentRecord>> {
  const repo = getMaintenanceRepository();
  return repo.getRecentAssessments(options, context);
}

/**
 * Computes dataset readiness summary, table counts, and equipment breakdown.
 */
export async function getMaintenanceReadinessSummary(
  context?: RequesterContext
): Promise<MaintenanceReadinessSummary> {
  const repo = getMaintenanceRepository();
  return repo.getDatasetReadinessCounts(context);
}

/**
 * Seeds curated academic benchmark demonstration samples (AI4I 2020) explicitly.
 */
export async function seedMaintenanceDemoSamples(
  context?: RequesterContext,
  count?: number
): Promise<{ inserted: number; sampleIds: string[] }> {
  const repo = getMaintenanceRepository();
  return repo.seedDemoBenchmarkSamples(context, count);
}

/**
 * Safely removes all academic benchmark demonstration samples.
 */
export async function clearMaintenanceDemoSamples(
  context?: RequesterContext
): Promise<{ deleted: number }> {
  const repo = getMaintenanceRepository();
  return repo.clearDemoBenchmarkSamples(context);
}
