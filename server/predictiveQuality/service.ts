/**
 * SolarVision AI — Model 3: Predictive Quality Monitoring
 * Orchestration Service, Inference Bridge & Domain Segregation
 */

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import {
  hasSufficientQualityFeatures,
  MODEL3_CONTRACT_VERSION,
  CANONICAL_SOLAR_FEATURE_COUNT,
} from "./featureContract";
import type {
  PredictiveQualityInput,
  PredictiveQualityResponse,
  Model3StatusInfo,
  BenchmarkPredictInput,
  BenchmarkMetadataResponse,
} from "./types";

const PYTHON_EXECUTABLE = process.platform === "win32"
  ? resolve(process.cwd(), "backend/.venv/Scripts/python.exe")
  : resolve(process.cwd(), "backend/.venv/bin/python");

const FALLBACK_PYTHON = process.platform === "win32" ? "python" : "python3";

export const BENCHMARK_RAW_FEATURE_COUNT = 590;

export const BENCHMARK_ARTIFACT_PATH = resolve(
  process.cwd(),
  "backend/training/predictive_quality/artifacts/model3_predictive_quality.json"
);

export const SOLAR_ARTIFACT_PATH = resolve(
  process.cwd(),
  "backend/models/predictive_quality/model3_predictive_quality.json"
);

function getPythonCmd(): string {
  if (process.env.PYTHON_EXECUTABLE) {
    return process.env.PYTHON_EXECUTABLE;
  }
  if (existsSync(PYTHON_EXECUTABLE)) {
    return PYTHON_EXECUTABLE;
  }
  return FALLBACK_PYTHON;
}

/**
 * Checks whether the semiconductor benchmark artifact is present.
 */
export function isBenchmarkArtifactPresent(): boolean {
  return existsSync(BENCHMARK_ARTIFACT_PATH);
}

/**
 * Checks whether the solar manufacturing model checkpoint is present.
 */
export function isSolarArtifactPresent(): boolean {
  return existsSync(SOLAR_ARTIFACT_PATH);
}

/**
 * Alias for solar model artifact presence.
 */
export function isModel3ArtifactPresent(): boolean {
  return isSolarArtifactPresent();
}

/**
 * Executes Model 3 predictive quality forecasting.
 * Enforces truthful zero-fabrication guarantees and strict domain segregation.
 */
export async function forecastPredictiveQuality(
  input: PredictiveQualityInput
): Promise<PredictiveQualityResponse> {
  const startTime = Date.now();
  const domain = input.domain || "solar_cell_manufacturing";

  // 1. Check feature sufficiency
  if (!hasSufficientQualityFeatures(input)) {
    return {
      contractVersion: MODEL3_CONTRACT_VERSION,
      status: "missing_features",
      domain,
      batchId: input.batchId ?? null,
      machineId: input.machineId ?? null,
      qualityOutcome: "unknown",
      riskLevel: "unknown",
      probabilities: {},
      confidence: null,
      isCalibrated: false,
      calibrationMethod: "none",
      predictedDefectRate: null,
      predictedYield: null,
      confidenceInterval: null,
      topRiskFactors: [],
      recommendedAction: domain === "semiconductor_benchmark"
        ? "Insufficient semiconductor process telemetry. Provide 590-dimensional SECOM feature vector."
        : "Insufficient manufacturing measurement features. Supply flash-test electrical metrics, process sensors, or defect summary.",
      modelVersion: "none",
      modelMetadata: null,
      limitations: [
        "Missing manufacturing process telemetry.",
        domain === "semiconductor_benchmark"
          ? "Semiconductor benchmark requires a valid 590-feature vector."
          : "Predictive quality forecast requires at least one of: flash-test electrical parameters, process sensors, defect counts, or direct feature vector.",
      ],
      processingTimeMs: Date.now() - startTime,
    };
  }

  // 2. Strict Domain Segregation and Zero-Fabrication Checks
  if (domain === "solar_cell_manufacturing") {
    if (!isSolarArtifactPresent()) {
      return {
        contractVersion: MODEL3_CONTRACT_VERSION,
        status: "not_trained",
        domain,
        batchId: input.batchId ?? null,
        machineId: input.machineId ?? null,
        qualityOutcome: "unknown",
        riskLevel: "unknown",
        probabilities: {},
        confidence: null,
        isCalibrated: false,
        calibrationMethod: "none",
        predictedDefectRate: null,
        predictedYield: null,
        confidenceInterval: null,
        topRiskFactors: [],
        recommendedAction: null,
        modelVersion: "none",
        modelMetadata: null,
        limitations: [
          "Model 3 is not ready for production inference: Solar manufacturing checkpoint not found.",
          "Production training is blocked pending verified manufacturing quality outcome datasets.",
          "Zero synthetic forecasts or fabricated confidence values are returned.",
          "Domain requested: solar cell manufacturing. Factory yield training dataset is currently pending.",
        ],
        processingTimeMs: Date.now() - startTime,
      };
    }
  } else if (domain === "semiconductor_benchmark") {
    if (!isBenchmarkArtifactPresent()) {
      return {
        contractVersion: MODEL3_CONTRACT_VERSION,
        status: "not_trained",
        domain,
        batchId: input.batchId ?? null,
        machineId: input.machineId ?? null,
        qualityOutcome: "unknown",
        riskLevel: "unknown",
        probabilities: {},
        confidence: null,
        isCalibrated: false,
        calibrationMethod: "none",
        predictedDefectRate: null,
        predictedYield: null,
        confidenceInterval: null,
        topRiskFactors: [],
        recommendedAction: null,
        modelVersion: "none",
        modelMetadata: null,
        limitations: [
          "Model 3 semiconductor benchmark artifact not found.",
          "External benchmark checkpoint is not deployed.",
        ],
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  // 3. Invoke Python execution engine
  try {
    const pythonCmd = getPythonCmd();
    const script = `
import sys, json
from backend.app.predictive_quality.schemas import PredictiveQualityInput
from backend.app.predictive_quality.service import predictive_quality_service

payload = json.loads(sys.stdin.read())
req = PredictiveQualityInput(**payload)
res = predictive_quality_service.forecast(req)
print(json.dumps(res.to_shared_dict()))
`;

    const proc = spawn(pythonCmd, ["-c", script], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONPATH: process.cwd() },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", chunk => { stdout += chunk; });
    proc.stderr.on("data", chunk => { stderr += chunk; });

    const timeoutMs = 20000;
    const exitCode = await new Promise<number>((res, rej) => {
      const timer = setTimeout(() => {
        try { proc.kill("SIGKILL"); } catch {}
        rej(new Error(`Model 3 process timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      proc.on("error", (err) => {
        clearTimeout(timer);
        rej(err);
      });

      proc.on("close", (code) => {
        clearTimeout(timer);
        res(code ?? 0);
      });

      // Map camelCase to snake_case for Python Pydantic input
      const pythonPayload = {
        batch_id: input.batchId,
        machine_id: input.machineId,
        wafer_id: input.waferId,
        domain: domain,
        feature_vector: input.featureVector,
        raw_features: input.rawFeatures,
        confidence_threshold: input.confidenceThreshold ?? 0.5,
        electrical_parameters: input.electricalParameters ? {
          voc_v: input.electricalParameters.voc_v,
          isc_a: input.electricalParameters.isc_a,
          fill_factor_pct: input.electricalParameters.fillFactorPct,
          series_resistance_mohm: input.electricalParameters.seriesResistanceMohm,
          shunt_resistance_ohm: input.electricalParameters.shuntResistanceOhm,
          cell_efficiency_pct: input.electricalParameters.cellEfficiencyPct,
        } : undefined,
        sensor_measurements: input.sensorMeasurements ? input.sensorMeasurements.map(sm => ({
          sensor_type: sm.sensorType,
          measurement_value: sm.measurementValue,
          unit: sm.unit,
          recorded_at: sm.recordedAt,
        })) : undefined,
        defect_summary: input.defectSummary ? {
          total_defect_count: input.defectSummary.totalDefectCount ?? 0,
          crack_count: input.defectSummary.crackCount ?? 0,
          finger_interruption_count: input.defectSummary.fingerInterruptionCount ?? 0,
          busbar_defect_count: input.defectSummary.busbarDefectCount ?? 0,
          defect_area_ratio: input.defectSummary.defectAreaRatio ?? 0.0,
          mean_confidence: input.defectSummary.meanConfidence ?? 0.0,
        } : undefined,
      };

      proc.stdin.write(JSON.stringify(pythonPayload));
      proc.stdin.end();
    });

    if (exitCode === 0 && stdout.trim()) {
      const parsed = JSON.parse(stdout.trim());
      return {
        ...parsed,
        processingTimeMs: Date.now() - startTime,
      };
    }

    throw new Error(`Python engine exited with code ${exitCode}: ${stderr}`);
  } catch (err: any) {
    return {
      contractVersion: MODEL3_CONTRACT_VERSION,
      status: "error",
      domain,
      batchId: input.batchId ?? null,
      machineId: input.machineId ?? null,
      qualityOutcome: "unknown",
      riskLevel: "unknown",
      probabilities: {},
      confidence: null,
      isCalibrated: false,
      calibrationMethod: "none",
      predictedDefectRate: null,
      predictedYield: null,
      confidenceInterval: null,
      topRiskFactors: [],
      recommendedAction: null,
      modelVersion: "none",
      modelMetadata: null,
      limitations: [`Inference execution error: ${err.message || String(err)}`],
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Dedicated execution procedure for semiconductor benchmark inference.
 * Rejects non-590 vectors and strictly prohibits arbitrary paths.
 */
export async function predictBenchmarkQuality(
  input: BenchmarkPredictInput
): Promise<PredictiveQualityResponse> {
  if (!input.features || input.features.length !== BENCHMARK_RAW_FEATURE_COUNT) {
    throw new Error(
      `SECOM benchmark requires exactly ${BENCHMARK_RAW_FEATURE_COUNT} input features, ` +
      `received ${input.features ? input.features.length : 0}.`
    );
  }

  return forecastPredictiveQuality({
    domain: "semiconductor_benchmark",
    batchId: input.batchId,
    waferId: input.waferId,
    featureVector: input.features,
  });
}

/**
 * Returns Model 3 deployment and readiness status.
 */
export async function getModel3Status(domain?: string): Promise<Model3StatusInfo & { benchmarkReady?: boolean; solarReady?: boolean }> {
  const targetDomain = domain || "solar_cell_manufacturing";
  const benchmarkReady = isBenchmarkArtifactPresent();
  const solarReady = isSolarArtifactPresent();

  if (targetDomain === "semiconductor_benchmark") {
    let version = "3.0.0-benchmark";
    let isCalibrated = true;
    let calibMethod = "empirical_binned";
    try {
      if (benchmarkReady) {
        const raw = JSON.parse(readFileSync(BENCHMARK_ARTIFACT_PATH, "utf-8"));
        version = raw.metadata?.model_version || version;
        isCalibrated = !!raw.metadata?.calibration_metrics?.is_calibrated;
      }
    } catch {
      // ignore
    }

    return {
      modelName: "SolarVision_Gradient_Boosting_SECOM",
      isReady: benchmarkReady,
      modelVersion: benchmarkReady ? version : "none",
      domain: "semiconductor_benchmark",
      artifactPath: BENCHMARK_ARTIFACT_PATH,
      unavailabilityReason: benchmarkReady
        ? undefined
        : "Semiconductor benchmark artifact not found at configured path.",
      expectedDim: BENCHMARK_RAW_FEATURE_COUNT,
      schemaVersion: "3.0.0",
      isCalibrated,
      calibrationMethod: calibMethod,
      benchmarkReady,
      solarReady,
    };
  }

  return {
    modelName: "SolarVision-PQ-Model3",
    isReady: solarReady,
    modelVersion: solarReady ? "1.0.0" : "none",
    domain: "solar_cell_manufacturing",
    artifactPath: SOLAR_ARTIFACT_PATH,
    unavailabilityReason: solarReady
      ? undefined
      : "Model 3 checkpoint not found. Solar manufacturing training blocked pending verified manufacturing quality outcome datasets.",
    expectedDim: CANONICAL_SOLAR_FEATURE_COUNT,
    schemaVersion: MODEL3_CONTRACT_VERSION,
    isCalibrated: false,
    calibrationMethod: "none",
    benchmarkReady,
    solarReady,
  };
}

/**
 * Returns UCI SECOM benchmark metadata, provenance, and domain disclaimers.
 */
export function getBenchmarkMetadata(): BenchmarkMetadataResponse {
  let artifactMetadata: any = {};
  if (isBenchmarkArtifactPresent()) {
    try {
      const data = JSON.parse(readFileSync(BENCHMARK_ARTIFACT_PATH, "utf-8"));
      artifactMetadata = data.metadata || {};
    } catch {
      // fallback
    }
  }

  return {
    benchmarkName: "UCI SECOM Semiconductor Yield Benchmark",
    datasetName: artifactMetadata.dataset_name || "UCI Machine Learning Repository SECOM Dataset",
    doi: artifactMetadata.dataset_doi || "10.24432/C57G69",
    license: artifactMetadata.dataset_license || "Creative Commons Attribution 4.0 International (CC-BY 4.0)",
    domain: "semiconductor_benchmark",
    targetClasses: ["pass", "fail"],
    labelMeaning: "0 (Pass): In-spec semiconductor yield, 1 (Fail): Excursion / scrap",
    inputFeatureCount: BENCHMARK_RAW_FEATURE_COUNT,
    retainedFeatureCount: artifactMetadata.retained_feature_count || 444,
    transformedFeatureCount: artifactMetadata.output_feature_count || 744,
    optimalThreshold: artifactMetadata.optimal_threshold || 0.07,
    calibrationMetrics: artifactMetadata.calibration_metrics,
    isReady: isBenchmarkArtifactPresent(),
    sha256: artifactMetadata.sha256_hash || null,
    disclaimer: (
      "GENERAL SEMICONDUCTOR QUALITY BENCHMARK (UCI SECOM). " +
      "NOT A SOLAR-CELL FACTORY VALIDATION. " +
      "Benchmark predictions are distinct from solar cell manufacturing models and not intended for PV fab control."
    ),
  };
}
