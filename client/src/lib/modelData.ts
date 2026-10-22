/**
 * Verified Historical Evaluation Data for Model 1 (Ultralytics YOLO26n)
 * Origin: PVELAD (Photovoltaic Electroluminescence Anomaly Detection / EL2021 Benchmark)
 * 
 * IMPORTANT: In accordance with project engineering standards, these metrics are strictly
 * documented as HISTORICAL EVALUATION BENCHMARK RESULTS on a 792-image held-out subset,
 * NOT live production metrics or universal certification.
 */

export interface ClassEvaluationMetric {
  classId: number;
  key: string;
  label: string;
  groundTruthCount: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface ThresholdEvaluation {
  threshold: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
  notes: string;
}

export const HISTORICAL_MODEL_EVALUATION = {
  architecture: "Ultralytics YOLO26n (YOLOv8n DetectionModel)",
  checkpointFile: "backend/models/best.pt",
  checkpointSha256: "59650dafe43c178e89af3d439b283ebf1c3e4abe6239aaa111c62afa41b7a7c6",
  parameterCount: 2507310,
  layers: 146,
  gflops: 5.2,
  inputResolution: "640 × 640 (letterbox normalized)",
  datasetOrigin: "PVELAD / EL2021 Benchmark (Photovoltaic Electroluminescence Anomaly Detection)",
  evaluationSubsetImages: 792,
  evaluationTimestamp: "2026-10-21T13:36:07Z",
  samplingMethod: "Stratified random sampling across all 9 defect classes with 100% rare-class coverage",
  
  // Official Ultralytics Metrics at 0.25 (as reported in docs/results/evaluation_report.json)
  metricsAt025: {
    mAP50: 0.6975, // 69.75%
    mAP50_95: 0.4456, // 44.56%
    precision: 0.7428, // 74.28%
    recall: 0.6516, // 65.16%
    f1: 0.7287, // 72.87%
    truePositives: 1379,
    falsePositives: 515,
    falseNegatives: 512,
  },

  // High Sensitivity Threshold 0.10 Comparison
  metricsAt010: {
    threshold: 0.10,
    truePositives: 1554,
    falsePositives: 1072,
    falseNegatives: 337,
    precision: 0.5918, // 59.18%
    recall: 0.8218, // 82.18%
    f1: 0.6881, // 68.81%
    notes: "Recovers +175 true detections (+9.26% recall), but increases false positives by 108% (1,072 vs 515). Recommended only for secondary screening.",
  },

  // Per-class evaluation results on 792 held-out images at threshold 0.25
  classMetrics: [
    {
      classId: 0,
      key: "crack",
      label: "Micro-Crack",
      groundTruthCount: 218,
      truePositives: 135,
      falsePositives: 85,
      falseNegatives: 83,
      precision: 0.6136,
      recall: 0.6193,
      f1: 0.6164,
    },
    {
      classId: 1,
      key: "finger",
      label: "Broken Finger",
      groundTruthCount: 499,
      truePositives: 448,
      falsePositives: 164,
      falseNegatives: 51,
      precision: 0.7320,
      recall: 0.8978,
      f1: 0.8065,
    },
    {
      classId: 2,
      key: "black_core",
      label: "Black Core",
      groundTruthCount: 110,
      truePositives: 3,
      falsePositives: 0,
      falseNegatives: 107,
      precision: 1.0000,
      recall: 0.0273,
      f1: 0.0531,
    },
    {
      classId: 3,
      key: "thick_line",
      label: "Thick Line",
      groundTruthCount: 198,
      truePositives: 125,
      falsePositives: 61,
      falseNegatives: 73,
      precision: 0.6720,
      recall: 0.6313,
      f1: 0.6510,
    },
    {
      classId: 4,
      key: "star_crack",
      label: "Star Crack",
      groundTruthCount: 83,
      truePositives: 63,
      falsePositives: 17,
      falseNegatives: 20,
      precision: 0.7875,
      recall: 0.7590,
      f1: 0.7730,
    },
    {
      classId: 5,
      key: "horizontal_dislocation",
      label: "Horizontal Dislocation",
      groundTruthCount: 321,
      truePositives: 319,
      falsePositives: 34,
      falseNegatives: 2,
      precision: 0.9037,
      recall: 0.9938,
      f1: 0.9466,
    },
    {
      classId: 6,
      key: "vertical_dislocation",
      label: "Vertical Dislocation",
      groundTruthCount: 271,
      truePositives: 204,
      falsePositives: 91,
      falseNegatives: 67,
      precision: 0.6915,
      recall: 0.7528,
      f1: 0.7208,
    },
    {
      classId: 7,
      key: "printing_error",
      label: "Printing Error",
      groundTruthCount: 48,
      truePositives: 34,
      falsePositives: 2,
      falseNegatives: 14,
      precision: 0.9444,
      recall: 0.7083,
      f1: 0.8095,
    },
    {
      classId: 8,
      key: "short_circuit",
      label: "Short Circuit",
      groundTruthCount: 143,
      truePositives: 48,
      falsePositives: 61,
      falseNegatives: 95,
      precision: 0.4404,
      recall: 0.3357,
      f1: 0.3810,
    },
  ],

  // Known Blind Spots and Operational Constraints
  knownLimitations: [
    {
      title: "Black Core Low Recall (2.73% at 0.25)",
      impact: "Diffuse boundary morphology in central wafer regions is frequently missed by standard bounding box priors at 0.25 threshold.",
      recommendation: "Operator visual verification required for dark center wafer patterns.",
    },
    {
      title: "Short Circuit Contrast Sensitivity (33.57% Recall)",
      impact: "Shunt and current leakage pathways with weak electroluminescence drop below confidence cutoff.",
      recommendation: "Use 0.10 sensitivity mode for suspected electrical shunts.",
    },
    {
      title: "Busbar Confusion at Lower Thresholds",
      impact: "Thresholds below 0.15 trigger elevated false positives on benign multi-busbar wire solder pads.",
      recommendation: "Production baseline must remain locked at 0.25 threshold.",
    },
  ],
};
