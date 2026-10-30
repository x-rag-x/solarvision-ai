/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * Orchestration Service, Dynamic Contracts & Database Persistence Coordination
 */

import { SandiaApiClient, sandiaApiClient } from "./apiClient";
import { appLogger } from "../systemHealth/logger";
import {
  SandiaPersistenceRepository,
  getSandiaRepository,
} from "./persistence/repository";
import type {
  FeatureSchemaManifest,
  PaginatedSandiaResult,
  RequesterContext,
  SandiaBatchPredictionInput,
  SandiaBatchPredictionResponse,
  SandiaHistoryQueryOptions,
  SandiaMetadataResponse,
  SandiaModelStatusResponse,
  SandiaPredictionInput,
  SandiaPredictionRecord,
  SandiaPredictionResponse,
  SandiaReadinessSummary,
  TargetDefinitionManifest,
} from "./types";

export class SandiaPerformanceService {
  private readonly apiClient: SandiaApiClient;
  private readonly repository: SandiaPersistenceRepository;

  constructor(
    apiClient?: SandiaApiClient,
    repository?: SandiaPersistenceRepository
  ) {
    this.apiClient = apiClient || sandiaApiClient;
    this.repository = repository || getSandiaRepository();
  }

  /**
   * Queries Sandia electrical performance model status, readiness, and artifact details.
   */
  public async getStatus(): Promise<SandiaModelStatusResponse> {
    return this.apiClient.getStatus();
  }

  /**
   * Queries trainer feature schema specification.
   */
  public async getSchema(): Promise<FeatureSchemaManifest | any> {
    return this.apiClient.getSchema();
  }

  /**
   * Queries target variable specification dynamically from target_definition.json.
   */
  public async getTargetDefinition(): Promise<TargetDefinitionManifest | any> {
    return this.apiClient.getTargetDefinition();
  }

  /**
   * Queries sample input conforming to trainer schema.
   */
  public async getSampleInput(): Promise<Record<string, any>> {
    return this.apiClient.getSampleInput();
  }

  /**
   * Queries Model 3 Sandia provenance and architecture metadata.
   */
  public async getMetadata(): Promise<SandiaMetadataResponse> {
    return this.apiClient.getMetadata();
  }

  /**
   * Executes single prediction with dynamic features, module ID, and persistence of real results.
   * Strictly enforces Task 4 (dynamic target/features) and Task 8 (no mock saving).
   */
  public async predict(
    input: SandiaPredictionInput,
    requester?: RequesterContext
  ): Promise<SandiaPredictionResponse> {
    appLogger.info("MODEL 3", `Executing Sandia solar electrical performance prediction...`);
    const response = await this.apiClient.predict(input);
    appLogger.info("MODEL 3", `Sandia prediction completed: val=${response.prediction?.prediction?.toFixed(2)}%, status=${response.status}`);

    // Only persist if status is ready AND not a mock prediction
    const isMock = response.isMock || Boolean(response.prediction?.isMock);
    if (response.status === "ready" && response.prediction && !isMock) {
      try {
        const targetName =
          response.prediction.targetName || "electrical_performance";
        const targetUnit = response.prediction.targetUnit ?? null;
        const predictedVal = Number(response.prediction.prediction);

        const saved = this.repository.savePrediction({
          userId: requester?.userId ?? null,
          moduleId: input.moduleId || response.prediction.moduleId || null,
          inputFeatures: input.features,
          predictedValue: predictedVal,
          predictionLabel: response.prediction.predictionLabel ?? null,
          targetName,
          targetUnit,
          confidence: response.prediction.confidence ?? null,
          uncertainty: response.prediction.uncertainty ?? null,
          featuresUsed: response.prediction.featuresUsed ?? null,
          modelVersion: response.modelVersion || "1.0.0",
          datasetProvenance:
            "Sandia National Laboratories PV Performance Modeling Telemetry",
          isMock: false,
          warnings: response.prediction.warnings ?? null,
          metadata: input.metadata ?? null,
        });

        response.persistedId = saved.id;
      } catch (saveErr) {
        console.warn(
          "[Sandia Service] Failed to persist successful prediction:",
          saveErr
        );
      }
    }

    return response;
  }

  /**
   * Executes batch prediction across multiple PV module telemetry observations.
   * Persists all successful real predictions without saving mock results.
   */
  public async predictBatch(
    input: SandiaBatchPredictionInput,
    requester?: RequesterContext
  ): Promise<SandiaBatchPredictionResponse> {
    const response = await this.apiClient.predictBatch(input);
    const persistedIds: string[] = [];

    // Only persist real predictions (Task 8: Zero synthetic / mock results saved)
    if (
      response.status === "ready" &&
      !response.isMock &&
      response.predictions.length > 0
    ) {
      for (let i = 0; i < response.predictions.length; i++) {
        const pred = response.predictions[i];
        const itemInput = input.items[i];

        if (!pred.isMock) {
          try {
            const targetName = pred.targetName || "electrical_performance";
            const targetUnit = pred.targetUnit ?? null;
            const predictedVal = Number(pred.prediction);

            const saved = this.repository.savePrediction({
              userId: requester?.userId ?? null,
              moduleId: itemInput?.moduleId || pred.moduleId || null,
              inputFeatures: itemInput?.features || {},
              predictedValue: predictedVal,
              predictionLabel: pred.predictionLabel ?? null,
              targetName,
              targetUnit,
              confidence: pred.confidence ?? null,
              uncertainty: pred.uncertainty ?? null,
              featuresUsed: pred.featuresUsed ?? null,
              modelVersion: response.modelVersion || "1.0.0",
              datasetProvenance:
                "Sandia National Laboratories PV Performance Modeling Telemetry",
              isMock: false,
              warnings: pred.warnings ?? null,
              metadata: itemInput?.metadata ?? null,
            });

            persistedIds.push(saved.id);
          } catch (saveErr) {
            console.warn(
              `[Sandia Service] Batch item ${i} persistence skipped:`,
              saveErr
            );
          }
        }
      }
    }

    if (persistedIds.length > 0) {
      response.persistedIds = persistedIds;
    }

    return response;
  }

  /**
   * Queries paginated prediction history with ownership authorization.
   */
  public getHistory(
    options: SandiaHistoryQueryOptions = {},
    requester?: RequesterContext
  ): PaginatedSandiaResult {
    return this.repository.getPredictionHistory(options, requester);
  }

  /**
   * Queries a specific prediction record by ID with authorization check.
   */
  public getById(
    id: string,
    requester?: RequesterContext
  ): SandiaPredictionRecord | null {
    return this.repository.getPredictionById(id, requester);
  }

  /**
   * Aggregates model readiness and database persistence summary.
   */
  public async getReadinessSummary(
    requester?: RequesterContext
  ): Promise<SandiaReadinessSummary> {
    let modelStatus: SandiaModelStatusResponse;
    try {
      modelStatus = await this.apiClient.getStatus();
    } catch (err: any) {
      modelStatus = {
        modelName: "SolarVision-Sandia-Performance-Model3",
        modelVersion: "none",
        contractVersion: "1.0.0",
        isReady: false,
        status: "not_trained",
        artifactName: "pipeline.joblib",
        unavailabilityReason:
          "Inference service is currently offline or unreachable.",
        featureSchemaLoaded: false,
        sampleInputLoaded: false,
        targetDefinitionLoaded: false,
        isMock: false,
        trainerHandoffPending: true,
      };
    }

    const dbStats = this.repository.getReadinessSummary(requester);

    return {
      modelStatus,
      storedPredictionsCount: dbStats.totalPredictions,
      recentModulesCount: dbStats.distinctModules,
      latestPredictionTimestamp: dbStats.latestPrediction,
    };
  }
}

export const sandiaPerformanceService = new SandiaPerformanceService();
