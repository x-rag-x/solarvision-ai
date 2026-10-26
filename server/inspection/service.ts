import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
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

export async function runInspection(input: RunInspectionInput): Promise<InspectionResult> {
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

  // 4. Model checkpoint availability verification
  const projectRoot = resolve(process.cwd());
  const modelPath = process.env.MODEL_PATH || join(projectRoot, "backend/models/best.pt");
  if (!existsSync(modelPath)) {
    throw new Error("YOLO model checkpoint not found. Please place best.pt in the configured model path.");
  }

  const inspectionId = randomUUID();
  const workingDir = await mkdtemp(join(tmpdir(), "solarvision-"));
  const suffix = input.filename.includes(".")
    ? input.filename.slice(input.filename.lastIndexOf("."))
    : ".jpg";
  const inputPath = join(workingDir, `input${suffix}`);
  const annotatedPath = join(workingDir, "annotated.jpg");
  const resultPath = join(workingDir, "result.json");

  await writeFile(inputPath, original);

  try {
    // 5. Execute Python CLI inference bridge
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

    try {
      await runProcess(cliArgs, projectRoot);
    } catch (inferenceErr) {
      // Record failed inspection attempt for traceability before rethrowing
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
            persistenceStatus: "failed_inference",
          },
          []
        );
      } catch {
        // Suppress secondary audit persistence failure
      }
      throw inferenceErr;
    }

    // 6. Parse detection output
    const rawResult = await readFile(resultPath, "utf-8");
    const result = JSON.parse(rawResult) as {
      processing_time_ms: number;
      detections: InspectionDetection[];
      annotated_image_data_url: string;
      inference_configuration?: {
        confidence_threshold: number;
        iou_threshold?: number;
        image_size?: number;
        class_names?: string[];
      };
    };

    const annotatedBuffer = await readFile(annotatedPath);
    let inputImageUrl: string | null = null;
    let annotatedImageUrl: string | null = null;
    const persistenceNotes: string[] = [];

    // 7. Storage persistence orchestration
    try {
      if (isSupabaseConfigured()) {
        inputImageUrl = await uploadToSupabase(
          `inspections/${inspectionId}/input${suffix}`,
          original,
          input.mimeType
        );
        annotatedImageUrl = await uploadToSupabase(
          `inspections/${inspectionId}/annotated.jpg`,
          annotatedBuffer,
          "image/jpeg"
        );
        persistenceNotes.push("supabase_storage");
      } else {
        const inputStored = await storagePut(
          `solarvision/${inspectionId}/input${suffix}`,
          original,
          input.mimeType
        );
        const annotatedStored = await storagePut(
          `solarvision/${inspectionId}/annotated.jpg`,
          annotatedBuffer,
          "image/jpeg"
        );
        inputImageUrl = inputStored.url;
        annotatedImageUrl = annotatedStored.url;
        persistenceNotes.push("managed_storage");
      }
    } catch (storageError) {
      persistenceNotes.push(
        `storage_unavailable:${storageError instanceof Error ? storageError.message : "unknown"}`
      );
    }

    // 8. Database persistence orchestration (primary database / SQLite)
    const effectiveUserId = input.userId ?? null;
    const effectiveOperatorId = input.operatorId ?? effectiveUserId ?? null;
    const databasePayload = {
      inspectionId,
      userId: effectiveUserId,
      operatorId: effectiveOperatorId,
      sourceFilename: input.filename,
      modelName: "YOLO26n",
      status: "completed" as const,
      processingTimeMs: result.processing_time_ms,
      inputImageUrl,
      annotatedImageUrl,
      detectionsCount: result.detections.length,
      persistenceStatus: (persistenceNotes.join(",") || "storage_pending").slice(0, 128),
    };

    try {
      const stored = await saveInspection(
        databasePayload,
        result.detections.map(item => ({
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

    // 9. Supabase Postgres persistence (if configured)
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
            processing_time_ms: result.processing_time_ms,
            input_image_url: inputImageUrl,
            annotated_image_url: annotatedImageUrl,
            detections_count: result.detections.length,
            persistence_status: persistenceNotes.join(",").slice(0, 128),
          },
          result.detections.map(item => ({
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

    return {
      inspectionId,
      sourceFilename: input.filename,
      modelName: "YOLO26n",
      processingTimeMs: result.processing_time_ms,
      detections: result.detections,
      annotatedImageUrl,
      annotatedImageDataUrl: result.annotated_image_data_url,
      persistence: persistenceNotes.join(",") || "not_persisted",
      inferenceConfiguration: result.inference_configuration ?? {
        confidence_threshold: targetConfidence,
      },
    };
  } finally {
    await rm(workingDir, { recursive: true, force: true });
  }
}

export async function getInspection(inspectionId: string, requester?: RequesterContext) {
  return getInspectionById(inspectionId, requester);
}
