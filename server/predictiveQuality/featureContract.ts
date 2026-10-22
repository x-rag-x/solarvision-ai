/**
 * SolarVision AI — Model 3: Predictive Quality Monitoring
 * Canonical Feature Contract and Specification (Schema Version: 1.0.0)
 */

export const MODEL3_CONTRACT_VERSION = "1.0.0" as const;
export const CANONICAL_SOLAR_FEATURE_COUNT = 32 as const;

export interface FeatureDefinition {
  index: number;
  name: string;
  unit: string;
  nominal: number;
  minValid: number;
  maxValid: number;
  description: string;
}

export const CANONICAL_SOLAR_FEATURES: readonly FeatureDefinition[] = [
  { index: 0, name: "voc_v", unit: "V", nominal: 0.685, minValid: 0.55, maxValid: 0.78, description: "Open circuit voltage from inline flash tester" },
  { index: 1, name: "isc_a", unit: "A", nominal: 10.85, minValid: 8.0, maxValid: 13.0, description: "Short circuit current from inline flash tester" },
  { index: 2, name: "fill_factor_pct", unit: "%", nominal: 81.5, minValid: 65.0, maxValid: 88.0, description: "I-V curve fill factor percentage" },
  { index: 3, name: "series_resistance_mohm", unit: "mOhm", nominal: 1.15, minValid: 0.4, maxValid: 5.0, description: "Calculated internal series resistance" },
  { index: 4, name: "shunt_resistance_ohm", unit: "Ohm", nominal: 650.0, minValid: 10.0, maxValid: 5000.0, description: "Calculated cell parallel shunt resistance" },
  { index: 5, name: "cell_efficiency_pct", unit: "%", nominal: 23.5, minValid: 15.0, maxValid: 26.5, description: "Photoelectric conversion efficiency" },
  { index: 6, name: "soldering_temp_top_c", unit: "C", nominal: 225.0, minValid: 150.0, maxValid: 300.0, description: "Tabber stringer upper soldering head temperature" },
  { index: 7, name: "soldering_temp_bottom_c", unit: "C", nominal: 220.0, minValid: 150.0, maxValid: 300.0, description: "Tabber stringer lower preheating bed temperature" },
  { index: 8, name: "ribbon_tension_n", unit: "N", nominal: 1.2, minValid: 0.1, maxValid: 5.0, description: "Copper ribbon mechanical feed tension" },
  { index: 9, name: "squeegee_pressure_n_cm2", unit: "N/cm2", nominal: 18.0, minValid: 5.0, maxValid: 35.0, description: "Screen printer squeegee contact pressure" },
  { index: 10, name: "squeegee_speed_mm_s", unit: "mm/s", nominal: 250.0, minValid: 100.0, maxValid: 500.0, description: "Screen printing squeegee stroke speed" },
  { index: 11, name: "screen_snapoff_mm", unit: "mm", nominal: 1.8, minValid: 0.5, maxValid: 4.0, description: "Gap distance between screen mesh and cell" },
  { index: 12, name: "paste_temperature_c", unit: "C", nominal: 23.0, minValid: 15.0, maxValid: 35.0, description: "Silver metallization paste reservoir temperature" },
  { index: 13, name: "paste_viscosity_pa_s", unit: "Pa*s", nominal: 240.0, minValid: 100.0, maxValid: 450.0, description: "In-line metallization paste rheological viscosity" },
  { index: 14, name: "firing_peak_temp_c", unit: "C", nominal: 860.0, minValid: 750.0, maxValid: 1000.0, description: "Metallization fast-firing peak zone temperature" },
  { index: 15, name: "firing_belt_speed_m_min", unit: "m/min", nominal: 5.8, minValid: 3.0, maxValid: 9.0, description: "Fast-firing furnace mesh conveyor transit rate" },
  { index: 16, name: "firing_exhaust_pressure_pa", unit: "Pa", nominal: -35.0, minValid: -100.0, maxValid: 0.0, description: "Flue exhaust negative pressure draft" },
  { index: 17, name: "lamination_temp_c", unit: "C", nominal: 148.0, minValid: 120.0, maxValid: 180.0, description: "EVA encapsulation diaphragm heating temperature" },
  { index: 18, name: "lamination_vacuum_mbar", unit: "mbar", nominal: 0.8, minValid: 0.01, maxValid: 10.0, description: "Laminator degassing chamber vacuum level" },
  { index: 19, name: "lamination_pressure_bar", unit: "bar", nominal: 0.9, minValid: 0.2, maxValid: 2.0, description: "Encapsulation pressing hydraulic pressure" },
  { index: 20, name: "gripper_vacuum_kpa", unit: "kPa", nominal: -75.0, minValid: -100.0, maxValid: -20.0, description: "Wafer transfer arm suction cup vacuum level" },
  { index: 21, name: "transfer_accel_max_g", unit: "g", nominal: 0.45, minValid: 0.01, maxValid: 3.0, description: "Wafer transfer robotics peak acceleration vector" },
  { index: 22, name: "texturing_bath_temp_c", unit: "C", nominal: 80.0, minValid: 60.0, maxValid: 95.0, description: "Alkaline texturing etching bath temperature" },
  { index: 23, name: "texturing_hcl_conc_pct", unit: "%", nominal: 2.5, minValid: 0.5, maxValid: 10.0, description: "Acid clean bath concentration" },
  { index: 24, name: "upstream_total_defect_count", unit: "count", nominal: 0.0, minValid: 0.0, maxValid: 50.0, description: "Total upstream Model 1 optical defect detections" },
  { index: 25, name: "upstream_crack_count", unit: "count", nominal: 0.0, minValid: 0.0, maxValid: 20.0, description: "Model 1 detected micro-crack and macro-crack count" },
  { index: 26, name: "upstream_finger_interruption_count", unit: "count", nominal: 0.0, minValid: 0.0, maxValid: 20.0, description: "Model 1 detected broken finger grid line count" },
  { index: 27, name: "upstream_defect_area_ratio", unit: "ratio", nominal: 0.0, minValid: 0.0, maxValid: 1.0, description: "Fraction of cell surface obscured by defects" },
  { index: 28, name: "cleanroom_temp_c", unit: "C", nominal: 22.0, minValid: 18.0, maxValid: 28.0, description: "Fabrication facility cleanroom ambient temperature" },
  { index: 29, name: "cleanroom_humidity_pct", unit: "%", nominal: 45.0, minValid: 25.0, maxValid: 65.0, description: "Cleanroom relative humidity percentage" },
  { index: 30, name: "cleanroom_particulates_pm25", unit: "ug/m3", nominal: 5.0, minValid: 0.0, maxValid: 50.0, description: "Cleanroom airborne fine particulate density" },
  { index: 31, name: "batch_progress_ratio", unit: "ratio", nominal: 0.5, minValid: 0.0, maxValid: 1.0, description: "Normalized position of cell within production batch" },
];

export const CANONICAL_SOLAR_FEATURE_NAMES: readonly string[] = CANONICAL_SOLAR_FEATURES.map(f => f.name);

/**
 * Validates whether incoming request input contains sufficient manufacturing
 * features for predictive quality modeling.
 */
export function hasSufficientQualityFeatures(input: {
  featureVector?: number[];
  rawFeatures?: Record<string, number>;
  sensorMeasurements?: unknown[];
  defectSummary?: { totalDefectCount?: number };
  electricalParameters?: { voc_v?: number; isc_a?: number; cellEfficiencyPct?: number };
}): boolean {
  if (Array.isArray(input.featureVector) && input.featureVector.length > 0) {
    return true;
  }
  if (input.rawFeatures && Object.keys(input.rawFeatures).length > 0) {
    return true;
  }
  if (Array.isArray(input.sensorMeasurements) && input.sensorMeasurements.length > 0) {
    return true;
  }
  if (input.defectSummary && (input.defectSummary.totalDefectCount ?? 0) > 0) {
    return true;
  }
  if (input.electricalParameters) {
    const ep = input.electricalParameters;
    if (ep.voc_v !== undefined || ep.isc_a !== undefined || ep.cellEfficiencyPct !== undefined) {
      return true;
    }
  }
  return false;
}
