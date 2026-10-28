/**
 * SolarVision AI — Model 3: Sandia Model Architecture Variants
 * Future Architectural Specifications & Operational State Declarations
 * 
 * STRICT SCIENTIFIC HONESTY:
 * Only the Sandia Tabular Predictor is linked to the active backend inference engine.
 * EL-Image Multimodal Fusion and Sequential Next-Observation Forecaster are explicitly
 * labeled as experimental/planned research variants, NOT operational inference endpoints.
 */

import type { ModelVariantInfo } from "./types";

export const MODEL_VARIANTS: ModelVariantInfo[] = [
  {
    id: "sandia_tabular",
    name: "Sandia Tabular Electrical Predictor",
    headline: "Sensor Telemetry & IV Characteristic Curve Regression",
    status: "operational",
    badge: "Foundation Model",
    description:
      "Predicts instantaneous photovoltaic electrical performance parameters (maximum power output, power retention, or module efficiency) directly from calibrated environmental sensor telemetry matching trainer specifications.",
    inputs: [
      "In-plane Irradiance (W/m²)",
      "Back-of-Module / Cell Temp (°C)",
      "Ambient Temperature (°C)",
      "Wind Speed (m/s)",
      "Direct Normal Irradiance (W/m²)",
    ],
    target: "Peak Electrical Output (Pmp) / Power Retention",
    readinessNotice:
      "Operational inference engine connected via backend scikit-learn pipeline and dynamic feature schema contract.",
  },
  {
    id: "el_multimodal",
    name: "EL-Image + Telemetry Multimodal Fusion",
    headline: "Optical Electroluminescence Microcracks Fused with Environmental Telemetry",
    status: "in_development",
    badge: "Experimental Research",
    description:
      "Cross-domain multimodal architecture that combines high-resolution electroluminescence (EL) imagery from Model 1 defect detection with concurrent Sandia field sensor telemetry to model mechanical defect-driven electrical derating.",
    inputs: [
      "Electroluminescence (EL) Near-Infrared Image",
      "Model 1 Microcrack Detection Vectors",
      "Defect Surface Area Loss Ratio (%)",
      "Calibrated Sensor Irradiance (W/m²)",
    ],
    target: "Degradation-Adjusted Electrical Capacity",
    readinessNotice:
      "Research prototype in active development. Inference API is quarantined until joint multimodal training and validation are finalized.",
  },
  {
    id: "next_obs_forecasting",
    name: "Sequential Next-Observation Time-Series Forecaster",
    headline: "Dynamic Autoregressive Yield & Diurnal Telemetry Forecasting",
    status: "planned",
    badge: "Roadmap Architecture",
    description:
      "Sequential sliding-window temporal forecaster modeling power ramps, diurnal cloud transients, and progressive soiling trajectories across continuous operational intervals.",
    inputs: [
      "Sliding-window Telemetry (t-12 to t-1)",
      "Solar Zenith & Azimuth Angles",
      "Cloud Transmittance Index",
      "Historical Power Trajectory",
    ],
    target: "Next-Interval Electrical Yield (t+1, t+5 min)",
    readinessNotice:
      "Specification defined in project roadmap. Serving pipeline will be activated upon delivery of continuous time-series training corpus.",
  },
];
