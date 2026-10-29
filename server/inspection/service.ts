import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import axios, { type AxiosError } from "axios";
import { getInspectionById, saveInspection, type RequesterContext } from "../db";
import { storagePut } from "../storage";
import { isSupabaseConfigured, persistToSupabase, uploadToSupabase } from "./supabase";

export type RunInspectionInput = {
  filename: string;
  mimeType: string;
  base64Data: string;
  confidence?: number;
  imageSize?: number;
  diagnostic?: boolean;
  userId?: string | null;
  operatorId?: string | null;
};

export type InspectionDetection = {
  defect_type: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  class_id?: number;
  near_image_boundary?: boolean;
};

export type InspectionResult = {
  inspectionId: string;
  sourceFilename: string;
  modelName: string;
  processingTimeMs: number;
  detections: InspectionDetection[];
  annotatedImageUrl: string | null;
  annotatedImageDataUrl?: string | null;
  persistence: string;
  inferenceConfiguration?: {
    confidence_threshold: number;
    iou_threshold?: number;
    image_size?: number;
    class_names?: string[];
  } | null;
};

interface FastApiInspectionResponse {
  inspection_id: string;
  status: string;
  source_filename: string;
  model_name: string;
  processing_time_ms: number;
  summary: {
    total_detections: number;
    average_confidence: number | null;
    highest_confidence: number | null;
  };
  detections: Array<{
    defect_type: string;
    confidence: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    near_image_boundary?: boolean;
    class_id?: number;
  }>;
  original_image_url?: string | null;
  annotated_image_url?: string | null;
  annotated_image_data_url?: string | null;
  persistence: string;
  inference_configuration?: {
    confidence_threshold: number;
    iou_threshold?: number;
    image_size?: number;
    class_names?: string[];
  };
}

const DEFAULT_INFERENCE_TIMEOUT_MS = 90_000;

export function getInferenceTimeoutMs(): number {
  const envVal = process.env.INFERENCE_TIMEOUT_MS || process.env.MODEL1_INFERENCE_TIMEOUT_MS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_INFERENCE_TIMEOUT_MS;
}

export function sanitizeFilename(filename: string): string {
  if (!filename) return "uploaded-image";
  return filename
    .replace(/[\r\n\0]/g, "")
    .replace(/[\\/]/g, "_")
    .slice(0, 128);
}

export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return "Unknown inference error";
  let msg = error instanceof Error ? error.message : String(error);
  return msg
    .replace(/[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n\s"',;)]+\\)*[^\\/:*?"<>|\r\n\s"',;)]*/g, "[internal_path]")
    .replace(/\/(?:home|var|tmp|usr|app|backend|node_modules)\/[^\s"',;)]*/g, "[internal_path]")
    .replace(/data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+/g, "[image_data_redacted]")
    .replace(/(?:key|secret|token|password|passcode)[=:][\s"']*[^\s,"']+/gi, "[credential_redacted]")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Fallback CLI process bridge: used exclusively for offline unit testing where
 * Python FastAPI daemon is not running on 127.0.0.1:8000.
 */
function runProcess(args: string[], cwd: string, timeoutMs = 60_000): Promise<void> {
  return new Promise<void>((resolvePromise, reject) => {
    const localPython =
      process.platform === "win32"
        ? join(cwd, "backend/.venv/Scripts/python.exe")
        : join(cwd, "backend/.venv/bin/python3");
    const pythonExecutable =
      process.env.PYTHON_EXECUTABLE ||
      (existsSync(localPython) ? localPython : process.platform === "win32" ? "python" : "python3");

    const child = spawn(pythonExecutable, args, {
      cwd,
      env: { ...process.env, PYTHONPATH: cwd },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      reject(new Error(`Inference process timed out after ${timeoutMs}ms`));
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
        resolvePromise();
      } else {
        const errorMsg = stderr.trim() || stdout.trim() || `Inference process exited with code ${code}`;
        reject(new Error(errorMsg));
      }
    });
  });
}

/**
 * Executes Model 1 YOLO defect detection via internal FastAPI HTTP call.
 * Forwards uploaded image as multipart form data without spawning subprocesses.
 */
async function executeFastApiInference(
  original: Buffer,
  filename: string,
  mimeType: string,
  confidence: number,
  imageSize?: number,
  diagnostic?: boolean,
  timeoutMs: number = DEFAULT_INFERENCE_TIMEOUT_MS
): Promise<FastApiInspectionResponse> {
  const baseUrl =
    process.env.FASTAPI_URL ||
    process.env.PYTHON_BACKEND_URL ||
    process.env.SANDIA_API_URL ||
    "http://127.0.0.1:8000";

  const cleanFilename = sanitizeFilename(basename(filename));
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(original)], { type: mimeType });
  formData.append("file", blob, cleanFilename);

  const params: Record<string, string | number | boolean> = {
    confidence,
  };
  if (typeof imageSize === "number" && imageSize >= 32) {
    params.image_size = imageSize;
  }
  if (diagnostic) {
    params.diagnostic = true;
  }

  const response = await axios.post<FastApiInspectionResponse>(
    `${baseUrl}/api/inspections`,
    formData,
    {
      params,
      timeout: timeoutMs,
      headers: {
        Accept: "application/json",
      },
      maxContentLength: 100 * 1024 * 1024,
      maxBodyLength: 100 * 1024 * 1024,
    }
  );

  if (
    response.status !== 200 ||
    !response.data ||
    typeof response.data !== "object" ||
    !("status" in response.data) ||
    !("detections" in response.data)
  ) {
    throw new Error(
      `FastAPI inference returned an empty or incomplete response (status ${response.status}). The inference service may have been interrupted or terminated by resource limits.`
    );
  }

  return response.data;
}

export async function runInspection(input: RunInspectionInput): Promise<InspectionResult> {
  const startTime = performance.now();

  // 1. Media type validation
  if (!input.mimeType || !input.mimeType.startsWith("image/")) {
    throw new Error("Unsupported media type: file must be an image (e.g. image/jpeg, image/png).");
  }

  // 2. Base64 payload validation
  if (!input.base64Data || typeof input.base64Data !== "string") {
    throw new Error("Invalid image data: base64 payload is missing or empty.");
  }

  const original = Buffer.from(input.base64Data, "base64");
  if (original.length === 0) {
    throw new Error("The uploaded image file is empty (0 bytes).");
  }

  const maxBytes = 50 * 1024 * 1024;
  if (original.length > maxBytes) {
    throw new Error("Image exceeds the maximum upload size of 50 MB.");
  }

  // 3. Confidence threshold handling (Default: 0.25)
  let targetConfidence = 0.25;
  if (typeof input.confidence === "number") {
    if (isNaN(input.confidence) || input.confidence < 0.0 || input.confidence > 1.0) {
      throw new Error("Confidence parameter must be a numeric value between 0.0 and 1.0.");
    }
    targetConfidence = input.confidence;
  } else if (process.env.CONFIDENCE_THRESHOLD) {
    const envVal = parseFloat(process.env.CONFIDENCE_THRESHOLD);
    if (!isNaN(envVal) && envVal >= 0.0 && envVal <= 1.0) {
      targetConfidence = envVal;
    }
  }

  const inspectionId = randomUUID();
  const safeName = sanitizeFilename(input.filename);
  const timeoutMs = getInferenceTimeoutMs();

  console.log(
    `[Inspection] Initiating Model 1 inspection: file="${safeName}", size=${original.length} bytes, conf=${targetConfidence}, timeout=${timeoutMs}ms`
  );

  let rawDetections: InspectionDetection[] = [];
  let processingTimeMs = 0;
  let annotatedDataUrl: string | null = null;
  let annotatedBuffer: Buffer | null = null;
  let inferenceConfig: InspectionResult["inferenceConfiguration"] = {
    confidence_threshold: targetConfidence,
  };

  const recordFailedAudit = async (reason: string) => {
    try {
      await saveInspection(
        {
          inspectionId,
          userId: input.userId ?? null,
          operatorId: input.operatorId ?? input.userId ?? null,
          sourceFilename: input.filename,
          modelName: "YOLO26n",
          status: "failed" as const,
          processingTimeMs: 0,
          inputImageUrl: null,
          annotatedImageUrl: null,
          detectionsCount: 0,
          persistenceStatus: `failed_inference:${reason.slice(0, 100)}`,
        },
        []
      );
    } catch {
      // Suppress secondary audit persistence failure
    }
  };

  // 4. Primary Execution Path: FastAPI Internal HTTP Bridge
  let httpSucceeded = false;
  try {
    const fastApiResult = await executeFastApiInference(
      original,
      input.filename,
      input.mimeType,
      targetConfidence,
      input.imageSize,
      input.diagnostic,
      timeoutMs
    );

    processingTimeMs = fastApiResult.processing_time_ms;
    rawDetections = (fastApiResult.detections || []).map(d => ({
      defect_type: d.defect_type,
      confidence: d.confidence,
      x1: d.x1,
      y1: d.y1,
      x2: d.x2,
      y2: d.y2,
      class_id: d.class_id,
      near_image_boundary: d.near_image_boundary,
    }));
    annotatedDataUrl = fastApiResult.annotated_image_data_url || null;

    if (annotatedDataUrl && annotatedDataUrl.includes(",")) {
      annotatedBuffer = Buffer.from(annotatedDataUrl.split(",")[1], "base64");
    }

    if (fastApiResult.inference_configuration) {
      inferenceConfig = {
        confidence_threshold: fastApiResult.inference_configuration.confidence_threshold,
        iou_threshold: fastApiResult.inference_configuration.iou_threshold,
        image_size: fastApiResult.inference_configuration.image_size,
        class_names: fastApiResult.inference_configuration.class_names,
      };
    }

    httpSucceeded = true;
  } catch (httpErr: any) {
    const isTimeout =
      httpErr?.code === "ECONNABORTED" ||
      httpErr?.code === "ETIMEDOUT" ||
      (typeof httpErr?.message === "string" && httpErr.message.toLowerCase().includes("timeout"));

    const isInterrupted =
      httpErr?.code === "ECONNRESET" ||
      httpErr?.code === "EPIPE" ||
      httpErr?.code === "ERR_BAD_RESPONSE" ||
      httpErr?.code === "ECONNABORTED_RESET" ||
      (typeof httpErr?.message === "string" &&
        (httpErr.message.toLowerCase().includes("unexpected end of json") ||
         httpErr.message.toLowerCase().includes("socket hang up") ||
         httpErr.message.toLowerCase().includes("premature close") ||
         httpErr.message.toLowerCase().includes("empty or incomplete response") ||
         httpErr.message.toLowerCase().includes("connection reset") ||
         httpErr.message.toLowerCase().includes("interrupted")));

    const isConnRefused = httpErr?.code === "ECONNREFUSED" || httpErr?.code === "ENOTFOUND";

    // Only allow CLI fallback in non-production local/test environments if FastAPI is entirely offline
    const isProd = process.env.NODE_ENV === "production";
    const allowCliFallback = !isProd && isConnRefused;

    if (isTimeout) {
      const timeoutMsg = `Inference process timed out after ${timeoutMs}ms`;
      console.error(
        `[Inspection] Model 1 inference timed out after ${timeoutMs}ms for file="${safeName}"`
      );
      await recordFailedAudit("timeout");
      throw new Error(timeoutMsg);
    }

    if (isInterrupted) {
      const interruptedMsg =
        "Inference connection was interrupted or closed unexpectedly before completing. This usually occurs when the backend container restarts or experiences resource limits. Please retry the inspection.";
      console.error(
        `[Inspection] Model 1 inference interrupted for file="${safeName}": ${httpErr?.message || httpErr?.code}`
      );
      await recordFailedAudit("connection_interrupted");
      throw new Error(interruptedMsg);
    }

    if (!allowCliFallback) {
      const cleanErr = sanitizeErrorMessage(httpErr?.response?.data?.detail || httpErr?.message || httpErr);
      console.error(
        `[Inspection] Model 1 FastAPI inference error for file="${safeName}": ${cleanErr}`
      );
      await recordFailedAudit(cleanErr);
      throw new Error(`Inference execution failed: ${cleanErr}`);
    }

    // 5. Offline Fallback CLI Execution (Non-production environments only)
    console.warn(
      `[Inspection] FastAPI offline (${httpErr.code}). Falling back to CLI bridge for local/test execution.`
    );

    const projectRoot = resolve(process.cwd());
    const modelPath = process.env.MODEL_PATH || join(projectRoot, "backend/models/best.pt");
    if (!existsSync(modelPath)) {
      await recordFailedAudit("checkpoint_missing");
      throw new Error("YOLO model checkpoint not found. Please place best.pt in the configured model path.");
    }

    const workingDir = await mkdtemp(join(tmpdir(), "solarvision-"));
    const suffix = input.filename.includes(".")
      ? input.filename.slice(input.filename.lastIndexOf("."))
      : ".jpg";
    const inputPath = join(workingDir, `input${suffix}`);
    const annotatedPath = join(workingDir, "annotated.jpg");
    const resultPath = join(workingDir, "result.json");

    await writeFile(inputPath, original);

    try {
      const cliArgs = [
        "-m",
        "backend.app.infer_cli",
        "--input",
        inputPath,
        "--annotated",
        annotatedPath,
        "--json",
        resultPath,
        "--confidence",
        targetConfidence.toString(),
      ];
      if (typeof input.imageSize === "number" && input.imageSize >= 32) {
        cliArgs.push("--image-size", input.imageSize.toString());
      }
      if (input.diagnostic) {
        cliArgs.push("--diagnostic");
      }

      await runProcess(cliArgs, projectRoot, timeoutMs);

      const rawResult = await readFile(resultPath, "utf-8");
      const cliResult = JSON.parse(rawResult);
      processingTimeMs = cliResult.processing_time_ms;
      rawDetections = cliResult.detections || [];
      annotatedDataUrl = cliResult.annotated_image_data_url || null;
      annotatedBuffer = await readFile(annotatedPath);
      if (cliResult.inference_configuration) {
        inferenceConfig = cliResult.inference_configuration;
      }
    } catch (cliErr) {
      await recordFailedAudit(sanitizeErrorMessage(cliErr));
      throw cliErr;
    } finally {
      await rm(workingDir, { recursive: true, force: true });
    }
  }

  // 6. Storage Persistence Orchestration
  const suffix = input.filename.includes(".")
    ? input.filename.slice(input.filename.lastIndexOf("."))
    : ".jpg";
  let inputImageUrl: string | null = null;
  let annotatedImageUrl: string | null = null;
  const persistenceNotes: string[] = [];

  try {
    if (isSupabaseConfigured()) {
      inputImageUrl = await uploadToSupabase(
        `inspections/${inspectionId}/input${suffix}`,
        original,
        input.mimeType
      );
      if (annotatedBuffer) {
        annotatedImageUrl = await uploadToSupabase(
          `inspections/${inspectionId}/annotated.jpg`,
          annotatedBuffer,
          "image/jpeg"
        );
      }
      persistenceNotes.push("supabase_storage");
    } else {
      const inputStored = await storagePut(
        `solarvision/${inspectionId}/input${suffix}`,
        original,
        input.mimeType
      );
      inputImageUrl = inputStored.url;

      if (annotatedBuffer) {
        const annotatedStored = await storagePut(
          `solarvision/${inspectionId}/annotated.jpg`,
          annotatedBuffer,
          "image/jpeg"
        );
        annotatedImageUrl = annotatedStored.url;
      }
      persistenceNotes.push("managed_storage");
    }
  } catch (storageError) {
    persistenceNotes.push(
      `storage_unavailable:${storageError instanceof Error ? storageError.message : "unknown"}`
    );
  }

  // 7. Database Persistence Orchestration (Primary Database / SQLite)
  const effectiveUserId = input.userId ?? null;
  const effectiveOperatorId = input.operatorId ?? effectiveUserId ?? null;
  const databasePayload = {
    inspectionId,
    userId: effectiveUserId,
    operatorId: effectiveOperatorId,
    sourceFilename: input.filename,
    modelName: "YOLO26n",
    status: "completed" as const,
    processingTimeMs,
    inputImageUrl,
    annotatedImageUrl,
    detectionsCount: rawDetections.length,
    persistenceStatus: (persistenceNotes.join(",") || "storage_pending").slice(0, 128),
  };

  try {
    const stored = await saveInspection(
      databasePayload,
      rawDetections.map(item => ({
        inspectionId,
        defectType: item.defect_type,
        confidence: item.confidence,
        x1: item.x1,
        y1: item.y1,
        x2: item.x2,
        y2: item.y2,
      }))
    );
    if (stored) {
      persistenceNotes.push("database");
    } else {
      persistenceNotes.push("database_not_configured");
    }
  } catch (databaseError) {
    persistenceNotes.push(
      `database_error:${databaseError instanceof Error ? databaseError.message : "unknown"}`
    );
  }

  // 8. Supabase Postgres Persistence (if configured)
  if (isSupabaseConfigured()) {
    try {
      await persistToSupabase(
        {
          inspection_id: inspectionId,
          user_id: effectiveUserId,
          operator_id: effectiveOperatorId,
          source_filename: input.filename,
          model_name: "YOLO26n",
          status: "completed",
          processing_time_ms: processingTimeMs,
          input_image_url: inputImageUrl,
          annotated_image_url: annotatedImageUrl,
          detections_count: rawDetections.length,
          persistence_status: persistenceNotes.join(",").slice(0, 128),
        },
        rawDetections.map(item => ({
          inspection_id: inspectionId,
          defect_type: item.defect_type,
          confidence: item.confidence,
          x1: item.x1,
          y1: item.y1,
          x2: item.x2,
          y2: item.y2,
        }))
      );
      persistenceNotes.push("supabase_postgres");
    } catch (supabaseError) {
      persistenceNotes.push(
        `supabase_postgres_error:${supabaseError instanceof Error ? supabaseError.message : "unknown"}`
      );
    }
  }

  const elapsedTotal = Math.round(performance.now() - startTime);
  console.log(
    `[Inspection] Model 1 completed: id="${inspectionId}", file="${safeName}", detections=${rawDetections.length}, inferenceMs=${processingTimeMs}, elapsed=${elapsedTotal}ms (bridge=${httpSucceeded ? "fastapi_http" : "cli_fallback"})`
  );

  return {
    inspectionId,
    sourceFilename: input.filename,
    modelName: "YOLO26n",
    processingTimeMs,
    detections: rawDetections,
    annotatedImageUrl,
    annotatedImageDataUrl: annotatedDataUrl,
    persistence: persistenceNotes.join(",") || "not_persisted",
    inferenceConfiguration: inferenceConfig,
  };
}

export async function getInspection(inspectionId: string, requester?: RequesterContext) {
  return getInspectionById(inspectionId, requester);
}
