/**
 * SolarVision AI — Model 4: Predictive Maintenance
 * Persistence Input Validation, Physical Bounds & Foreign Key Checking
 */

import type { DatabaseSync } from "node:sqlite";
import type { SaveAssessmentInput, Model4Domain, FailureMode, MachineHealthState, MaintenanceUrgency } from "./types";

export class PersistenceValidationError extends Error {
  public readonly field: string;
  public readonly code: string;

  constructor(message: string, field: string, code = "INVALID_FIELD") {
    super(message);
    this.name = "PersistenceValidationError";
    this.field = field;
    this.code = code;
  }
}

export class MachineNotFoundError extends PersistenceValidationError {
  constructor(machineId: string) {
    super(
      `Foreign key violation: Machine with ID '${machineId}' does not exist in manufacturing_machines table.`,
      "machineId",
      "MACHINE_NOT_FOUND"
    );
    this.name = "MachineNotFoundError";
  }
}

const VALID_DOMAINS = new Set<string>(["ai4i_synthetic_benchmark", "solar_factory"]);
const VALID_HEALTH_STATES = new Set<string>(["healthy", "warning", "failure", "unknown"]);
const VALID_FAILURE_MODES = new Set<string>([
  "none",
  "tool_wear_failure",
  "heat_dissipation_failure",
  "power_failure",
  "overstrain_failure",
  "random_failure",
  "unknown",
]);
const VALID_URGENCIES = new Set<string>(["routine", "warning", "critical", "low", "medium", "high"]);

/**
 * Validates sensor values against plausible physical boundaries.
 */
export function validateSensorBounds(sensorValues: Record<string, any>): void {
  if (sensorValues.air_temperature_k !== undefined && sensorValues.air_temperature_k !== null) {
    const val = Number(sensorValues.air_temperature_k);
    if (isNaN(val) || val < 250.0 || val > 350.0) {
      throw new PersistenceValidationError(
        `air_temperature_k must be between 250.0 K and 350.0 K, received ${sensorValues.air_temperature_k}`,
        "sensorValues.air_temperature_k"
      );
    }
  }

  if (sensorValues.process_temperature_k !== undefined && sensorValues.process_temperature_k !== null) {
    const val = Number(sensorValues.process_temperature_k);
    if (isNaN(val) || val < 250.0 || val > 400.0) {
      throw new PersistenceValidationError(
        `process_temperature_k must be between 250.0 K and 400.0 K, received ${sensorValues.process_temperature_k}`,
        "sensorValues.process_temperature_k"
      );
    }
  }

  if (sensorValues.rotational_speed_rpm !== undefined && sensorValues.rotational_speed_rpm !== null) {
    const val = Number(sensorValues.rotational_speed_rpm);
    if (isNaN(val) || val < 0.0 || val > 10000.0) {
      throw new PersistenceValidationError(
        `rotational_speed_rpm must be between 0 and 10,000 RPM, received ${sensorValues.rotational_speed_rpm}`,
        "sensorValues.rotational_speed_rpm"
      );
    }
  }

  if (sensorValues.torque_nm !== undefined && sensorValues.torque_nm !== null) {
    const val = Number(sensorValues.torque_nm);
    if (isNaN(val) || val < 0.0 || val > 500.0) {
      throw new PersistenceValidationError(
        `torque_nm must be between 0.0 Nm and 500.0 Nm, received ${sensorValues.torque_nm}`,
        "sensorValues.torque_nm"
      );
    }
  }

  if (sensorValues.tool_wear_min !== undefined && sensorValues.tool_wear_min !== null) {
    const val = Number(sensorValues.tool_wear_min);
    if (isNaN(val) || val < 0.0 || val > 1000.0) {
      throw new PersistenceValidationError(
        `tool_wear_min must be between 0.0 and 1000.0 minutes, received ${sensorValues.tool_wear_min}`,
        "sensorValues.tool_wear_min"
      );
    }
  }
}

/**
 * Validates a SaveAssessmentInput prior to executing persistence queries.
 */
export function validateSaveAssessmentInput(
  input: SaveAssessmentInput,
  db?: DatabaseSync
): void {
  // 1. Machine ID validation
  if (!input.machineId || typeof input.machineId !== "string" || input.machineId.trim().length === 0) {
    throw new PersistenceValidationError("machineId is required and must be a non-empty string.", "machineId");
  }

  // 2. Foreign Key validation (if db provided and not skipped)
  if (db && !input.skipFkCheck) {
    const row = db.prepare("SELECT id FROM manufacturing_machines WHERE id = ?").get(input.machineId);
    if (!row) {
      throw new MachineNotFoundError(input.machineId);
    }
  }

  // 3. Domain validation
  if (!input.domain || !VALID_DOMAINS.has(input.domain)) {
    throw new PersistenceValidationError(
      `domain must be one of 'ai4i_synthetic_benchmark' or 'solar_factory', received '${input.domain}'`,
      "domain"
    );
  }

  // 4. Data source validation & domain provenance integrity (Task 2)
  if (!input.dataSource || typeof input.dataSource !== "string" || input.dataSource.trim().length === 0) {
    throw new PersistenceValidationError("dataSource is required to maintain telemetry provenance.", "dataSource");
  }

  if (input.domain === "ai4i_synthetic_benchmark") {
    if (input.isBenchmark === false) {
      throw new PersistenceValidationError(
        "Domain provenance violation: 'ai4i_synthetic_benchmark' cannot be persisted with isBenchmark=false.",
        "isBenchmark"
      );
    }
    const prohibitedFactorySources = new Set(["edge_gateway", "scada_modbus", "factory_sensor"]);
    if (prohibitedFactorySources.has(input.dataSource.trim().toLowerCase())) {
      throw new PersistenceValidationError(
        `Domain provenance violation: synthetic AI4I benchmark data cannot claim live factory data source '${input.dataSource}'.`,
        "dataSource"
      );
    }
  }

  if (input.domain === "solar_factory") {
    if (input.isBenchmark === true) {
      throw new PersistenceValidationError(
        "Domain provenance violation: genuine 'solar_factory' assessment cannot have isBenchmark=true.",
        "isBenchmark"
      );
    }
    if (input.dataSource.toLowerCase().includes("benchmark")) {
      throw new PersistenceValidationError(
        `Domain provenance violation: solar factory records cannot use benchmark data source '${input.dataSource}'.`,
        "dataSource"
      );
    }
  }

  // 5. Probability bounds validation (Task 1: Nullable, missing does not mean zero risk)
  if (input.failureProbability !== undefined && input.failureProbability !== null) {
    if (
      typeof input.failureProbability !== "number" ||
      isNaN(input.failureProbability) ||
      input.failureProbability < 0.0 ||
      input.failureProbability > 1.0
    ) {
      throw new PersistenceValidationError(
        `failureProbability must be a float in range [0.0, 1.0], received ${input.failureProbability}`,
        "failureProbability"
      );
    }
  }

  if (input.healthyProbability !== undefined && input.healthyProbability !== null) {
    if (
      typeof input.healthyProbability !== "number" ||
      isNaN(input.healthyProbability) ||
      input.healthyProbability < 0.0 ||
      input.healthyProbability > 1.0
    ) {
      throw new PersistenceValidationError(
        `healthyProbability must be a float in range [0.0, 1.0], received ${input.healthyProbability}`,
        "healthyProbability"
      );
    }
  }

  // 6. Remaining Useful Life bounds validation (Task 1: Nullable, missing does not mean zero hours remaining)
  if (input.remainingUsefulLifeHours !== undefined && input.remainingUsefulLifeHours !== null) {
    if (
      typeof input.remainingUsefulLifeHours !== "number" ||
      isNaN(input.remainingUsefulLifeHours) ||
      input.remainingUsefulLifeHours < 0.0
    ) {
      throw new PersistenceValidationError(
        `remainingUsefulLifeHours must be a non-negative float, received ${input.remainingUsefulLifeHours}`,
        "remainingUsefulLifeHours"
      );
    }
  }

  // 7. Health State validation
  if (input.healthState && !VALID_HEALTH_STATES.has(input.healthState)) {
    throw new PersistenceValidationError(
      `healthState must be one of 'healthy', 'warning', 'failure', 'unknown', received '${input.healthState}'`,
      "healthState"
    );
  }

  // 8. Failure Mode validation
  if (input.failureMode && !VALID_FAILURE_MODES.has(input.failureMode)) {
    throw new PersistenceValidationError(
      `failureMode must be a valid failure mode, received '${input.failureMode}'`,
      "failureMode"
    );
  }

  // 9. Urgency validation
  if (input.urgency && !VALID_URGENCIES.has(input.urgency)) {
    throw new PersistenceValidationError(
      `urgency must be one of 'routine', 'warning', 'critical', 'low', 'medium', 'high', received '${input.urgency}'`,
      "urgency"
    );
  }

  // 10. Sensor physical bounds validation
  if (input.sensorValues && typeof input.sensorValues === "object") {
    validateSensorBounds(input.sensorValues);
  }
}
