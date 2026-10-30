/**
 * SolarVision AI — Model 2: ELPV Cell Defectiveness Screening
 * Node Service & Orchestration Bridge
 */

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { saveCellScreening, getCellScreenings, getCellScreeningById, type CellScreeningRecord, type RequesterContext } from "../db";
import { storagePut } from "../storage";
import { appLogger } from "../systemHealth/logger";
import { model2ScreeningSummary } from "../../client_contract/model2";
import type {
  CellScreeningInput,
  CellScreeningResponse,
  Model2BenchmarkCaveats,
  Model2ScreeningResult,
  Model2ScreeningStatusInfo,
} from "./types";

const cwd = resolve(process.cwd());
const MODEL_DIR = resolve(cwd, "backend/models/model2_elpv_v1");
const CHECKPOINT_PATH = resolve(MODEL_DIR, "model2_efficientnet_b0.pt");
const PREPROCESSING_PATH = resolve(MODEL_DIR, "model2_preprocessing.json");
const METRICS_PATH = resolve(MODEL_DIR, "model2_metrics.json");

const MAX_BYTES = 8 * 1024 * 1024; // 8 MiB strict payload limit
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/tiff",
  "image/bmp",
  "image/webp",
]);

function resolvePythonExecutable(): string {
  const localPython =
    process.platform === "win32"
      ? join(cwd, "backend/.venv/Scripts/python.exe")
      : join(cwd, "backend/.venv/bin/python3");
  return process.env.PYTHON_EXECUTABLE || (existsSync(localPython) ? localPython : process.platform === "win32" ? "python" : "python3");
}

function runPythonCli(args: string[], timeoutMs = 25_000): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const pythonExe = resolvePythonExecutable();
    const child = spawn(pythonExe, args, {
      cwd,
      env: { ...process.env, PYTHONPATH: cwd },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      reject(new Error(`Model 2 screening CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout?.on("data", chunk => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", chunk => {
      stderr += chunk.toString();
    });

    child.on("error", err => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", code => {
      clearTimeout(timer);
      if (timedOut) return;
      if (code === 0) {
        resolvePromise(stdout);
      } else {
        const errorMsg = stderr.trim() || stdout.trim() || `Screening process exited with code ${code}`;
        reject(new Error(errorMsg));
      }
    });
  });
}

/**
 * Returns Model 2 status, checkpoint verification, and documented benchmark metrics.
 */
export function getModel2ScreeningStatus(): Model2ScreeningStatusInfo {
  const artifactsPresent = existsSync(CHECKPOINT_PATH) && existsSync(PREPROCESSING_PATH);

  let benchmark: Model2BenchmarkCaveats = {
    modelId: "solarvision_m2_elpv_binary_v1",
    dataset: "ELPV 1.0.0.post1",
    license: "CC BY-NC-SA 4.0",
    accuracy: 0.6981,
    defectiveRecall: 0.6867,
    defectivePrecision: 0.4597,
    f1Defective: 0.5507,
    threshold: 0.55,
    testSetSize: 308,
    testHealthyCount: 225,
    testDefectiveCount: 83,
    truePositives: 57,
    trueNegatives: 158,
    falsePositives: 67,
    falseNegatives: 26,
    splitStrategy: "64-consecutive-filename proxy blocks; unioned 584 reviewed SSIM>=.97 candidate pairs; selected by label balance only",
    trueModuleIdsPresent: false,
    limitations: [
      "Research benchmark with 69.81% accuracy, 68.67% defective recall, 45.97% defective precision on 308 held-out images.",
      "Original physical solar module IDs unavailable in ELPV dataset; proxy filename-block split only.",
      "Evaluates a single cropped full solar cell electroluminescence (EL) image. Never input YOLO bounding boxes or whole modules.",
      "Threshold 0.55 was validation-selected; predicted scores do not represent calibrated probability or physical defect severity.",
      "Zero automatic PASS/REJECT decisions: mandatory human operator review required on every screening.",
      "Model 1 YOLO dataset does NOT share physical cell identifiers with ELPV.",
    ],
  };

  if (existsSync(METRICS_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(METRICS_PATH, "utf-8"));
      benchmark = {
        modelId: raw.model_id || benchmark.modelId,
        dataset: raw.dataset || benchmark.dataset,
        license: "CC BY-NC-SA 4.0",
        accuracy: Math.round((raw.test?.accuracy ?? 0.698052) * 10000) / 10000,
        defectiveRecall: Math.round((raw.test?.recall_defective ?? 0.686747) * 10000) / 10000,
        defectivePrecision: Math.round((raw.test?.precision_defective ?? 0.459677) * 10000) / 10000,
        f1Defective: Math.round((raw.test?.f1_defective ?? 0.550725) * 10000) / 10000,
        threshold: 0.55,
        testSetSize: raw.test?.test_n ?? 308,
        testHealthyCount: raw.test?.test_class_counts?.healthy ?? 225,
        testDefectiveCount: raw.test?.test_class_counts?.defective ?? 83,
        truePositives: raw.test?.confusion_matrix_healthy_defective?.[1]?.[1] ?? 57,
        trueNegatives: raw.test?.confusion_matrix_healthy_defective?.[0]?.[0] ?? 158,
        falsePositives: raw.test?.confusion_matrix_healthy_defective?.[0]?.[1] ?? 67,
        falseNegatives: raw.test?.confusion_matrix_healthy_defective?.[1]?.[0] ?? 26,
        splitStrategy: raw.split_strategy || benchmark.splitStrategy,
        trueModuleIdsPresent: Boolean(raw.true_module_ids_present),
        limitations: [
          ...(raw.limitations || benchmark.limitations),
          "Mandatory operator review required on every output: zero automatic PASS/REJECT decisions.",
        ],
      };
    } catch (err) {
      console.warn("[Model2] Error parsing metrics json:", err);
    }
  }

  return {
    modelId: "solarvision_m2_elpv_binary_v1",
    artifactsPresent,
    checkpointPath: CHECKPOINT_PATH,
    inputScope: "complete_single_cell_EL_image",
    threshold: 0.55,
    benchmark,
  };
}

/**
 * Runs authenticated cell defectiveness screening.
 * Strictly checks MIME type, 8 MiB limit, image readability, and persists prediction.
 */
export async function runCellScreening(
  input: CellScreeningInput,
  userId?: string | null
): Promise<CellScreeningResponse> {
  // 1. MIME Validation
  const mime = (input.mimeType || "").toLowerCase().trim();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error(
      `Unsupported image format '${input.mimeType}'. Model 2 accepts complete solar cell EL images in PNG, JPEG, TIFF, BMP, or WEBP.`
    );
  }

  // 2. Base64 payload validation & decoding
  if (!input.base64Data || typeof input.base64Data !== "string") {
    throw new Error("Invalid image data: base64 payload is missing or empty.");
  }

  const buffer = Buffer.from(input.base64Data, "base64");
  if (buffer.length === 0) {
    throw new Error("The uploaded image file is empty (0 bytes).");
  }

  if (buffer.length > MAX_BYTES) {
    throw new Error(`Uploaded image exceeds the 8 MiB maximum size limit for cell screening.`);
  }

  // 3. Fail closed on missing checkpoint
  if (!existsSync(CHECKPOINT_PATH) || !existsSync(PREPROCESSING_PATH)) {
    throw new Error(
      "Model 2 ELPV checkpoint not found on server. Inference cannot execute without verified weights."
    );
  }

  const screeningId = randomUUID();
  const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_") || "cell.png";
  appLogger.info("MODEL 2", `Screening initiated: file="${safeFilename}", size=${buffer.length} bytes`);

  // 4. Store uploaded image into private storage
  const storageResult = await storagePut(
    `cell-screenings/${screeningId}/${safeFilename}`,
    buffer,
    mime
  );

  // 5. Execute inference through Python CLI bridge
  const workingDir = await mkdtemp(join(tmpdir(), "solarvision-m2-"));
  const inputTempPath = join(workingDir, safeFilename);
  const resultTempPath = join(workingDir, "result.json");

  try {
    await writeFile(inputTempPath, buffer);

    const cliArgs = [
      "-m",
      "backend.app.quality_screening.cli",
      "--input",
      inputTempPath,
      "--json",
      resultTempPath,
    ];

    await runPythonCli(cliArgs);

    if (!existsSync(resultTempPath)) {
      throw new Error("Model 2 execution did not produce result output.");
    }

    const rawResult: Model2ScreeningResult = JSON.parse(
      readFileSync(resultTempPath, "utf-8")
    );

    const defectiveScorePct = Math.round(rawResult.defective_probability * 10000) / 100;
    const thresholdPct = Math.round(rawResult.threshold * 10000) / 100;
    const summaryText = model2ScreeningSummary(rawResult);
    appLogger.info("MODEL 2", `Screening completed: id="${screeningId}", class=${rawResult.predicted_class}, score=${defectiveScorePct}%`);
    const createdAt = new Date().toISOString();

    // 6. Persistent history recording
    saveCellScreening({
      id: screeningId,
      userId: userId || null,
      modelVersionId: rawResult.model_id,
      sourceFilename: safeFilename,
      imageUrl: storageResult.url,
      predictedClass: rawResult.predicted_class,
      defectiveProbability: rawResult.defective_probability,
      threshold: rawResult.threshold,
      decision: rawResult.decision,
      reviewStatus: rawResult.review_status,
      requiresManualReview: rawResult.requires_manual_review,
      dataProvenance: "ELPV",
      warning: rawResult.warning,
      metadata: {
        inputScope: rawResult.input_scope,
        defectiveScorePct,
        thresholdPct,
      },
      createdAt,
    });

    return {
      screeningId,
      imageUrl: storageResult.url,
      sourceFilename: safeFilename,
      modelId: rawResult.model_id,
      predictedClass: rawResult.predicted_class,
      defectiveScorePct,
      rawDefectiveScore: rawResult.defective_probability,
      thresholdPct,
      rawThreshold: rawResult.threshold,
      requiresManualReview: true,
      decision: "screening_only",
      reviewStatus: "pending",
      inputScope: "complete_single_cell_EL_image",
      warning: rawResult.warning,
      summary: summaryText,
      dataProvenance: "ELPV",
      createdAt,
    };
  } finally {
    try {
      await rm(workingDir, { recursive: true, force: true });
    } catch {
      // Best-effort temp dir cleanup
    }
  }
}

/**
 * Returns recent cell defectiveness screening records from persistent storage.
 */
export async function getCellScreeningHistory(
  limit = 25,
  requester?: RequesterContext
): Promise<CellScreeningRecord[]> {
  return getCellScreenings(limit, requester);
}

/**
 * Returns a specific cell screening record by ID.
 */
export async function getCellScreeningRecord(
  id: string,
  requester?: RequesterContext
): Promise<CellScreeningRecord | null> {
  return getCellScreeningById(id, requester);
}
