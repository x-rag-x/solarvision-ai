/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * Authenticated tRPC Adapter & Network Transport
 * 
 * STRICT COMPLIANCE:
 * - Calls Node/tRPC procedures via typed trpcVanilla proxy client with SuperJSON and auth headers.
 * - Uses sandiaPerformance.status, schema, targetDefinition, sampleInput, metadata, predict, predictBatch, history, and detail.
 * - Does not bypass Node authentication with direct FastAPI requests in production.
 * - Fully preserves dynamic trainer-defined input features and target units.
 * - Retrieves persistent database history from sandiaPerformance.history.
 * - ZERO FABRICATION GUARANTEE: Never invents synthetic numbers or fake confidence intervals.
 */

import { trpcVanilla, getAuthHeaders, getBaseUrl } from "@/lib/trpc";
import type {
  FeatureSchemaManifest,
  FeatureSpec,
  PaginatedSandiaResult,
  SandiaBatchPredictionInput,
  SandiaBatchPredictionResponse,
  SandiaHistoryQueryOptions,
  SandiaMetadataResponse,
  SandiaModelStatusResponse,
  SandiaPredictionHistoryItem,
  SandiaPredictionInput,
  SandiaPredictionRecord,
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

/**
 * Maps tRPC errors into standard typed SandiaApiErrors.
 */
export function mapTrpcError(err: any, operation = "operation"): SandiaApiError {
  if (err instanceof SandiaApiError) {
    return err;
  }

  const rawMsg = err?.message || err?.detail || String(err);
  const data = err?.data;
  const httpStatus = data?.httpStatus || err?.status || err?.statusCode;
  const trpcCode = data?.code || err?.shape?.code || err?.code;
  const limitations =
    data?.details?.limitations || data?.limitations || err?.limitations || [];

  // 1. Authentication / Authorization expired
  const isAuth =
    httpStatus === 401 ||
    trpcCode === "UNAUTHORIZED" ||
    rawMsg.includes("UNAUTHORIZED") ||
    rawMsg.includes("unauthenticated") ||
    rawMsg.includes("Missing session") ||
    rawMsg.includes("authorization expired") ||
    rawMsg.includes("Authentication required") ||
    err?.shape?.code === -32001;

  if (isAuth) {
    return new SandiaApiError(
      "Operator authorization expired or unauthenticated. Please sign in with a valid session.",
      "UNAUTHORIZED",
      401,
      limitations
    );
  }

  // 2. Validation / Bad Request
  const isValidation =
    httpStatus === 422 ||
    httpStatus === 400 ||
    trpcCode === "BAD_REQUEST" ||
    trpcCode === "UNPROCESSABLE_CONTENT" ||
    rawMsg.includes("validation") ||
    rawMsg.includes("outside valid") ||
    rawMsg.includes("Features dictionary cannot be empty") ||
    rawMsg.includes("Missing required feature");

  if (isValidation) {
    return new SandiaApiError(
      rawMsg || "Input feature validation failed against trainer schema.",
      "VALIDATION_ERROR",
      httpStatus || 422,
      limitations
    );
  }

  // 3. Model Unavailable / Not Trained / Precondition Failed
  const isUnavailable =
    httpStatus === 503 ||
    trpcCode === "PRECONDITION_FAILED" ||
    trpcCode === "SERVICE_UNAVAILABLE" ||
    rawMsg.includes("not ready") ||
    rawMsg.includes("not loaded") ||
    rawMsg.includes("not_trained") ||
    rawMsg.includes("pipeline.joblib") ||
    rawMsg.includes("Service Unavailable") ||
    rawMsg.includes("Service unavailable") ||
    rawMsg.includes("unreachable") ||
    rawMsg.includes("offline");

  if (isUnavailable) {
    return new SandiaApiError(
      rawMsg || "Sandia performance model artifact is not loaded or ready.",
      "MODEL_UNAVAILABLE",
      503,
      limitations
    );
  }

  // 4. Schema Pending
  if (rawMsg.includes("pending_trainer") || rawMsg.includes("SCHEMA_PENDING")) {
    return new SandiaApiError(
      rawMsg || "Trainer feature contract is pending delivery.",
      "SCHEMA_PENDING",
      503,
      limitations
    );
  }

  // 5. Network error / Timeout
  const isNetwork =
    httpStatus === 504 ||
    trpcCode === "TIMEOUT" ||
    rawMsg.includes("TIMEOUT") ||
    rawMsg.includes("Failed to fetch") ||
    rawMsg.includes("NetworkError") ||
    rawMsg.includes("ECONNREFUSED");

  if (isNetwork) {
    return new SandiaApiError(
      rawMsg || "Network communication with Sandia inference service timed out.",
      "NETWORK_ERROR",
      httpStatus || 504,
      limitations
    );
  }

  return new SandiaApiError(
    rawMsg || `Sandia inference operation failed during ${operation}.`,
    "UNKNOWN",
    httpStatus || 500,
    limitations
  );
}

/**
 * Normalizes model status response to guarantee both snake_case and camelCase accessors.
 */
export function normalizeStatusResponse(data: any): SandiaModelStatusResponse {
  if (!data) {
    return {
      model_name: "SolarVision-Sandia-Performance-Model3",
      modelName: "SolarVision-Sandia-Performance-Model3",
      model_version: "none",
      modelVersion: "none",
      contract_version: "1.0.0",
      contractVersion: "1.0.0",
      is_ready: false,
      isReady: false,
      status: "not_trained",
      artifact_name: "pipeline.joblib",
      artifactName: "pipeline.joblib",
      unavailability_reason: "Model status unavailable.",
      unavailabilityReason: "Model status unavailable.",
      feature_schema_loaded: false,
      featureSchemaLoaded: false,
      feature_schema: null,
      featureSchema: null,
      sample_input_loaded: false,
      sampleInputLoaded: false,
      sample_input: null,
      sampleInput: null,
      target_definition_loaded: false,
      targetDefinitionLoaded: false,
      target_definition: null,
      targetDefinition: null,
      is_mock: false,
      isMock: false,
      trainer_handoff_pending: true,
      trainerHandoffPending: true,
      expected_dim: null,
      expectedDim: null,
    };
  }

  const isReady = Boolean(data.isReady ?? data.is_ready);
  const isMock = Boolean(data.isMock ?? data.is_mock);
  const trainerHandoffPending = Boolean(
    data.trainerHandoffPending ?? data.trainer_handoff_pending
  );
  const featureSchemaLoaded = Boolean(
    data.featureSchemaLoaded ?? data.feature_schema_loaded
  );
  const sampleInputLoaded = Boolean(
    data.sampleInputLoaded ?? data.sample_input_loaded
  );
  const targetDefinitionLoaded = Boolean(
    data.targetDefinitionLoaded ?? data.target_definition_loaded
  );
  const featureSchema = data.featureSchema || data.feature_schema || null;
  const sampleInput = data.sampleInput || data.sample_input || null;
  const targetDefinition = data.targetDefinition || data.target_definition || null;

  return {
    model_name:
      data.modelName || data.model_name || "SolarVision-Sandia-Performance-Model3",
    modelName:
      data.modelName || data.model_name || "SolarVision-Sandia-Performance-Model3",
    model_version: data.modelVersion || data.model_version || "none",
    modelVersion: data.modelVersion || data.model_version || "none",
    contract_version: data.contractVersion || data.contract_version || "1.0.0",
    contractVersion: data.contractVersion || data.contract_version || "1.0.0",
    is_ready: isReady,
    isReady: isReady,
    status: data.status,
    artifact_name: data.artifactName || data.artifact_name || "pipeline.joblib",
    artifactName: data.artifactName || data.artifact_name || "pipeline.joblib",
    unavailability_reason:
      data.unavailabilityReason ?? data.unavailability_reason ?? null,
    unavailabilityReason:
      data.unavailabilityReason ?? data.unavailability_reason ?? null,
    feature_schema_loaded: featureSchemaLoaded,
    featureSchemaLoaded: featureSchemaLoaded,
    feature_schema: featureSchema,
    featureSchema: featureSchema,
    sample_input_loaded: sampleInputLoaded,
    sampleInputLoaded: sampleInputLoaded,
    sample_input: sampleInput,
    sampleInput: sampleInput,
    target_definition_loaded: targetDefinitionLoaded,
    targetDefinitionLoaded: targetDefinitionLoaded,
    target_definition: targetDefinition,
    targetDefinition: targetDefinition,
    is_mock: isMock,
    isMock: isMock,
    trainer_handoff_pending: trainerHandoffPending,
    trainerHandoffPending: trainerHandoffPending,
    expected_dim: data.expectedDim ?? data.expected_dim ?? null,
    expectedDim: data.expectedDim ?? data.expected_dim ?? null,
  };
}

/**
 * Normalizes single prediction response to guarantee both snake_case and camelCase accessors.
 */
export function normalizePredictionResponse(data: any): SandiaPredictionResponse {
  const isMock = Boolean(data.isMock ?? data.is_mock);
  let predItem: any = null;
  const rawPred = data.prediction;

  if (rawPred) {
    const pIsMock = Boolean(rawPred.isMock ?? rawPred.is_mock ?? isMock);
    const featuresUsed = rawPred.featuresUsed || rawPred.features_used || [];
    const warnings = rawPred.warnings || [];

    predItem = {
      module_id: rawPred.moduleId ?? rawPred.module_id ?? null,
      moduleId: rawPred.moduleId ?? rawPred.module_id ?? null,
      prediction: rawPred.prediction,
      prediction_label:
        rawPred.predictionLabel ?? rawPred.prediction_label ?? null,
      predictionLabel:
        rawPred.predictionLabel ?? rawPred.prediction_label ?? null,
      target_name: rawPred.targetName ?? rawPred.target_name ?? "Pmp",
      targetName: rawPred.targetName ?? rawPred.target_name ?? "Pmp",
      target_unit: rawPred.targetUnit ?? rawPred.target_unit ?? "W",
      targetUnit: rawPred.targetUnit ?? rawPred.target_unit ?? "W",
      confidence: rawPred.confidence ?? null,
      uncertainty: rawPred.uncertainty ?? null,
      features_used: featuresUsed,
      featuresUsed: featuresUsed,
      is_mock: pIsMock,
      isMock: pIsMock,
      warnings: warnings,
    };
  }

  return {
    contract_version: data.contractVersion || data.contract_version || "1.0.0",
    contractVersion: data.contractVersion || data.contract_version || "1.0.0",
    status: data.status,
    model_name:
      data.modelName || data.model_name || "SolarVision-Sandia-Performance-Model3",
    modelName:
      data.modelName || data.model_name || "SolarVision-Sandia-Performance-Model3",
    model_version: data.modelVersion || data.model_version || "1.0.0",
    modelVersion: data.modelVersion || data.model_version || "1.0.0",
    is_mock: isMock,
    isMock: isMock,
    prediction: predItem,
    limitations: data.limitations || [],
    processing_time_ms: data.processingTimeMs ?? data.processing_time_ms ?? 0,
    processingTimeMs: data.processingTimeMs ?? data.processing_time_ms ?? 0,
    persistedId: data.persistedId ?? null,
  };
}

/**
 * Normalizes batch prediction response.
 */
export function normalizeBatchResponse(data: any): SandiaBatchPredictionResponse {
  const isMock = Boolean(data.isMock ?? data.is_mock);
  const rawList = data.predictions || [];
  const predictions = rawList.map((p: any) => ({
    module_id: p.moduleId ?? p.module_id ?? null,
    moduleId: p.moduleId ?? p.module_id ?? null,
    prediction: p.prediction,
    prediction_label: p.predictionLabel ?? p.prediction_label ?? null,
    predictionLabel: p.predictionLabel ?? p.prediction_label ?? null,
    target_name: p.targetName ?? p.target_name ?? "Pmp",
    targetName: p.targetName ?? p.target_name ?? "Pmp",
    target_unit: p.targetUnit ?? p.target_unit ?? "W",
    targetUnit: p.targetUnit ?? p.target_unit ?? "W",
    confidence: p.confidence ?? null,
    uncertainty: p.uncertainty ?? null,
    features_used: p.featuresUsed || p.features_used || [],
    featuresUsed: p.featuresUsed || p.features_used || [],
    is_mock: Boolean(p.isMock ?? p.is_mock ?? isMock),
    isMock: Boolean(p.isMock ?? p.is_mock ?? isMock),
    warnings: p.warnings || [],
  }));

  return {
    contract_version: data.contractVersion || data.contract_version || "1.0.0",
    contractVersion: data.contractVersion || data.contract_version || "1.0.0",
    status: data.status,
    model_name:
      data.modelName || data.model_name || "SolarVision-Sandia-Performance-Model3",
    modelName:
      data.modelName || data.model_name || "SolarVision-Sandia-Performance-Model3",
    model_version: data.modelVersion || data.model_version || "1.0.0",
    modelVersion: data.modelVersion || data.model_version || "1.0.0",
    is_mock: isMock,
    isMock: isMock,
    predictions,
    total_items: data.totalItems ?? data.total_items ?? predictions.length,
    totalItems: data.totalItems ?? data.total_items ?? predictions.length,
    limitations: data.limitations || [],
    processing_time_ms: data.processingTimeMs ?? data.processing_time_ms ?? 0,
    processingTimeMs: data.processingTimeMs ?? data.processing_time_ms ?? 0,
    persistedIds: data.persistedIds || [],
  };
}

export interface SandiaApiAdapter {
  getStatus(): Promise<SandiaModelStatusResponse>;
  getSchema(): Promise<{
    status: string;
    schemaVersion?: string;
    schema_version?: string;
    datasetName?: string | null;
    dataset_name?: string | null;
    features?: any[];
    metadata?: Record<string, any>;
    message?: string;
  }>;
  getTargetDefinition(): Promise<{
    status: string;
    targetDefinition?: TargetDefinitionManifest;
    target_definition?: TargetDefinitionManifest;
    message?: string;
  }>;
  getSampleInput(): Promise<{
    status: string;
    sampleInput?: Record<string, any>;
    sample_input?: Record<string, any>;
    message?: string;
  }>;
  getMetadata(): Promise<SandiaMetadataResponse>;
  predict(input: SandiaPredictionInput): Promise<SandiaPredictionResponse>;
  predictBatch(
    input: SandiaBatchPredictionInput
  ): Promise<SandiaBatchPredictionResponse>;
  getHistory(options?: {
    moduleId?: string;
    limit?: number;
    offset?: number;
  }): Promise<SandiaPredictionHistoryItem[]>;
  getDetail?(id: string): Promise<SandiaPredictionRecord | null>;
  getEvaluationMetrics(): Promise<TrainerEvaluationMetrics | null>;
}

/**
 * Authenticated tRPC Adapter for Model 3 Sandia Solar Performance Prediction.
 * Communicates with Node tRPC layer which handles authentication, database persistence,
 * and IPC to Python Sandia engine.
 */
export class TrpcSandiaApiAdapter implements SandiaApiAdapter {
  private client: typeof trpcVanilla;

  constructor(customClient?: typeof trpcVanilla) {
    this.client = customClient ?? trpcVanilla;
  }

  async getStatus(): Promise<SandiaModelStatusResponse> {
    try {
      const res = await this.client.sandiaPerformance.status.query();
      return normalizeStatusResponse(res);
    } catch (err: any) {
      throw mapTrpcError(err, "getStatus");
    }
  }

  async getSchema(): Promise<{
    status: string;
    schemaVersion?: string;
    schema_version?: string;
    datasetName?: string | null;
    dataset_name?: string | null;
    features?: any[];
    metadata?: Record<string, any>;
    message?: string;
  }> {
    try {
      const res: any = await this.client.sandiaPerformance.schema.query();
      const features = res?.features || [];
      const isLoaded = res?.status === "loaded" || features.length > 0;
      return {
        status: isLoaded ? "loaded" : "pending_trainer",
        schemaVersion: res?.schemaVersion || res?.schema_version || "1.0.0",
        schema_version: res?.schemaVersion || res?.schema_version || "1.0.0",
        datasetName: res?.datasetName || res?.dataset_name || null,
        dataset_name: res?.datasetName || res?.dataset_name || null,
        features,
        metadata: res?.metadata || {},
        message: res?.message,
      };
    } catch (err: any) {
      throw mapTrpcError(err, "getSchema");
    }
  }

  async getTargetDefinition(): Promise<{
    status: string;
    targetDefinition?: TargetDefinitionManifest;
    target_definition?: TargetDefinitionManifest;
    message?: string;
  }> {
    try {
      const res: any = await this.client.sandiaPerformance.targetDefinition.query();
      const target = res?.targetDefinition || res?.target_definition || res;
      const isLoaded = Boolean(target?.target_name || target?.targetName);
      return {
        status: isLoaded ? "loaded" : "pending_trainer",
        targetDefinition: target,
        target_definition: target,
        message: res?.message,
      };
    } catch (err: any) {
      throw mapTrpcError(err, "getTargetDefinition");
    }
  }

  async getSampleInput(): Promise<{
    status: string;
    sampleInput?: Record<string, any>;
    sample_input?: Record<string, any>;
    message?: string;
  }> {
    try {
      const res: any = await this.client.sandiaPerformance.sampleInput.query();
      const sample = res?.sampleInput || res?.sample_input || res;
      const isLoaded = Boolean(sample && Object.keys(sample).length > 0);
      return {
        status: isLoaded ? "loaded" : "pending_trainer",
        sampleInput: sample,
        sample_input: sample,
        message: res?.message,
      };
    } catch (err: any) {
      throw mapTrpcError(err, "getSampleInput");
    }
  }

  async getMetadata(): Promise<SandiaMetadataResponse> {
    try {
      return await this.client.sandiaPerformance.metadata.query();
    } catch (err: any) {
      throw mapTrpcError(err, "getMetadata");
    }
  }

  async predict(input: SandiaPredictionInput): Promise<SandiaPredictionResponse> {
    const moduleId = input.moduleId || input.module_id;
    const trpcInput = {
      moduleId: moduleId?.trim() ? moduleId.trim() : undefined,
      timestamp: input.timestamp || new Date().toISOString(),
      features: input.features,
      metadata: input.metadata,
    };

    try {
      const res = await this.client.sandiaPerformance.predict.mutate(trpcInput);
      return normalizePredictionResponse(res);
    } catch (err: any) {
      throw mapTrpcError(err, "predict");
    }
  }

  async predictBatch(
    input: SandiaBatchPredictionInput
  ): Promise<SandiaBatchPredictionResponse> {
    const items = (input.items || []).map(it => {
      const mId = it.moduleId || it.module_id;
      return {
        moduleId: mId?.trim() ? mId.trim() : undefined,
        timestamp: it.timestamp || new Date().toISOString(),
        features: it.features,
        metadata: it.metadata,
      };
    });

    try {
      const res = await this.client.sandiaPerformance.predictBatch.mutate({
        items,
      });
      return normalizeBatchResponse(res);
    } catch (err: any) {
      throw mapTrpcError(err, "predictBatch");
    }
  }

  async getHistory(options?: {
    moduleId?: string;
    limit?: number;
    offset?: number;
  }): Promise<SandiaPredictionHistoryItem[]> {
    try {
      const queryInput = {
        moduleId: options?.moduleId?.trim() ? options.moduleId.trim() : undefined,
        limit: options?.limit ?? 50,
        offset: options?.offset ?? 0,
      };
      const res = await this.client.sandiaPerformance.history.query(queryInput);
      const items = res?.items || [];
      return items.map((rec: any) => ({
        id: rec.id,
        moduleId: rec.moduleId || "PV-UNSPECIFIED",
        timestamp: rec.createdAt,
        prediction: rec.predictedValue,
        predictionLabel: rec.predictionLabel ?? undefined,
        targetName: rec.targetName || "Pmp",
        targetUnit: rec.targetUnit || "W",
        modelVersion: rec.modelVersion || "1.0.0",
        processingTimeMs: rec.metadata?.processingTimeMs ?? 0,
        isMock: Boolean(rec.isMock),
        warnings: rec.warnings || [],
        inputFeatures: rec.inputFeatures || {},
        userId: rec.userId ?? null,
      }));
    } catch (err: any) {
      throw mapTrpcError(err, "getHistory");
    }
  }

  async getDetail(id: string): Promise<SandiaPredictionRecord | null> {
    try {
      return await this.client.sandiaPerformance.detail.query({ id });
    } catch (err: any) {
      throw mapTrpcError(err, "getDetail");
    }
  }

  async getEvaluationMetrics(): Promise<TrainerEvaluationMetrics | null> {
    try {
      const meta = await this.getMetadata();
      if ((meta as any)?.evaluationMetrics) {
        return (meta as any).evaluationMetrics;
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Legacy REST adapter retained for isolated fixture compatibility and direct testing.
 * Not used as the primary production transport.
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
        const errorDetail =
          data?.detail || data?.message || response.statusText;
        if (response.status === 503) {
          throw new SandiaApiError(
            errorDetail ||
              "Sandia performance model artifact is not loaded or ready.",
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
        err?.message ||
          "Failed to communicate with Sandia performance service.",
        "NETWORK_ERROR"
      );
    }
  }

  async getStatus(): Promise<SandiaModelStatusResponse> {
    try {
      const data = await this.fetchEndpoint("/api/sandia-performance/status");
      return normalizeStatusResponse(data);
    } catch (err) {
      const data = await this.fetchEndpoint("/sandia-performance/status");
      return normalizeStatusResponse(data);
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
      return await this.fetchEndpoint(
        "/api/sandia-performance/target-definition"
      );
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

    return normalizePredictionResponse(result);
  }

  async predictBatch(
    input: SandiaBatchPredictionInput
  ): Promise<SandiaBatchPredictionResponse> {
    let result: SandiaBatchPredictionResponse;
    try {
      result = await this.fetchEndpoint(
        "/api/sandia-performance/predict-batch",
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      );
    } catch (err: any) {
      if (err.statusCode === 503 || err.statusCode === 422) throw err;
      result = await this.fetchEndpoint("/sandia-performance/predict-batch", {
        method: "POST",
        body: JSON.stringify(input),
      });
    }
    return normalizeBatchResponse(result);
  }

  async getHistory(options?: {
    moduleId?: string;
    limit?: number;
  }): Promise<SandiaPredictionHistoryItem[]> {
    // Legacy fallback proxies to tRPC for persistent history
    const trpcAdapter = new TrpcSandiaApiAdapter();
    return trpcAdapter.getHistory(options);
  }

  async getEvaluationMetrics(): Promise<TrainerEvaluationMetrics | null> {
    try {
      const meta = await this.getMetadata();
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
 * Production Sandia API transport client connecting to authenticated Node/tRPC procedures.
 */
export const sandiaApi = new TrpcSandiaApiAdapter();
