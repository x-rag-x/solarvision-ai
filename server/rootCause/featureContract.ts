/**
 * SolarVision AI — Model 2: Manufacturing Root Cause Analysis
 * Canonical Feature Contract and Alignment Specification (Schema Version: 2.0.0)
 *
 * Coordinates the 48-dimensional canonical input contract between
 * Agent 1 (Inference/Serving) and Agent 3 (Dataset/Training Pipeline).
 * Exactly matches backend.root_cause_data.feature_spec.CANONICAL_FEATURES_V2.
 */

export const FEATURE_SCHEMA_VERSION = "2.0.0" as const;

export type FeatureDomain =
  | "defect_optical"
  | "machine_context"
  | "batch_material"
  | "sensor_telemetry"
  | "production_event";

export type MissingValuePolicy =
  | "zero_fill"
  | "nominal_baseline"
  | "default_progress"
  | "operational_default";

export interface FeatureDefinition {
  index: number;
  name: string;
  domain: FeatureDomain;
  dtype: "float32";
  unit: string;
  minValid: number;
  maxValid: number;
  nominalMean?: number;
  nominalStd?: number;
  missingPolicy: MissingValuePolicy;
  description: string;
}

/**
 * Version 2.0.0 Canonical 48-Dimensional Feature Definitions
 */
export const CANONICAL_FEATURES_V2: readonly FeatureDefinition[] = [
  // --- Group 1: Model 1 Defect Statistics (Indices 0 - 14, 15 dimensions) ---
  { index: 0, name: "defect_count_crack", domain: "defect_optical", dtype: "float32", unit: "count", minValid: 0, maxValid: 50, missingPolicy: "zero_fill", description: "Micro-crack and macro-crack bounding box count" },
  { index: 1, name: "defect_count_finger_interruption", domain: "defect_optical", dtype: "float32", unit: "count", minValid: 0, maxValid: 50, missingPolicy: "zero_fill", description: "Broken or interrupted screen-printed front finger grid line count" },
  { index: 2, name: "defect_count_busbar_defect", domain: "defect_optical", dtype: "float32", unit: "count", minValid: 0, maxValid: 50, missingPolicy: "zero_fill", description: "Busbar misalignment, soldering blob, or thick paste deposition count" },
  { index: 3, name: "defect_count_soldering_defect", domain: "defect_optical", dtype: "float32", unit: "count", minValid: 0, maxValid: 50, missingPolicy: "zero_fill", description: "Cold soldering, ribbon detachment, or flux burn defect count" },
  { index: 4, name: "defect_count_microcrack", domain: "defect_optical", dtype: "float32", unit: "count", minValid: 0, maxValid: 50, missingPolicy: "zero_fill", description: "Sub-millimeter crystal lattice fracture count under EL excitation" },
  { index: 5, name: "defect_count_hotspot", domain: "defect_optical", dtype: "float32", unit: "count", minValid: 0, maxValid: 50, missingPolicy: "zero_fill", description: "Localized current crowding and severe localized resistive shunting count" },
  { index: 6, name: "defect_count_cell_breakage", domain: "defect_optical", dtype: "float32", unit: "count", minValid: 0, maxValid: 20, missingPolicy: "zero_fill", description: "Wafer corner chipping, edge spalling, or structural cell fragmentation count" },
  { index: 7, name: "defect_count_foreign_material", domain: "defect_optical", dtype: "float32", unit: "count", minValid: 0, maxValid: 50, missingPolicy: "zero_fill", description: "Dust particles, solder splash, hair, or laminator debris count" },
  { index: 8, name: "defect_count_anti_reflective_coating", domain: "defect_optical", dtype: "float32", unit: "count", minValid: 0, maxValid: 20, missingPolicy: "zero_fill", description: "PECVD SiNx anti-reflective coating thickness variation count" },
  { index: 9, name: "defect_total_count", domain: "defect_optical", dtype: "float32", unit: "count", minValid: 0, maxValid: 100, missingPolicy: "zero_fill", description: "Total defect bounding box count across all defect classes" },
  { index: 10, name: "defect_avg_confidence", domain: "defect_optical", dtype: "float32", unit: "ratio", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "Mean detection confidence score of active defect detections" },
  { index: 11, name: "defect_max_confidence", domain: "defect_optical", dtype: "float32", unit: "ratio", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "Maximum detection confidence score among detected defects" },
  { index: 12, name: "defect_edge_ratio", domain: "defect_optical", dtype: "float32", unit: "ratio", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "Proportion of defects located at wafer peripheral edge (>0.35 radius)" },
  { index: 13, name: "defect_center_ratio", domain: "defect_optical", dtype: "float32", unit: "ratio", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "Proportion of defects located within central cell region (<=0.35 radius)" },
  { index: 14, name: "defect_total_area_fraction", domain: "defect_optical", dtype: "float32", unit: "ratio", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "Cumulative fraction of total cell area obscured by detected defects" },

  // --- Group 2: Machine & Maintenance Context (Indices 15 - 26, 12 dimensions) ---
  { index: 15, name: "machine_is_stringer", domain: "machine_context", dtype: "float32", unit: "binary", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "One-hot: Inspection occurred downstream of tabber/stringer" },
  { index: 16, name: "machine_is_tabber", domain: "machine_context", dtype: "float32", unit: "binary", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "One-hot: Inspection occurred downstream of tabber ribbon applicator" },
  { index: 17, name: "machine_is_laminator", domain: "machine_context", dtype: "float32", unit: "binary", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "One-hot: Inspection occurred post-lamination encapsulation platen" },
  { index: 18, name: "machine_is_soldering_station", domain: "machine_context", dtype: "float32", unit: "binary", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "One-hot: Inspection occurred at automated cell interconnect station" },
  { index: 19, name: "machine_is_wafer_saw", domain: "machine_context", dtype: "float32", unit: "binary", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "One-hot: Inspection evaluates incoming diamond-wire cut raw wafer" },
  { index: 20, name: "machine_is_laser_cutter", domain: "machine_context", dtype: "float32", unit: "binary", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "One-hot: Inspection occurred post half-cut / shingled cell laser scribe" },
  { index: 21, name: "machine_is_coating_chamber", domain: "machine_context", dtype: "float32", unit: "binary", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "One-hot: Inspection occurred post PECVD passivation tube" },
  { index: 22, name: "machine_status_operational", domain: "machine_context", dtype: "float32", unit: "binary", minValid: 0, maxValid: 1, missingPolicy: "operational_default", description: "Binary flag: Equipment reported in nominal operational state" },
  { index: 23, name: "machine_status_maintenance_required", domain: "machine_context", dtype: "float32", unit: "binary", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "Binary flag: Equipment has pending maintenance warning" },
  { index: 24, name: "machine_status_error", domain: "machine_context", dtype: "float32", unit: "binary", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "Binary flag: Equipment actively in error or offline state" },
  { index: 25, name: "machine_days_since_maintenance", domain: "machine_context", dtype: "float32", unit: "days", minValid: 0, maxValid: 365, missingPolicy: "zero_fill", description: "Elapsed days since last preventive maintenance or calibration" },
  { index: 26, name: "machine_maintenance_overdue", domain: "machine_context", dtype: "float32", unit: "binary", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "Binary flag: Current timestamp exceeds scheduled preventive maintenance" },

  // --- Group 3: Batch & Material Metadata (Indices 27 - 31, 5 dimensions) ---
  { index: 27, name: "batch_is_monocrystalline", domain: "batch_material", dtype: "float32", unit: "binary", minValid: 0, maxValid: 1, missingPolicy: "operational_default", description: "One-hot: Monocrystalline p-type or n-type c-Si substrate" },
  { index: 28, name: "batch_is_polycrystalline", domain: "batch_material", dtype: "float32", unit: "binary", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "One-hot: Multi-crystalline cast silicon wafer" },
  { index: 29, name: "batch_is_perc", domain: "batch_material", dtype: "float32", unit: "binary", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "One-hot: PERC rear passivation architecture" },
  { index: 30, name: "batch_is_topcon", domain: "batch_material", dtype: "float32", unit: "binary", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "One-hot: n-type TOPCon passivated contact architecture" },
  { index: 31, name: "batch_progress_ratio", domain: "batch_material", dtype: "float32", unit: "ratio", minValid: 0, maxValid: 2, missingPolicy: "default_progress", description: "Ratio of produced units to target lot quantity" },

  // --- Group 4: Physical Sensor Telemetry (Indices 32 - 41, 10 dimensions) ---
  { index: 32, name: "sensor_soldering_temp_top_norm", domain: "sensor_telemetry", dtype: "float32", unit: "z-score", minValid: -5, maxValid: 5, nominalMean: 225.0, nominalStd: 15.0, missingPolicy: "nominal_baseline", description: "Normalized stringer upper soldering head temperature (baseline 225C, std 15C)" },
  { index: 33, name: "sensor_soldering_temp_bottom_norm", domain: "sensor_telemetry", dtype: "float32", unit: "z-score", minValid: -5, maxValid: 5, nominalMean: 220.0, nominalStd: 15.0, missingPolicy: "nominal_baseline", description: "Normalized stringer lower preheating bed temperature (baseline 220C, std 15C)" },
  { index: 34, name: "sensor_ribbon_tension_norm", domain: "sensor_telemetry", dtype: "float32", unit: "z-score", minValid: -5, maxValid: 5, nominalMean: 1.2, nominalStd: 0.3, missingPolicy: "nominal_baseline", description: "Normalized interconnect ribbon mechanical tension (baseline 1.2N, std 0.3N)" },
  { index: 35, name: "sensor_squeegee_pressure_norm", domain: "sensor_telemetry", dtype: "float32", unit: "z-score", minValid: -5, maxValid: 5, nominalMean: 18.0, nominalStd: 3.0, missingPolicy: "nominal_baseline", description: "Normalized screen printing squeegee downward force (baseline 18 N/cm2, std 3 N/cm2)" },
  { index: 36, name: "sensor_firing_peak_temp_norm", domain: "sensor_telemetry", dtype: "float32", unit: "z-score", minValid: -5, maxValid: 5, nominalMean: 840.0, nominalStd: 20.0, missingPolicy: "nominal_baseline", description: "Normalized metallization furnace peak zone temperature (baseline 840C, std 20C)" },
  { index: 37, name: "sensor_lamination_temp_norm", domain: "sensor_telemetry", dtype: "float32", unit: "z-score", minValid: -5, maxValid: 5, nominalMean: 148.0, nominalStd: 8.0, missingPolicy: "nominal_baseline", description: "Normalized laminator platen heating temperature (baseline 148C, std 8C)" },
  { index: 38, name: "sensor_lamination_pressure_norm", domain: "sensor_telemetry", dtype: "float32", unit: "z-score", minValid: -5, maxValid: 5, nominalMean: 0.9, nominalStd: 0.15, missingPolicy: "nominal_baseline", description: "Normalized encapsulation diaphragm hydraulic pressure (baseline 0.9 bar, std 0.15 bar)" },
  { index: 39, name: "sensor_chamber_vacuum_norm", domain: "sensor_telemetry", dtype: "float32", unit: "z-score", minValid: -5, maxValid: 5, nominalMean: 0.8, nominalStd: 0.2, missingPolicy: "nominal_baseline", description: "Normalized vacuum chamber degassing level (baseline 0.8 mbar, std 0.2 mbar)" },
  { index: 40, name: "sensor_gripper_vacuum_norm", domain: "sensor_telemetry", dtype: "float32", unit: "z-score", minValid: -5, maxValid: 5, nominalMean: -75.0, nominalStd: 10.0, missingPolicy: "nominal_baseline", description: "Normalized robotic end-effector suction cup vacuum (baseline -75 kPa, std 10 kPa)" },
  { index: 41, name: "sensor_telemetry_anomaly_total", domain: "sensor_telemetry", dtype: "float32", unit: "count", minValid: 0, maxValid: 20, missingPolicy: "zero_fill", description: "Total anomalous sensor measurements recorded in operational window" },

  // --- Group 5: Production Events & Alarms (Indices 42 - 47, 6 dimensions) ---
  { index: 42, name: "events_total_count", domain: "production_event", dtype: "float32", unit: "count", minValid: 0, maxValid: 50, missingPolicy: "zero_fill", description: "Total equipment events recorded during the 1-hour pre-inspection window" },
  { index: 43, name: "events_critical_count", domain: "production_event", dtype: "float32", unit: "count", minValid: 0, maxValid: 20, missingPolicy: "zero_fill", description: "Count of severity='critical' equipment events (line stops, thermal trips)" },
  { index: 44, name: "events_high_count", domain: "production_event", dtype: "float32", unit: "count", minValid: 0, maxValid: 30, missingPolicy: "zero_fill", description: "Count of severity='high' equipment events (speed deviations, tension warnings)" },
  { index: 45, name: "events_thermal_flag", domain: "production_event", dtype: "float32", unit: "binary", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "Binary flag: At least one temperature/thermal excursion event was logged" },
  { index: 46, name: "events_mechanical_flag", domain: "production_event", dtype: "float32", unit: "binary", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "Binary flag: At least one feeder jam, tension fault, or vacuum drop was logged" },
  { index: 47, name: "events_operator_override_flag", domain: "production_event", dtype: "float32", unit: "binary", minValid: 0, maxValid: 1, missingPolicy: "zero_fill", description: "Binary flag: Manual operator override or speed bypass occurred on line" },
] as const;

export const CANONICAL_FEATURE_NAMES_V2 = CANONICAL_FEATURES_V2.map((f) => f.name);
export const CANONICAL_FEATURE_COUNT_V2 = CANONICAL_FEATURES_V2.length; // Exactly 48

/**
 * Legacy 40-feature ordered schema retained for backwards compatibility.
 */
export const CANONICAL_FEATURE_ORDER = [
  "feat_defect_count",
  "feat_max_detection_conf",
  "feat_mean_detection_conf",
  "feat_defect_area_ratio",
  "feat_is_crack",
  "feat_is_star_crack",
  "feat_is_finger",
  "feat_is_thick_line",
  "feat_is_black_core",
  "feat_is_dislocation",
  "feat_is_printing_error",
  "feat_is_short_circuit",
  "soldering_temp_top_mean_w15",
  "soldering_temp_top_std_w15",
  "soldering_temp_top_max_w15",
  "soldering_temp_delta_mean_w15",
  "ribbon_tension_mean_w15",
  "ribbon_tension_std_w15",
  "squeegee_pressure_mean_w15",
  "squeegee_pressure_drift_w60",
  "squeegee_speed_mean_w15",
  "screen_snapoff_mean_w15",
  "paste_temp_mean_w15",
  "paste_viscosity_mean_w15",
  "firing_peak_temp_mean_w15",
  "firing_peak_temp_delta_target",
  "firing_belt_speed_mean_w15",
  "firing_exhaust_pressure_mean_w15",
  "lamination_temp_mean_w15",
  "lamination_vacuum_mean_w15",
  "lamination_pressure_mean_w15",
  "gripper_vacuum_mean_w15",
  "transfer_accel_peak_w15",
  "voc_v",
  "isc_a",
  "fill_factor_pct",
  "series_resistance_mohm",
  "shunt_resistance_ohm",
  "event_count_recent_1h",
  "has_warning_recent_1h",
] as const;

export type CanonicalFeatureName = (typeof CANONICAL_FEATURE_ORDER)[number];

export const ROOT_CAUSE_TAXONOMY = [
  "thermal_stress_soldering",
  "squeegee_pressure_drift",
  "screen_mesh_clogging",
  "firing_thermal_profile_excursion",
  "mechanical_handling_impact",
  "lamination_pressure_imbalance",
  "ingot_thermal_gradient",
  "chemical_texturing_contamination",
  "nominal_process_variation",
] as const;

export type RootCauseClass = (typeof ROOT_CAUSE_TAXONOMY)[number];

export interface ReconciledCatalogItem {
  causeCode: string;
  taxonomyIdentifier: RootCauseClass;
  displayLabel: string;
  responsibleEquipment: string;
  description: string;
  recommendedAction: string;
}

export const RECONCILED_ROOT_CAUSE_CATALOG: Record<RootCauseClass, ReconciledCatalogItem> = {
  thermal_stress_soldering: {
    causeCode: "RC-SOLD-01",
    taxonomyIdentifier: "thermal_stress_soldering",
    displayLabel: "Thermal Stress During Soldering",
    responsibleEquipment: "Tabber / Stringer",
    description: "Excessive soldering head temperature, rapid thermal cycling, or preheat-to-soldering thermal shock causing wafer micro-cracking.",
    recommendedAction: "Recalibrate stringer soldering tip PID controller and inspect thermocouple bonding.",
  },
  squeegee_pressure_drift: {
    causeCode: "RC-PRNT-01",
    taxonomyIdentifier: "squeegee_pressure_drift",
    displayLabel: "Squeegee Pressure Drift",
    responsibleEquipment: "Screen Printer",
    description: "Downward squeegee blade force drift causing non-uniform metallization paste thickness and grid line interruptions.",
    recommendedAction: "Re-level screen printing squeegee blade and calibrate pneumatic pressure regulator.",
  },
  screen_mesh_clogging: {
    causeCode: "RC-PRNT-02",
    taxonomyIdentifier: "screen_mesh_clogging",
    displayLabel: "Screen Mesh Clogging / Paste Drying",
    responsibleEquipment: "Screen Printer",
    description: "Partially dried silver paste or emulsion aperture blockage causing missing contact fingers.",
    recommendedAction: "Execute automated ultrasonic screen wash cycle and verify paste solvent viscosity.",
  },
  firing_thermal_profile_excursion: {
    causeCode: "RC-FURN-01",
    taxonomyIdentifier: "firing_thermal_profile_excursion",
    displayLabel: "Firing Furnace Thermal Profile Excursion",
    responsibleEquipment: "Firing Furnace",
    description: "Thermal zone excursion or conveyor belt speed variance causing improper contact burn-through.",
    recommendedAction: "Perform multi-point thermal profiler pass through furnace and verify belt tachometer.",
  },
  mechanical_handling_impact: {
    causeCode: "RC-MECH-01",
    taxonomyIdentifier: "mechanical_handling_impact",
    displayLabel: "Mechanical Handling Impact / Vacuum Stress",
    responsibleEquipment: "Handling Automation / Robot",
    description: "Excessive suction cup vacuum, track deceleration shock, or guide pin impact inducing stress cracks.",
    recommendedAction: "Inspect robotic end-effector vacuum regulator, reduce suction level, and align guide rails.",
  },
  lamination_pressure_imbalance: {
    causeCode: "RC-LAM-01",
    taxonomyIdentifier: "lamination_pressure_imbalance",
    displayLabel: "Lamination Pressure / Thermal Imbalance",
    responsibleEquipment: "Module Laminator",
    description: "Diaphragm pressure non-uniformity or heating platen temperature delta causing encapsulation faults.",
    recommendedAction: "Check laminator vacuum diaphragm for micro-tears and verify multi-zone platen heating elements.",
  },
  ingot_thermal_gradient: {
    causeCode: "RC-WAF-01",
    taxonomyIdentifier: "ingot_thermal_gradient",
    displayLabel: "Ingot Thermal Gradient / Crystal Stress",
    responsibleEquipment: "Ingot Puller / Wafer Slicer",
    description: "Asymmetric cooling gradient during Czochralski crystallization causing crystallographic dislocations.",
    recommendedAction: "Quarantine wafer lot from current supplier batch and execute incoming EL stress screening.",
  },
  chemical_texturing_contamination: {
    causeCode: "RC-CHEM-01",
    taxonomyIdentifier: "chemical_texturing_contamination",
    displayLabel: "Chemical Texturing Bath Contamination",
    responsibleEquipment: "Wet Chemical Bench",
    description: "Alkaline/acid chemical texturing bath contamination or surfactant depletion altering surface reflectivity.",
    recommendedAction: "Dump and recharge wet bench chemical texturing bath and verify surfactant concentration.",
  },
  nominal_process_variation: {
    causeCode: "RC-SPC-01",
    taxonomyIdentifier: "nominal_process_variation",
    displayLabel: "Nominal Process Variation",
    responsibleEquipment: "All Equipment",
    description: "Natural manufacturing statistical variation within 3-sigma process control boundaries.",
    recommendedAction: "No equipment corrective action required. Continue routine statistical process control monitoring.",
  },
};

export const ROOT_CAUSE_DESCRIPTIONS: Record<RootCauseClass, string> = Object.fromEntries(
  Object.entries(RECONCILED_ROOT_CAUSE_CATALOG).map(([key, item]) => [key, item.description])
) as Record<RootCauseClass, string>;

export interface SensorBounds {
  min: number;
  max: number;
  nominalMean: number;
  unit: string;
}

export const SENSOR_SPECIFICATIONS: Record<string, SensorBounds> = {
  soldering_temp_top_c: { min: 150.0, max: 300.0, nominalMean: 225.0, unit: "C" },
  soldering_temp_bottom_c: { min: 150.0, max: 300.0, nominalMean: 220.0, unit: "C" },
  ribbon_tension_n: { min: 0.1, max: 5.0, nominalMean: 1.2, unit: "N" },
  squeegee_pressure_n_cm2: { min: 5.0, max: 35.0, nominalMean: 18.0, unit: "N/cm2" },
  squeegee_speed_mm_s: { min: 100.0, max: 500.0, nominalMean: 250.0, unit: "mm/s" },
  screen_snapoff_mm: { min: 0.5, max: 4.0, nominalMean: 1.8, unit: "mm" },
  paste_temperature_c: { min: 15.0, max: 35.0, nominalMean: 23.0, unit: "C" },
  paste_viscosity_pa_s: { min: 100.0, max: 450.0, nominalMean: 240.0, unit: "Pa*s" },
  firing_peak_temp_c: { min: 750.0, max: 1000.0, nominalMean: 860.0, unit: "C" },
  firing_belt_speed_m_min: { min: 3.0, max: 9.0, nominalMean: 5.8, unit: "m/min" },
  firing_exhaust_pressure_pa: { min: -100.0, max: 0.0, nominalMean: -35.0, unit: "Pa" },
  lamination_temp_c: { min: 120.0, max: 180.0, nominalMean: 148.0, unit: "C" },
  lamination_vacuum_mbar: { min: 0.01, max: 10.0, nominalMean: 0.8, unit: "mbar" },
  lamination_pressure_bar: { min: 0.2, max: 2.0, nominalMean: 0.9, unit: "bar" },
  gripper_vacuum_kpa: { min: -100.0, max: -20.0, nominalMean: -75.0, unit: "kPa" },
  transfer_accel_max_g: { min: 0.01, max: 3.0, nominalMean: 0.45, unit: "g" },
  voc_v: { min: 0.55, max: 0.78, nominalMean: 0.685, unit: "V" },
  isc_a: { min: 8.0, max: 13.0, nominalMean: 10.85, unit: "A" },
  fill_factor_pct: { min: 65.0, max: 88.0, nominalMean: 81.5, unit: "%" },
  series_resistance_mohm: { min: 0.4, max: 5.0, nominalMean: 1.15, unit: "mOhm" },
  shunt_resistance_ohm: { min: 10.0, max: 5000.0, nominalMean: 650.0, unit: "Ohm" },
};

/**
 * Validates whether an incoming payload has sufficient manufacturing telemetry
 * for meaningful root cause attribution.
 */
export function hasSufficientManufacturingData(input: {
  sensorMeasurements?: unknown[];
  machine?: unknown;
  batch?: unknown;
  productionEvents?: unknown[];
}): boolean {
  const hasSensors = Array.isArray(input.sensorMeasurements) && input.sensorMeasurements.length > 0;
  const hasMachine = input.machine !== undefined && input.machine !== null;
  const hasBatch = input.batch !== undefined && input.batch !== null;
  const hasEvents = Array.isArray(input.productionEvents) && input.productionEvents.length > 0;
  return hasSensors || hasMachine || hasBatch || hasEvents;
}
