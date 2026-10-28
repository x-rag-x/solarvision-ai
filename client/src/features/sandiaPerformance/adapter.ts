/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * Unified Frontend API Adapter & Network Client
 * 
 * Cleanly decouples frontend dashboard from backend transport:
 * 1. RestSandiaApiAdapter: Talks directly to FastAPI /api/sandia-performance endpoints.
 * 2. TrpcSandiaApiAdapter: Forward-compatible adapter for Agent 2's tRPC procedures.
 * 3. Fallback/Session cache: Ensures seamless degradation when endpoints are staging.
 * 
 * ZERO FABRICATION GUARANTEE:
 * Returns truthful HTTP 503 / unready states when model artifacts are absent.
 * Never invents synthetic prediction metrics or fake confidence scores.
 */

import { getAuthHeaders, getBaseUrl } from "@/lib/trpc";
import type {
  FeatureSchemaManifest,
  SandiaBatchPredictionInput,
  SandiaBatchPredictionResponse,
  SandiaMetadataResponse,
  SandiaModelStatusResponse,
  SandiaPredictionHistoryItem,
  SandiaPredictionInput,
  SandiaPredictionResponse,
  TargetDefinitionManifest,
  TrainerEvaluationMetrics,
} from "./types";

export class SandiaApiError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "MODEL_NOT_TRAINED"
      | "MODEL_UNAVAILABLE"
      | "SCHEMA_PENDING"
      | "VALIDATION_ERROR"
      | "NETWORK_ERROR"
      | "UNAUTHORIZED"
      | "UNKNOWN",
    public readonly statusCode?: number,
    public readonly limitations?: string[]
  ) {
    super(message);
    this.name = "SandiaApiError";
  }
}

export interface SandiaApiAdapter {
  getStatus(): Promise<SandiaModelStatusResponse>;
  getSchema(): Promise<{
    status: string;
    schemaVersion?: string;
    datasetName?: string | null;
    features?: any[];
    metadata?: Record<string, any>;
    message?: string;
  }>;
  getTargetDefinition(): Promise<{
    status: string;
    targetDefinition?: TargetDefinitionManifest;
    message?: string;
  }>;
  getSampleInput(): Promise<{
    status: string;
    sampleInput?: Record<string, any>;
    message?: string;
  }>;
  getMetadata(): Promise<SandiaMetadataResponse>;
  predict(input: SandiaPredictionInput): Promise<SandiaPredictionResponse>;
  predictBatch(input: SandiaBatchPredictionInput): Promise<SandiaBatchPredictionResponse>;
  getHistory(options?: { moduleId?: string; limit?: number }): Promise<SandiaPredictionHistoryItem[]>;
  getEvaluationMetrics(): Promise<TrainerEvaluationMetrics | null>;
}

const SESSION_HISTORY_STORAGE_KEY = "solarvision_sandia_prediction_history_v1";

function readSessionHistory(): SandiaPredictionHistoryItem[] {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return [];
    const raw = window.sessionStorage.getItem(SESSION_HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function appendSessionHistory(item: SandiaPredictionHistoryItem): void {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    const history = readSessionHistory();
    const updated = [item, ...history].slice(0, 50);
    window.sessionStorage.setItem(SESSION_HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * REST Implementation connecting to FastAPI endpoints under /sandia-performance or /api/sandia-performance
 */
export class RestSandiaApiAdapter implements SandiaApiAdapter {
  private baseUrl: string;

  constructor(customBaseUrl?: string) {
    this.baseUrl = customBaseUrl ?? getBaseUrl();
  }

  private async fetchEndpoint(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorDetail = data?.detail || data?.message || response.statusText;
        if (response.status === 503) {
          throw new SandiaApiError(
            errorDetail || "Sandia performance model artifact is not loaded or ready.",
            "MODEL_UNAVAILABLE",
            503,
            data?.limitations
          );
        }
        if (response.status === 422) {
          throw new SandiaApiError(
            errorDetail || "Input feature validation failed.",
            "VALIDATION_ERROR",
            422,
            data?.limitations
          );
        }
        if (response.status === 401) {
          throw new SandiaApiError(
            "Authentication required to perform Sandia inference operations.",
            "UNAUTHORIZED",
            401
          );
        }
        throw new SandiaApiError(
          errorDetail || `Request failed with status ${response.status}`,
          "UNKNOWN",
          response.status
        );
      }

      return data;
    } catch (err: any) {
      if (err instanceof SandiaApiError) throw err;
      throw new SandiaApiError(
        err?.message || "Failed to communicate with Sandia performance service.",
        "NETWORK_ERROR"
      );
    }
  }

  async getStatus(): Promise<SandiaModelStatusResponse> {
    try {
      return await this.fetchEndpoint("/api/sandia-performance/status");
    } catch (err) {
      // Fallback without /api prefix
      return await this.fetchEndpoint("/sandia-performance/status");
    }
  }

  async getSchema(): Promise<any> {
    try {
      return await this.fetchEndpoint("/api/sandia-performance/schema");
    } catch {
      return await this.fetchEndpoint("/sandia-performance/schema");
    }
  }

  async getTargetDefinition(): Promise<any> {
    try {
      return await this.fetchEndpoint("/api/sandia-performance/target-definition");
    } catch {
      return await this.fetchEndpoint("/sandia-performance/target-definition");
    }
  }

  async getSampleInput(): Promise<any> {
    try {
      return await this.fetchEndpoint("/api/sandia-performance/sample-input");
    } catch {
      return await this.fetchEndpoint("/sandia-performance/sample-input");
    }
  }

  async getMetadata(): Promise<SandiaMetadataResponse> {
    try {
      return await this.fetchEndpoint("/api/sandia-performance/metadata");
    } catch {
      return await this.fetchEndpoint("/sandia-performance/metadata");
    }
  }

  async predict(input: SandiaPredictionInput): Promise<SandiaPredictionResponse> {
    let result: SandiaPredictionResponse;
    try {
      result = await this.fetchEndpoint("/api/sandia-performance/predict", {
        method: "POST",
        body: JSON.stringify(input),
      });
    } catch (err: any) {
      if (err.statusCode === 503 || err.statusCode === 422) throw err;
      result = await this.fetchEndpoint("/sandia-performance/predict", {
        method: "POST",
        body: JSON.stringify(input),
      });
    }

    if (result && result.prediction) {
      const historyItem: SandiaPredictionHistoryItem = {
        id: `sandia-pred-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        moduleId: input.module_id || result.prediction.module_id || "PV-UNSPECIFIED",
        timestamp: new Date().toISOString(),
        prediction: result.prediction.prediction as any,
        predictionLabel: result.prediction.prediction_label || undefined,
        targetName: result.prediction.target_name || "Pmp",
        targetUnit: result.prediction.target_unit || "W",
        modelVersion: result.model_version || "none",
        processingTimeMs: result.processing_time_ms || 0,
        isMock: result.is_mock || false,
        warnings: result.prediction.warnings || [],
      };
      appendSessionHistory(historyItem);
    }

    return result;
  }

  async predictBatch(input: SandiaBatchPredictionInput): Promise<SandiaBatchPredictionResponse> {
    try {
      return await this.fetchEndpoint("/api/sandia-performance/predict-batch", {
        method: "POST",
        body: JSON.stringify(input),
      });
    } catch (err: any) {
      if (err.statusCode === 503 || err.statusCode === 422) throw err;
      return await this.fetchEndpoint("/sandia-performance/predict-batch", {
        method: "POST",
        body: JSON.stringify(input),
      });
    }
  }

  async getHistory(options?: { moduleId?: string; limit?: number }): Promise<SandiaPredictionHistoryItem[]> {
    let history = readSessionHistory();
    if (options?.moduleId) {
      const search = options.moduleId.toLowerCase();
      history = history.filter((h) => h.moduleId.toLowerCase().includes(search));
    }
    if (options?.limit) {
      history = history.slice(0, options.limit);
    }
    return history;
  }

  async getEvaluationMetrics(): Promise<TrainerEvaluationMetrics | null> {
    try {
      const meta = await this.getMetadata();
      // If trainer provided metrics in metadata
      if ((meta as any).evaluationMetrics) {
        return (meta as any).evaluationMetrics;
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * tRPC Adapter ready for connection to Agent 2's future Node/tRPC procedures.
 * If Agent 2's procedures are not yet registered, gracefully proxies to REST.
 */
export class TrpcSandiaApiAdapter implements SandiaApiAdapter {
  private restFallback: RestSandiaApiAdapter;

  constructor() {
    this.restFallback = new RestSandiaApiAdapter();
  }

  async getStatus(): Promise<SandiaModelStatusResponse> {
    return this.restFallback.getStatus();
  }

  async getSchema(): Promise<any> {
    return this.restFallback.getSchema();
  }

  async getTargetDefinition(): Promise<any> {
    return this.restFallback.getTargetDefinition();
  }

  async getSampleInput(): Promise<any> {
    return this.restFallback.getSampleInput();
  }

  async getMetadata(): Promise<SandiaMetadataResponse> {
    return this.restFallback.getMetadata();
  }

  async predict(input: SandiaPredictionInput): Promise<SandiaPredictionResponse> {
    return this.restFallback.predict(input);
  }

  async predictBatch(input: SandiaBatchPredictionInput): Promise<SandiaBatchPredictionResponse> {
    return this.restFallback.predictBatch(input);
  }

  async getHistory(options?: { moduleId?: string; limit?: number }): Promise<SandiaPredictionHistoryItem[]> {
    return this.restFallback.getHistory(options);
  }

  async getEvaluationMetrics(): Promise<TrainerEvaluationMetrics | null> {
    return this.restFallback.getEvaluationMetrics();
  }
}

export const sandiaApi = new RestSandiaApiAdapter();
