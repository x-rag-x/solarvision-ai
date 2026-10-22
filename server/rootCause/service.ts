/**
 * SolarVision AI — Model 2: Manufacturing Root Cause Analysis
 * Node.js Orchestration Service & Python Subprocess Bridge
 */

import { spawn } from "child_process";
import { existsSync, promises as fs } from "fs";
import { join } from "path";
import { hasSufficientManufacturingData } from "./featureContract";
import type {
  Model2StatusInfo,
  RootCauseAnalysisInput,
  RootCauseResponse,
} from "./types";

const cwd = process.cwd();

function resolvePythonExecutable(): string {
  const localPython =
    process.platform === "win32"
      ? join(cwd, "backend/.venv/Scripts/python.exe")
      : join(cwd, "backend/.venv/bin/python3");
  return process.env.PYTHON_EXECUTABLE || (existsSync(localPython) ? localPython : process.platform === "win32" ? "python" : "python3");
}

function runPythonCommand(args: string[], timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
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
      reject(new Error(`Model 2 CLI process timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", chunk => {
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
        resolve(stdout);
      } else {
        const errorMsg = stderr.trim() || stdout.trim() || `Process exited with code ${code}`;
        reject(new Error(errorMsg));
      }
    });
  });
}

/**
 * Main service entrypoint for executing Model 2 Root Cause Analysis.
 */
export async function analyzeRootCause(input: RootCauseAnalysisInput): Promise<RootCauseResponse> {
  const startTime = Date.now();

  // 1. Input sanity check
  if (!input.inspectionId || typeof input.inspectionId !== "string") {
    return {
      inspectionId: input.inspectionId || "unknown",
      batchId: input.batchId ?? null,
      machineId: input.machineId ?? null,
      status: "error",
      probableCauses: [],
      modelVersion: "none",
      limitations: ["Invalid inspectionId provided."],
      processingTimeMs: Date.now() - startTime,
    };
  }

  // 2. Early rejection when no process data exists (zero unnecessary process spawns)
  if (!hasSufficientManufacturingData(input)) {
    return {
      inspectionId: input.inspectionId,
      batchId: input.batchId ?? null,
      machineId: input.machineId ?? null,
      status: "missing_process_data",
      probableCauses: [],
      modelVersion: "none",
      limitations: [
        "Missing manufacturing process telemetry. Root cause attribution requires linked sensor measurements, machine telemetry, or batch metadata to correlate with defect patterns.",
      ],
      processingTimeMs: Date.now() - startTime,
    };
  }

  // 3. Delegate to Python root cause engine via CLI bridge
  const tmpDir = join(cwd, "uploads", ".tmp_root_cause");
  await fs.mkdir(tmpDir, { recursive: true });

  const runId = `rc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const inputPath = join(tmpDir, `${runId}_in.json`);
  const outputPath = join(tmpDir, `${runId}_out.json`);

  try {
    await fs.writeFile(inputPath, JSON.stringify(input), "utf-8");

    await runPythonCommand([
      "-m",
      "backend.app.root_cause.cli",
      "--input",
      inputPath,
      "--output",
      outputPath,
    ]);

    const rawOutput = await fs.readFile(outputPath, "utf-8");
    const parsed: RootCauseResponse = JSON.parse(rawOutput);
    return {
      ...parsed,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      inspectionId: input.inspectionId,
      batchId: input.batchId ?? null,
      machineId: input.machineId ?? null,
      status: "error",
      probableCauses: [],
      modelVersion: "none",
      limitations: [`Inference execution failure: ${errorMsg}`],
      processingTimeMs: Date.now() - startTime,
    };
  } finally {
    // Cleanup temporary files
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}

/**
 * Checks Model 2 readiness, version, and artifact configuration.
 */
export async function getModel2Status(): Promise<Model2StatusInfo> {
  try {
    const stdout = await runPythonCommand([
      "-m",
      "backend.app.root_cause.cli",
      "--status-only",
    ]);
    const parsed = JSON.parse(stdout);
    return {
      modelName: parsed.model_name || "SolarVision-RC-Model2",
      isReady: Boolean(parsed.is_ready),
      modelVersion: parsed.model_version || "none",
      artifactPath: parsed.artifact_path || "",
      unavailabilityReason: parsed.unavailability_reason,
    };
  } catch (err) {
    return {
      modelName: "SolarVision-RC-Model2",
      isReady: false,
      modelVersion: "none",
      artifactPath: "",
      unavailabilityReason: `Failed to probe Model 2 status: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
