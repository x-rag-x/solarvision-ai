/**
 * SolarVision AI — Model 4: Predictive Maintenance Benchmark Data & Provenance
 * 
 * Dataset: AI4I 2020 Predictive Maintenance Dataset
 * Source: UCI Machine Learning Repository / Siemens Industrial Automation
 * DOI: 10.24432/C5HS5C (Matzka, S., 2020)
 * License: CC-BY 4.0
 * 
 * STRICT COMPLIANCE (TASK 1 & TASK 3):
 * - Exactly matches Agent 3's final saved evaluation metrics from model4_predictive_maintenance.json.
 * - Removed unverified static metrics (99.8% acc, 0.985 rocAuc, etc.).
 * - Presets verified against authentic rows in ai4i2020.csv with exact measurement values and identities.
 * - Removed hardcoded expected probabilities from display logic.
 * - Clarifies RUL = N/A (Operating condition failure classification only).
 */

import type {
  BenchmarkMetadata,
  PresetMaintenanceSample,
  SolarEquipmentItem,
} from "./types";

/**
 * Genuine test split evaluation metrics from Agent 3's model4_predictive_maintenance.json:
 * - Test split: N = 1,502 samples (stratified random split)
 * - Optimal calibrated threshold: tau* = 0.1981
 * - TP: 25, FP: 23, TN: 1427, FN: 27
 */
export const VERIFIED_BENCHMARK_METADATA: BenchmarkMetadata = {
  datasetName: "UCI AI4I 2020 Predictive Maintenance Dataset",
  datasetDoi: "10.24432/C5HS5C",
  datasetCitation:
    "Matzka, S. (2020). Explainable Artificial Intelligence for Predictive Maintenance: A General Approach with Automated Feature Engineering. IEEE International Conference on Emerging Technologies and Factory Automation (ETFA 2020).",
  datasetLicense: "Creative Commons Attribution 4.0 International (CC BY 4.0)",
  datasetAuthor: "Stephan Matzka (HTW Berlin / Siemens Industrial Automation)",
  framework: "PyTorch_NumPy_SciPy",
  modelVersion: "4.0.0-benchmark",
  targetDescription:
    "Operating-condition binary machine failure classification using 6 physical measurements.",
  metrics: {
    accuracy: 0.9667,
    balancedAccuracy: 0.7325,
    rocAuc: 0.9307,
    prAuc: 0.4796,
    precision: 0.5208,
    recall: 0.4808,
    f1Score: 0.5,
    specificityNormal: 0.9841,
    totalRecords: 10000,
    healthyCount: 9661,
    failureCount: 339,
    imbalanceRatio: 28.5,
    thresholdUsed: 0.1981,
    testSamples: 1502,
    truePositives: 25,
    falsePositives: 23,
    trueNegatives: 1427,
    falseNegatives: 27,
    brierScore: 0.0236,
    ece: 0.0113,
  },
  limitations: [
    "AI4I 2020 is a synthetic physics-based simulation reflecting automated milling machinery rules.",
    "Classification represents current instantaneous operating condition risk, NOT a continuous Remaining Useful Life (RUL) trajectory or prognostic time-to-failure.",
    "Per-failure-mode breakdowns (TWF, HDF, PWF, OSF) in the dataset are deterministic physical rules, not a multi-class trained model.",
    "STRICTLY FORBIDDEN to use benchmark predictions for solar cell tabber/stringer cutters, laminator vacuum pumps, or firing furnace maintenance decisions without in-situ factory telemetry.",
  ],
};

/**
 * Curated demonstration presets verified against authentic rows in ai4i2020.csv
 * or explicitly labeled as custom synthesized boundary scenarios.
 * 
 * NOTE: Hardcoded probability expectations have been removed. All probabilities
 * must be generated dynamically by actual inference.
 */
export const PRESET_MAINTENANCE_SAMPLES: PresetMaintenanceSample[] = [
  {
    id: "preset-ai4i-udi12",
    name: "AI4I Record #UDI-0012 (Nominal Health)",
    description:
      "Authentic AI4I dataset observation representing normal spindle speed, standard torque, and low tool wear.",
    sourceCategory: "authentic_benchmark_record",
    sourceReference: "AI4I 2020 Dataset — UDI 12, Product ID H29425 (Machine failure = 0)",
    measurements: {
      productType: "H",
      airTemperatureK: 298.6,
      processTemperatureK: 309.1,
      rotationalSpeedRpm: 1423,
      torqueNm: 44.3,
      toolWearMin: 29,
      machineId: "AI4I-BENCHMARK-MILL-01",
      subsystem: "Milling Spindle & Cutter Head",
    },
  },
  {
    id: "preset-ai4i-udi161",
    name: "AI4I Record #UDI-0161 (Overstrain Failure)",
    description:
      "Authentic AI4I dataset failure observation where combined tool wear and motor torque exceed physical shear stress (OSF).",
    sourceCategory: "authentic_benchmark_record",
    sourceReference: "AI4I 2020 Dataset — UDI 161, Product ID L47340 (Machine failure = 1, OSF = 1)",
    measurements: {
      productType: "L",
      airTemperatureK: 298.4,
      processTemperatureK: 308.2,
      rotationalSpeedRpm: 1282,
      torqueNm: 60.7,
      toolWearMin: 216,
      machineId: "AI4I-BENCHMARK-MILL-01",
      subsystem: "Spindle Drive Servo",
    },
  },
  {
    id: "preset-ai4i-udi3237",
    name: "AI4I Record #UDI-3237 (Heat Dissipation Failure)",
    description:
      "Authentic AI4I dataset failure observation with sub-critical thermal gradient (ΔT <= 8.6 K) at low spindle speed (HDF).",
    sourceCategory: "authentic_benchmark_record",
    sourceReference: "AI4I 2020 Dataset — UDI 3237, Product ID M18096 (Machine failure = 1, HDF = 1)",
    measurements: {
      productType: "M",
      airTemperatureK: 300.8,
      processTemperatureK: 309.4,
      rotationalSpeedRpm: 1342,
      torqueNm: 62.4,
      toolWearMin: 113,
      machineId: "AI4I-BENCHMARK-MILL-02",
      subsystem: "Cooling & Thermal Jacket",
    },
  },
  {
    id: "preset-custom-power-stress",
    name: "Custom Scenario: High-Speed Power Excursion",
    description:
      "Custom synthesized test scenario where spindle velocity and motor torque produce mechanical power exceeding the 9,000 W threshold (PWF).",
    sourceCategory: "custom_stress_scenario",
    sourceReference: "Custom Synthetic Scenario (Engineering Stress Test — Not an authentic AI4I dataset row)",
    measurements: {
      productType: "L",
      airTemperatureK: 298.4,
      processTemperatureK: 308.3,
      rotationalSpeedRpm: 2850,
      torqueNm: 38.5,
      toolWearMin: 90,
      machineId: "SYNTHETIC-STRESS-BENCH",
      subsystem: "High-Speed Variable Drive",
    },
  },
];

/**
 * Production Solar Manufacturing Equipment Inventory
 * All equipment is strictly marked NOT_TRAINED / DATASET_BLOCKED pending factory IoT instrumentation.
 */
export const SOLAR_EQUIPMENT_CATALOG: SolarEquipmentItem[] = [
  {
    id: "EQ-STR-01",
    name: "Tabber & Stringer Station #01",
    station: "Cell Interconnection & Ribbon Soldering",
    subsystem: "Cutter Shear Blade & Solder Induction Head",
    status: "DATASET_BLOCKED",
    criticalSensorTypes: [
      "Piezoelectric Accelerometer (10 kHz)",
      "Servo Torque Feedback (Nm)",
      "Induction Pyrometer (°C)",
      "Pick Vacuum Switch (mbar)",
    ],
    telemetryStreamCount: 0,
    maintenanceLogCount: 0,
    eligibleTrainingTrajectories: 0,
  },
  {
    id: "EQ-LAM-02",
    name: "Vacuum Laminator #02",
    station: "Photovoltaic Module Encapsulation",
    subsystem: "Silicone Diaphragm & Rotary Screw Vacuum Pump",
    status: "DATASET_BLOCKED",
    criticalSensorTypes: [
      "Pirani Vacuum Transducer (0.1 mbar)",
      "Platen Multi-Zone RTD Array",
      "Pump Drive RMS Vibration",
      "Diaphragm Inflation Cycle Counter",
    ],
    telemetryStreamCount: 0,
    maintenanceLogCount: 0,
    eligibleTrainingTrajectories: 0,
  },
  {
    id: "EQ-FUR-03",
    name: "Fast-Firing Furnace #03",
    station: "Front & Rear Contact Metallization Firing",
    subsystem: "High-Temp Conveyor Mesh Belt & IR Quartz Lamps",
    status: "DATASET_BLOCKED",
    criticalSensorTypes: [
      "Belt Drive Optical Tachometer",
      "Idler Take-Up Load Cell (N)",
      "IR Lamp Bank Current Transformers",
      "Zone Fast-Response Pyrometers",
    ],
    telemetryStreamCount: 0,
    maintenanceLogCount: 0,
    eligibleTrainingTrajectories: 0,
  },
  {
    id: "EQ-PRT-01",
    name: "Screen Printer #01",
    station: "Silver Grid Finger & Busbar Deposition",
    subsystem: "Polyurethane Squeegee Blade & Stencil Mesh",
    status: "DATASET_BLOCKED",
    criticalSensorTypes: [
      "Squeegee Downforce Load Cells",
      "Traverse Axis Servo Current",
      "Stroke Cumulative Counter",
      "Electronic Screen Tensiometer",
    ],
    telemetryStreamCount: 0,
    maintenanceLogCount: 0,
    eligibleTrainingTrajectories: 0,
  },
];

