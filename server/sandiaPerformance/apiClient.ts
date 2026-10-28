/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * FastAPI HTTP Client Adapter & Error Sanitization
 */

import axios, { type AxiosInstance, type AxiosError } from "axios";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_SANDIA_TIMEOUT_MS,
  MAX_SANDIA_BATCH_SIZE,
  type FeatureSchemaManifest,
  type SandiaBatchPredictionInput,
  type SandiaBatchPredictionResponse,
  type SandiaMetadataResponse,
  type SandiaModelStatusResponse,
  type SandiaPredictionInput,
  type SandiaPredictionResponse,
  type TargetDefinitionManifest,
} from "./types";

export class SandiaApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly detail: string;

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_SERVER_ERROR",
    detail?: string
  ) {
    super(message);
    this.name = "SandiaApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.detail = detail || message;
  }
}

/**
 * Sanitizes any internal filesystem paths (Windows or POSIX) or system artifacts
 * from error messages before exposure to callers or API consumers.
 */
export function sanitizeErrorMessage(rawMessage: string): string {
  if (!rawMessage || typeof rawMessage !== "string") {
    return "An unknown error occurred during inference.";
  }

  return (
    rawMessage
      // Strip Windows paths like D:\Apps\... or C:\Users\...
      .replace(
        /[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n\s"',;)]+\\)*[^\\/:*?"<>|\r\n\s"',;)]*/g,
        "[internal_path]"
      )
      // Strip POSIX paths like /home/user/... or /backend/app/...
      .replace(
        /\/(?:home|var|tmp|usr|app|backend|node_modules)\/[^\s"',;)]*/g,
        "[internal_path]"
      )
      // Normalize multiple spaces
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

export class SandiaApiClient {
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options?: {
    baseUrl?: string;
    timeoutMs?: number;
    customAxios?: AxiosInstance;
  }) {
    this.baseUrl =
      options?.baseUrl ||
      process.env.SANDIA_API_URL ||
      process.env.PYTHON_BACKEND_URL ||
      process.env.FASTAPI_URL ||
      "http://127.0.0.1:8000";
    this.timeoutMs = options?.timeoutMs || DEFAULT_SANDIA_TIMEOUT_MS;

    this.client =
      options?.customAxios ||
      axios.create({
        baseURL: this.baseUrl,
        timeout: this.timeoutMs,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
  }

  private handleError(err: any): never {
    if (
      axios.isAxiosError(err) ||
      (err && (err.isAxiosError || err.response))
    ) {
      const axiosErr = err as AxiosError<any>;

      // Timeout detection
      if (
        axiosErr.code === "ECONNABORTED" ||
        (typeof axiosErr.message === "string" &&
          axiosErr.message.toLowerCase().includes("timeout"))
      ) {
        throw new SandiaApiError(
          "Sandia solar electrical performance prediction request timed out.",
          504,
          "TIMEOUT"
        );
      }

      // Network refusal / connection error
      if (
        (axiosErr.code === "ECONNREFUSED" ||
          axiosErr.code === "ENOTFOUND" ||
          axiosErr.code === "ECONNRESET" ||
          !axiosErr.response) &&
        !axiosErr.response
      ) {
        throw new SandiaApiError(
          "Sandia solar electrical performance service is currently unreachable.",
          503,
          "SERVICE_UNAVAILABLE"
        );
      }

      if (axiosErr.response) {
        const status = axiosErr.response.status;
        const responseData = axiosErr.response.data;

        let detailMsg = "";
        if (typeof responseData === "string") {
          detailMsg = responseData;
        } else if (responseData?.detail) {
          if (Array.isArray(responseData.detail)) {
            detailMsg = responseData.detail
              .map((d: any) => d.msg || JSON.stringify(d))
              .join("; ");
          } else {
            detailMsg = String(responseData.detail);
          }
        } else if (responseData?.message) {
          detailMsg = String(responseData.message);
        } else {
          detailMsg = axiosErr.message || "An error occurred";
        }

        const cleanDetail = sanitizeErrorMessage(detailMsg);

        if (status === 422) {
          throw new SandiaApiError(
            cleanDetail || "Validation error in input telemetry.",
            422,
            "BAD_REQUEST",
            cleanDetail
          );
        }

        if (status === 503) {
          throw new SandiaApiError(
            cleanDetail ||
              "Sandia performance model is not ready or trained weights are absent.",
            503,
            "PRECONDITION_FAILED",
            cleanDetail
          );
        }

        if (status === 400) {
          throw new SandiaApiError(
            cleanDetail || "Invalid request payload.",
            400,
            "BAD_REQUEST",
            cleanDetail
          );
        }

        throw new SandiaApiError(
          cleanDetail || "Inference execution encountered an internal error.",
          status,
          "INTERNAL_SERVER_ERROR",
          cleanDetail
        );
      }
    }

    const cleanMsg = sanitizeErrorMessage(err?.message || String(err));
    throw new SandiaApiError(
      cleanMsg,
      err?.statusCode || 500,
      err?.code || "INTERNAL_SERVER_ERROR",
      cleanMsg
    );
  }

  /**
   * GET /sandia-performance/status
   */
  public async getStatus(): Promise<SandiaModelStatusResponse> {
    try {
      const resp = await this.client.get("/sandia-performance/status");
      return this.normalizeStatus(resp.data);
    } catch (err) {
      try {
        const respAlias = await this.client.get(
          "/api/sandia-performance/status"
        );
        return this.normalizeStatus(respAlias.data);
      } catch {
        // Try CLI bridge if available
        try {
          const cliResult = await this.executeCli(["--status-only"]);
          if (cliResult && typeof cliResult === "object") {
            return this.normalizeStatus(cliResult);
          }
        } catch {
          // Fall through
        }

        // Return truthful unready status when backend is in standalone mode
        return {
          modelName: "SolarVision-Sandia-Performance-Model3",
          modelVersion: "none",
          contractVersion: "1.0.0",
          isReady: false,
          status: "not_trained",
          artifactName: "pipeline.joblib",
          unavailabilityReason:
            "Sandia solar performance model artifact not loaded (training handoff pending).",
          featureSchemaLoaded: false,
          featureSchema: null,
          sampleInputLoaded: false,
          sampleInput: null,
          targetDefinitionLoaded: false,
          targetDefinition: null,
          isMock: false,
          trainerHandoffPending: true,
          expectedDim: null,
        };
      }
    }
  }

  /**
   * GET /sandia-performance/schema
   */
  public async getSchema(): Promise<FeatureSchemaManifest | any> {
    try {
      const resp = await this.client.get("/sandia-performance/schema");
      return resp.data;
    } catch (err) {
      try {
        const respAlias = await this.client.get(
          "/api/sandia-performance/schema"
        );
        return respAlias.data;
      } catch {
        try {
          const cliResult = await this.executeCli(["--schema-only"]);
          if (cliResult) return cliResult;
        } catch {}
        return {
          status: "pending_trainer",
          schemaVersion: "1.0.0",
          message:
            "Feature schema (feature_schema.json) has not yet been delivered by model trainer.",
        };
      }
    }
  }

  /**
   * GET /sandia-performance/target-definition
   */
  public async getTargetDefinition(): Promise<TargetDefinitionManifest | any> {
    try {
      const resp = await this.client.get(
        "/sandia-performance/target-definition"
      );
      return resp.data;
    } catch (err) {
      try {
        const respAlias = await this.client.get(
          "/api/sandia-performance/target-definition"
        );
        return respAlias.data;
      } catch {
        return {
          status: "pending_trainer",
          message:
            "Target definition (target_definition.json) has not yet been delivered by model trainer.",
        };
      }
    }
  }

  /**
   * GET /sandia-performance/sample-input
   */
  public async getSampleInput(): Promise<Record<string, any>> {
    try {
      const resp = await this.client.get("/sandia-performance/sample-input");
      return resp.data;
    } catch (err) {
      try {
        const respAlias = await this.client.get(
          "/api/sandia-performance/sample-input"
        );
        return respAlias.data;
      } catch {
        return {
          status: "pending_trainer",
          message:
            "Sample input (sample_input.json) has not yet been provided by model trainer.",
        };
      }
    }
  }

  /**
   * GET /sandia-performance/metadata
   */
  public async getMetadata(): Promise<SandiaMetadataResponse> {
    try {
      const resp = await this.client.get("/sandia-performance/metadata");
      return resp.data;
    } catch (err) {
      try {
        const respAlias = await this.client.get(
          "/api/sandia-performance/metadata"
        );
        return respAlias.data;
      } catch {
        try {
          const cliResult = await this.executeCli(["--metadata-only"]);
          if (cliResult) return cliResult;
        } catch {}
        return {
          modelId: "sandia-electrical-performance-v1",
          modelName:
            "SolarVision PV Electrical Performance Forecaster (Sandia)",
          framework: "scikit-learn (.joblib pipeline)",
          contractVersion: "1.0.0",
          domain: "solar_photovoltaic_performance",
          sourceDataset:
            "Sandia National Laboratories PV Performance Modeling Telemetry",
          attribution:
            "Sandia National Laboratories Photovoltaic Systems Evaluation Laboratory (PSEL)",
          isReady: false,
          isMock: false,
          artifactName: "pipeline.joblib",
          limitations: [
            "Requires calibrated sensor telemetry defined by trainer feature_schema.json.",
            "Inference requires trained scikit-learn .joblib pipeline.",
            "Zero fabrication guarantee: when model artifacts are absent, HTTP 503 is returned rather than fabricated numbers.",
          ],
        };
      }
    }
  }

  /**
   * POST /sandia-performance/predict
   */
  public async predict(
    input: SandiaPredictionInput
  ): Promise<SandiaPredictionResponse> {
    const payload = {
      module_id: input.moduleId ?? null,
      timestamp: input.timestamp ?? null,
      features: input.features,
      metadata: input.metadata ?? null,
    };

    try {
      const resp = await this.client.post(
        "/sandia-performance/predict",
        payload
      );
      return this.normalizePredictionResponse(resp.data);
    } catch (err) {
      try {
        const respAlias = await this.client.post(
          "/api/sandia-performance/predict",
          payload
        );
        return this.normalizePredictionResponse(respAlias.data);
      } catch {
        return this.handleError(err);
      }
    }
  }

  /**
   * POST /sandia-performance/predict-batch
   */
  public async predictBatch(
    input: SandiaBatchPredictionInput
  ): Promise<SandiaBatchPredictionResponse> {
    if (!input.items || input.items.length === 0) {
      throw new SandiaApiError(
        "Batch request must contain at least 1 item.",
        422,
        "BAD_REQUEST"
      );
    }

    if (input.items.length > MAX_SANDIA_BATCH_SIZE) {
      throw new SandiaApiError(
        `Batch size ${input.items.length} exceeds maximum limit of ${MAX_SANDIA_BATCH_SIZE} items.`,
        422,
        "BAD_REQUEST"
      );
    }

    const payload = {
      items: input.items.map(it => ({
        module_id: it.moduleId ?? null,
        timestamp: it.timestamp ?? null,
        features: it.features,
        metadata: it.metadata ?? null,
      })),
    };

    try {
      const resp = await this.client.post(
        "/sandia-performance/predict-batch",
        payload
      );
      return this.normalizeBatchResponse(resp.data);
    } catch (err) {
      try {
        const respAlias = await this.client.post(
          "/api/sandia-performance/predict-batch",
          payload
        );
        return this.normalizeBatchResponse(respAlias.data);
      } catch {
        return this.handleError(err);
      }
    }
  }

  /**
   * Python CLI Bridge fallback for offline environments or subprocess evaluation.
   */
  public async executeCli(
    args: string[],
    stdinPayload?: any,
    timeoutMs = 15000
  ): Promise<any> {
    const cwd = process.cwd();
    const localPython =
      process.platform === "win32"
        ? join(cwd, "backend/.venv/Scripts/python.exe")
        : join(cwd, "backend/.venv/bin/python3");
    const pythonExe =
      process.env.PYTHON_EXECUTABLE ||
      (existsSync(localPython)
        ? localPython
        : process.platform === "win32"
          ? "python"
          : "python3");

    return new Promise((resolvePromise, reject) => {
      const cliArgs = ["-m", "backend.app.sandia_performance.cli", ...args];
      const child = spawn(pythonExe, cliArgs, {
        cwd,
        env: { ...process.env, PYTHONPATH: cwd },
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        reject(
          new SandiaApiError("Sandia CLI process timed out.", 504, "TIMEOUT")
        );
      }, timeoutMs);

      child.stdout.on("data", chunk => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", chunk => {
        stderr += chunk.toString();
      });

      child.on("error", err => {
        clearTimeout(timer);
        reject(
          new SandiaApiError(
            sanitizeErrorMessage(err.message),
            500,
            "INTERNAL_SERVER_ERROR"
          )
        );
      });

      child.on("close", code => {
        clearTimeout(timer);
        if (timedOut) return;
        if (code === 0) {
          try {
            resolvePromise(stdout.trim() ? JSON.parse(stdout.trim()) : {});
          } catch (e: any) {
            resolvePromise(stdout.trim());
          }
        } else {
          const cleanErr = sanitizeErrorMessage(
            stderr.trim() || stdout.trim() || `CLI exited with code ${code}`
          );
          reject(new SandiaApiError(cleanErr, 500, "INTERNAL_SERVER_ERROR"));
        }
      });

      if (stdinPayload) {
        child.stdin.write(
          typeof stdinPayload === "string"
            ? stdinPayload
            : JSON.stringify(stdinPayload)
        );
        child.stdin.end();
      }
    });
  }

  private normalizeStatus(data: any): SandiaModelStatusResponse {
    return {
      modelName:
        data.model_name ||
        data.modelName ||
        "SolarVision-Sandia-Performance-Model3",
      modelVersion: data.model_version || data.modelVersion || "none",
      contractVersion: data.contract_version || data.contractVersion || "1.0.0",
      isReady: Boolean(data.is_ready ?? data.isReady),
      status: data.status,
      artifactName:
        data.artifact_name || data.artifactName || "pipeline.joblib",
      unavailabilityReason:
        data.unavailability_reason ?? data.unavailabilityReason ?? null,
      featureSchemaLoaded: Boolean(
        data.feature_schema_loaded ?? data.featureSchemaLoaded
      ),
      featureSchema: data.feature_schema || data.featureSchema || null,
      sampleInputLoaded: Boolean(
        data.sample_input_loaded ?? data.sampleInputLoaded
      ),
      sampleInput: data.sample_input || data.sampleInput || null,
      targetDefinitionLoaded: Boolean(
        data.target_definition_loaded ?? data.targetDefinitionLoaded
      ),
      targetDefinition: data.target_definition || data.targetDefinition || null,
      isMock: Boolean(data.is_mock ?? data.isMock),
      trainerHandoffPending: Boolean(
        data.trainer_handoff_pending ?? data.trainerHandoffPending
      ),
      expectedDim: data.expected_dim ?? data.expectedDim ?? null,
    };
  }

  private normalizePredictionResponse(data: any): SandiaPredictionResponse {
    let prediction: any = null;
    if (data.prediction) {
      prediction = {
        moduleId: data.prediction.module_id ?? data.prediction.moduleId ?? null,
        prediction: data.prediction.prediction,
        predictionLabel:
          data.prediction.prediction_label ??
          data.prediction.predictionLabel ??
          null,
        targetName:
          data.prediction.target_name ?? data.prediction.targetName ?? null,
        targetUnit:
          data.prediction.target_unit ?? data.prediction.targetUnit ?? null,
        confidence: data.prediction.confidence ?? null,
        uncertainty: data.prediction.uncertainty ?? null,
        featuresUsed:
          data.prediction.features_used ?? data.prediction.featuresUsed ?? [],
        isMock: Boolean(data.prediction.is_mock ?? data.prediction.isMock),
        warnings: data.prediction.warnings ?? [],
      };
    }

    return {
      contractVersion: data.contract_version || data.contractVersion || "1.0.0",
      status: data.status,
      modelName:
        data.model_name ||
        data.modelName ||
        "SolarVision-Sandia-Performance-Model3",
      modelVersion: data.model_version || data.modelVersion || "none",
      isMock: Boolean(data.is_mock ?? data.isMock),
      prediction,
      limitations: data.limitations || [],
      processingTimeMs: Number(
        data.processing_time_ms ?? data.processingTimeMs ?? 0
      ),
    };
  }

  private normalizeBatchResponse(data: any): SandiaBatchPredictionResponse {
    const rawPredictions = data.predictions || [];
    const predictions = rawPredictions.map((p: any) => ({
      moduleId: p.module_id ?? p.moduleId ?? null,
      prediction: p.prediction,
      predictionLabel: p.prediction_label ?? p.predictionLabel ?? null,
      targetName: p.target_name ?? p.targetName ?? null,
      targetUnit: p.target_unit ?? p.targetUnit ?? null,
      confidence: p.confidence ?? null,
      uncertainty: p.uncertainty ?? null,
      featuresUsed: p.features_used ?? p.featuresUsed ?? [],
      isMock: Boolean(p.is_mock ?? p.isMock),
      warnings: p.warnings ?? [],
    }));

    return {
      contractVersion: data.contract_version || data.contractVersion || "1.0.0",
      status: data.status,
      modelName:
        data.model_name ||
        data.modelName ||
        "SolarVision-Sandia-Performance-Model3",
      modelVersion: data.model_version || data.modelVersion || "none",
      isMock: Boolean(data.is_mock ?? data.isMock),
      predictions,
      totalItems: Number(
        data.total_items ?? data.totalItems ?? predictions.length
      ),
      limitations: data.limitations || [],
      processingTimeMs: Number(
        data.processing_time_ms ?? data.processingTimeMs ?? 0
      ),
    };
  }
}

export const sandiaApiClient = new SandiaApiClient();
