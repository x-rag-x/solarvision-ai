/**
 * SolarVision AI — Model 4: Predictive Maintenance
 * Canonical Feature Contract, Physical Validation & Feature Extraction
 */

import type { PredictiveMaintenanceInput } from "./types";

export const MODEL4_CONTRACT_VERSION = "1.0.0";
export const CANONICAL_MAINTENANCE_FEATURE_COUNT = 6;

export const CANONICAL_MAINTENANCE_FEATURE_NAMES = [
  "product_type",
  "air_temperature_k",
  "process_temperature_k",
  "rotational_speed_rpm",
  "torque_nm",
  "tool_wear_min",
] as const;

export interface MaintenanceFeatureSpec {
  index: number;
  name: string;
  unit: string;
  nominal: number;
  minValid: number;
  maxValid: number;
  description: string;
}

export const CANONICAL_FEATURE_SPECS: MaintenanceFeatureSpec[] = [
  {
    index: 0,
    name: "product_type",
    unit: "category",
    nominal: 0.0,
    minValid: 0.0,
    maxValid: 2.0,
    description: "Product quality variant encoded: L (Low)=0, M (Medium)=1, H (High)=2",
  },
  {
    index: 1,
    name: "air_temperature_k",
    unit: "K",
    nominal: 300.0,
    minValid: 295.0,
    maxValid: 305.0,
    description: "Ambient air temperature in Kelvin",
  },
  {
    index: 2,
    name: "process_temperature_k",
    unit: "K",
    nominal: 310.0,
    minValid: 305.0,
    maxValid: 315.0,
    description: "Machining process temperature in Kelvin",
  },
  {
    index: 3,
    name: "rotational_speed_rpm",
    unit: "rpm",
    nominal: 1538.0,
    minValid: 1100.0,
    maxValid: 2900.0,
    description: "Spindle rotational speed in revolutions per minute",
  },
  {
    index: 4,
    name: "torque_nm",
    unit: "Nm",
    nominal: 40.0,
    minValid: 3.0,
    maxValid: 80.0,
    description: "Spindle drive torque in Newton-meters",
  },
  {
    index: 5,
    name: "tool_wear_min",
    unit: "min",
    nominal: 0.0,
    minValid: 0.0,
    maxValid: 260.0,
    description: "Cumulative tool cutting wear duration in minutes",
  },
];

/**
 * Checks whether an input contains sufficient physical features for maintenance evaluation.
 */
export function hasSufficientMaintenanceFeatures(
  input: PredictiveMaintenanceInput
): boolean {
  if (Array.isArray(input.featureVector)) {
    return input.featureVector.length === CANONICAL_MAINTENANCE_FEATURE_COUNT;
  }

  if (input.rawFeatures && typeof input.rawFeatures === "object") {
    const rawKeys = Object.keys(input.rawFeatures);
    const continuousProvided = [
      "air_temperature_k",
      "process_temperature_k",
      "rotational_speed_rpm",
      "torque_nm",
      "tool_wear_min",
    ].filter((k) => rawKeys.includes(k) && input.rawFeatures![k] != null).length;

    if (continuousProvided === 5) return true;
  }

  // Check direct physical parameters (all 5 continuous physical measurements required)
  const continuousProvided = [
    input.airTemperatureK,
    input.processTemperatureK,
    input.rotationalSpeedRpm,
    input.torqueNm,
    input.toolWearMin,
  ].filter((v) => v !== undefined && v !== null).length;

  return continuousProvided === 5;
}

/**
 * Validates physical boundaries of raw sensor values.
 */
export function validateMaintenanceFeatureBounds(
  features: Record<string, number>
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  for (const spec of CANONICAL_FEATURE_SPECS) {
    if (spec.name in features) {
      const val = features[spec.name];
      if (val < spec.minValid || val > spec.maxValid) {
        violations.push(
          `Feature '${spec.name}' value ${val} ${spec.unit} out of physical range [${spec.minValid}, ${spec.maxValid}].`
        );
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Normalizes product type string ('L', 'M', 'H') to float code (0.0, 1.0, 2.0).
 */
export function normalizeProductType(productType?: string | null): number {
  if (!productType) return 0.0;
  const upper = productType.trim().toUpperCase();
  if (upper === "H") return 2.0;
  if (upper === "M") return 1.0;
  return 0.0; // Default to 'L'
}

/**
 * Converts input fields into canonical 6-element numeric vector.
 */
export function toCanonicalMaintenanceVector(
  input: PredictiveMaintenanceInput
): number[] {
  if (Array.isArray(input.featureVector) && input.featureVector.length === CANONICAL_MAINTENANCE_FEATURE_COUNT) {
    return [...input.featureVector];
  }

  const pType = normalizeProductType(input.productType);
  const airT = input.airTemperatureK ?? 300.0;
  const procT = input.processTemperatureK ?? 310.0;
  const rpm = input.rotationalSpeedRpm ?? 1538.0;
  const torque = input.torqueNm ?? 40.0;
  const toolWear = input.toolWearMin ?? 0.0;

  return [pType, airT, procT, rpm, torque, toolWear];
}
