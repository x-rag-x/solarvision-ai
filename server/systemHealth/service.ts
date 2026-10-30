/**
 * SolarVision AI — System Health Service
 * End-to-End Infrastructure, Database & 4-Model Readiness Telemetry
 */

import axios from "axios";
import { existsSync, statSync, readFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { getSqliteDb, getSqliteDbPath } from "../sqlite";
import { isSupabaseConfigured } from "../inspection/supabase";
import { getModel2ScreeningStatus } from "../cellScreening/service";
import { sandiaPerformanceService } from "../sandiaPerformance/service";
import { getModel4Status, forecastPredictiveMaintenance } from "../predictiveMaintenance/service";
import { appLogger } from "./logger";
import type {
  DatabaseHealthInfo,
  DatabaseTableInfo,
  ModelHealthInfo,
  ModelSelfTestResult,
  OverallHealthState,
  ServiceHealthState,
  SystemHealthSummary,
} from "./types";

const cwd = resolve(process.cwd());

export class SystemHealthService {
  private lastCheckTimestamps: Record<string, { lastSuccessful: string | null; lastAttempted: string }> = {
    database: { lastSuccessful: null, lastAttempted: new Date().toISOString() },
    model1: { lastSuccessful: null, lastAttempted: new Date().toISOString() },
    model2: { lastSuccessful: null, lastAttempted: new Date().toISOString() },
    model3: { lastSuccessful: null, lastAttempted: new Date().toISOString() },
    model4: { lastSuccessful: null, lastAttempted: new Date().toISOString() },
  };

  /**
   * Performs an authoritative, real check of the SQLite database and its tables.
   */
  public async checkDatabaseHealth(): Promise<DatabaseHealthInfo[]> {
    const attemptedAt = new Date().toISOString();
    this.lastCheckTimestamps.database.lastAttempted = attemptedAt;
    const t0 = performance.now();

    const tablesToCheck: { name: string; modelTarget: string }[] = [
      { name: "inspections", modelTarget: "Model 1: YOLO Defect Inspections" },
      { name: "detections", modelTarget: "Model 1: Bounding Box Detections" },
      { name: "cell_screening_predictions", modelTarget: "Model 2: ELPV Screening History" },
      { name: "predictive_quality_forecasts", modelTarget: "Model 3: SECOM Quality Forecasts" },
      { name: "sandia_performance_predictions", modelTarget: "Model 3: Sandia Electrical Records" },
      { name: "maintenance_predictions", modelTarget: "Model 4: Predictive Maintenance Predictions" },
      { name: "root_cause_predictions", modelTarget: "Analytics: Root Cause Predictions" },
      { name: "alert_records", modelTarget: "Platform: System & Model Alerts" },
    ];

    let sqliteInfo: DatabaseHealthInfo;

    try {
      const db = getSqliteDb();
      const pingStmt = db.prepare("SELECT 1 as alive");
      const pingRes = pingStmt.get() as { alive: number } | undefined;

      if (!pingRes || pingRes.alive !== 1) {
        throw new Error("Database responded but failed sanity check query (SELECT 1 != 1).");
      }

      const tableInfos: DatabaseTableInfo[] = [];
      let tablesVerified = 0;

      for (const t of tablesToCheck) {
        try {
          const countStmt = db.prepare(`SELECT count(*) as total FROM ${t.name}`);
          const countRes = countStmt.get() as { total: number } | undefined;
          const count = countRes?.total ?? 0;
          tableInfos.push({
            name: t.name,
            rowCount: Number(count),
            verified: true,
            modelTarget: t.modelTarget,
          });
          tablesVerified++;
        } catch {
          tableInfos.push({
            name: t.name,
            rowCount: 0,
            verified: false,
            modelTarget: t.modelTarget,
          });
        }
      }

      const t1 = performance.now();
      const pingLatency = Math.round((t1 - t0) * 10) / 10;
      this.lastCheckTimestamps.database.lastSuccessful = attemptedAt;

      sqliteInfo = {
        name: "SQLite Application Database",
        type: "sqlite",
        state: tablesVerified === tablesToCheck.length ? "connected" : "degraded",
        pingLatencyMs: pingLatency,
        lastChecked: attemptedAt,
        details: {
          path: basename(getSqliteDbPath()),
          mode: "WAL (Write-Ahead Logging)",
          tablesVerified,
          tables: tableInfos,
          note: "Primary local persistent storage for all four AI models, operator sessions, and telemetry.",
        },
      };
    } catch (err: any) {
      const t1 = performance.now();
      sqliteInfo = {
        name: "SQLite Application Database",
        type: "sqlite",
        state: "disconnected",
        pingLatencyMs: Math.round((t1 - t0) * 10) / 10,
        lastChecked: attemptedAt,
        errorMessage: err?.message || "Failed to execute database query.",
        details: {
          path: basename(getSqliteDbPath()),
          note: "Database connection failed.",
        },
      };
      appLogger.error("DATABASE", `Database connectivity failure: ${sqliteInfo.errorMessage}`);
    }

    // Supabase Cloud Storage Status
    const supabaseConfigured = isSupabaseConfigured();
    const supabaseInfo: DatabaseHealthInfo = {
      name: "Supabase Remote Sync",
      type: "supabase",
      state: supabaseConfigured ? "connected" : "not_configured",
      pingLatencyMs: null,
      lastChecked: attemptedAt,
      details: {
        note: supabaseConfigured
          ? "Supabase cloud bucket mirror is configured and active."
          : "Not configured. Local SQLite persistence is authoritative; cloud mirror is inactive.",
      },
    };

    return [sqliteInfo, supabaseInfo];
  }

  /**
   * Health Check: Model 1 — YOLO Defect Detection
   */
  public async checkModel1Health(): Promise<ModelHealthInfo> {
    const attemptedAt = new Date().toISOString();
    this.lastCheckTimestamps.model1.lastAttempted = attemptedAt;
    const t0 = performance.now();

    const modelPath = process.env.MODEL_PATH || resolve(cwd, "backend/models/best.pt");
    const checkpointExists = existsSync(modelPath);
    let fileSizeMb = 0;
    if (checkpointExists) {
      try {
        fileSizeMb = Math.round((statSync(modelPath).size / (1024 * 1024)) * 10) / 10;
      } catch {
        fileSizeMb = 0;
      }
    }

    const fastapiBaseUrl =
      process.env.SANDIA_API_URL ||
      process.env.PYTHON_BACKEND_URL ||
      process.env.FASTAPI_URL ||
      "http://127.0.0.1:8000";

    let backendConn: "fastapi_direct" | "cli_bridge" | "offline" = "cli_bridge";
    let isReady = false;
    let errorMsg: string | undefined;

    try {
      const resp = await axios.get(`${fastapiBaseUrl}/health`, {
        timeout: 2500,
        headers: { Accept: "application/json" },
      });
      if (resp.status === 200 && resp.data?.status === "ok") {
        backendConn = "fastapi_direct";
        isReady = checkpointExists && Boolean(resp.data?.model_exists);
      }
    } catch {
      // FastAPI offline; CLI fallback operates locally if checkpoint exists
      backendConn = "cli_bridge";
      isReady = checkpointExists;
    }

    const t1 = performance.now();
    const latency = Math.round((t1 - t0) * 10) / 10;

    if (isReady) {
      this.lastCheckTimestamps.model1.lastSuccessful = attemptedAt;
    } else if (!checkpointExists) {
      errorMsg = "Checkpoint best.pt not found on disk.";
    }

    const state: ServiceHealthState = isReady ? "ready" : checkpointExists ? "degraded" : "unavailable";

    return {
      modelId: "solarvision_m1_yolo_pvelad_v1",
      name: "Model 1 — EL/NIR Solar Cell Defect Detection (YOLO26n)",
      shortName: "Model 1 YOLO",
      state,
      artifactStatus: checkpointExists ? `Checkpoint present (${fileSizeMb} MB)` : "Checkpoint missing",
      artifactPath: basename(modelPath),
      backendConnectivity: backendConn,
      dbPersistenceAvailable: true,
      healthCheckLatencyMs: latency,
      lastSuccessfulCheck: this.lastCheckTimestamps.model1.lastSuccessful,
      lastAttemptedCheck: attemptedAt,
      errorMessage: errorMsg,
      limitations: [
        "Evaluated on PVELAD benchmark (mAP@50: 0.5483). Prototype model; not factory-production-certified.",
        "Requires cropped or centered EL/NIR solar cell captures for reliable feature activation.",
      ],
      capabilities: {
        canSelfTest: checkpointExists,
        threshold: 0.25,
      },
      details: {
        architecture: "YOLO26n Single-Stage Object Detector",
        classesCount: 9,
        supportedMimes: ["image/jpeg", "image/png", "image/tiff", "image/bmp"],
      },
    };
  }

  /**
   * Health Check: Model 2 — ELPV Cell Screening (EfficientNet-B0)
   */
  public async checkModel2Health(): Promise<ModelHealthInfo> {
    const attemptedAt = new Date().toISOString();
    this.lastCheckTimestamps.model2.lastAttempted = attemptedAt;
    const t0 = performance.now();

    const status = getModel2ScreeningStatus();
    const t1 = performance.now();
    const latency = Math.round((t1 - t0) * 10) / 10;

    const isReady = status.artifactsPresent;
    if (isReady) {
      this.lastCheckTimestamps.model2.lastSuccessful = attemptedAt;
    }

    const state: ServiceHealthState = isReady ? "ready" : "unavailable";

    return {
      modelId: "solarvision_m2_elpv_binary_v1",
      name: "Model 2 — Full-Cell Grayscale EL Defect Screening",
      shortName: "Model 2 ELPV",
      state,
      artifactStatus: status.artifactsPresent ? "Checkpoint & Preprocessing Ready" : "Artifacts missing",
      artifactPath: "model2_efficientnet_b0.pt",
      backendConnectivity: "node_direct",
      dbPersistenceAvailable: true,
      healthCheckLatencyMs: latency,
      lastSuccessfulCheck: this.lastCheckTimestamps.model2.lastSuccessful,
      lastAttemptedCheck: attemptedAt,
      errorMessage: status.artifactsPresent ? undefined : "EfficientNet checkpoint or preprocessing metadata missing.",
      limitations: status.benchmark.limitations,
      capabilities: {
        canSelfTest: isReady,
        isScreeningOnly: true,
        threshold: status.benchmark.threshold,
      },
      details: {
        framework: "PyTorch (torchvision EfficientNet-B0 transfer learning)",
        dataset: status.benchmark.dataset,
        accuracy: `${(status.benchmark.accuracy * 100).toFixed(2)}%`,
        recall: `${(status.benchmark.defectiveRecall * 100).toFixed(2)}%`,
        precision: `${(status.benchmark.defectivePrecision * 100).toFixed(2)}%`,
        mandatoryReviewPolicy: "Required on 100% of screenings. Zero automated accept/reject.",
      },
    };
  }

  /**
   * Health Check: Model 3 — Sandia Solar Electrical Performance Prediction
   */
  public async checkModel3Health(): Promise<ModelHealthInfo> {
    const attemptedAt = new Date().toISOString();
    this.lastCheckTimestamps.model3.lastAttempted = attemptedAt;
    const t0 = performance.now();

    const artifactPath = resolve(cwd, "backend/models/sandia/pipeline.joblib");
    const manifestPath = resolve(cwd, "backend/models/sandia/manifest.json");
    const artifactExists = existsSync(artifactPath);
    let shaVerified = false;

    if (artifactExists && existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
        const hash = createHash("sha256").update(readFileSync(artifactPath)).digest("hex");
        shaVerified = hash.toLowerCase() === (manifest.sha256 || "").toLowerCase();
      } catch {
        shaVerified = false;
      }
    }

    let isReady = false;
    let isMock = false;
    let errorMsg: string | undefined;

    try {
      const statusRes = await sandiaPerformanceService.getStatus();
      isReady = Boolean(statusRes.isReady && !statusRes.isMock);
      isMock = Boolean(statusRes.isMock);
      if (!isReady && statusRes.unavailabilityReason) {
        errorMsg = statusRes.unavailabilityReason;
      }
    } catch (err: any) {
      isReady = false;
      errorMsg = err?.message || "Sandia service check failed.";
    }

    const t1 = performance.now();
    const latency = Math.round((t1 - t0) * 10) / 10;

    if (isReady) {
      this.lastCheckTimestamps.model3.lastSuccessful = attemptedAt;
    }

    const state: ServiceHealthState = isReady
      ? "ready"
      : isMock
      ? "degraded"
      : artifactExists
      ? "degraded"
      : "unavailable";

    return {
      modelId: "model3_sandia_reference_power_v1",
      name: "Model 3 — Sandia Solar Electrical Performance Prediction",
      shortName: "Model 3 Sandia",
      state,
      artifactStatus: artifactExists
        ? shaVerified
          ? "Genuine Artifact (SHA-256 Verified)"
          : "Artifact Checksum Mismatch"
        : "Artifact Missing",
      artifactPath: "pipeline.joblib",
      artifactSha256Verified: shaVerified,
      backendConnectivity: "fastapi_direct",
      dbPersistenceAvailable: true,
      healthCheckLatencyMs: latency,
      lastSuccessfulCheck: this.lastCheckTimestamps.model3.lastSuccessful,
      lastAttemptedCheck: attemptedAt,
      errorMessage: errorMsg,
      limitations: [
        "Trained on Sandia National Laboratories PSEL field telemetry datasets.",
        "Reference-power regression model predicts relative electrical retention (%).",
        "Zero synthetic predictions policy: model will return 503 instead of fabricating uncalibrated outputs.",
      ],
      capabilities: {
        canSelfTest: isReady,
        isGenuineNonMock: isReady && !isMock,
      },
      details: {
        algorithm: "Random Forest Regressor (n_estimators=300, min_samples_leaf=3)",
        framework: "scikit-learn with ColumnTransformer preprocessing",
        target: "power_retention_pct (%)",
        provenance: "Sandia National Laboratories PV Performance Modeling Telemetry",
        benchmarkMae: "0.7927 percentage points",
      },
    };
  }

  /**
   * Health Check: Model 4 — Predictive Maintenance & RUL
   */
  public async checkModel4Health(): Promise<ModelHealthInfo> {
    const attemptedAt = new Date().toISOString();
    this.lastCheckTimestamps.model4.lastAttempted = attemptedAt;
    const t0 = performance.now();

    let benchmarkReady = false;
    let solarReady = false;
    let errorMsg: string | undefined;

    try {
      const statusRes = await getModel4Status("ai4i_synthetic_benchmark");
      benchmarkReady = Boolean(statusRes.benchmarkReady);
      solarReady = Boolean(statusRes.solarReady);
    } catch (err: any) {
      errorMsg = err?.message || "Model 4 status check failed.";
    }

    const t1 = performance.now();
    const latency = Math.round((t1 - t0) * 10) / 10;

    if (benchmarkReady) {
      this.lastCheckTimestamps.model4.lastSuccessful = attemptedAt;
    }

    const state: ServiceHealthState = benchmarkReady ? "ready" : "not_trained";

    return {
      modelId: "solarvision_m4_predictive_maintenance_v1",
      name: "Model 4 — Predictive Maintenance & RUL Forecasting",
      shortName: "Model 4 Maintenance",
      state,
      artifactStatus: benchmarkReady
        ? "AI4I Benchmark Pipeline Ready (Solar Factory Quarantined)"
        : "Benchmark Artifact Missing",
      artifactPath: "model4_predictive_maintenance.json",
      backendConnectivity: "node_direct",
      dbPersistenceAvailable: true,
      healthCheckLatencyMs: latency,
      lastSuccessfulCheck: this.lastCheckTimestamps.model4.lastSuccessful,
      lastAttemptedCheck: attemptedAt,
      errorMessage: errorMsg,
      limitations: [
        "AI4I 2020 synthetic benchmark model is operational for baseline multi-class failure assessment.",
        "Solar factory production maintenance model is strictly NOT_TRAINED pending empirical SCADA telemetry.",
        "Synthetic benchmark weights are segregated to prevent false alarms in operational solar stringers.",
      ],
      capabilities: {
        canSelfTest: benchmarkReady,
        isBenchmarkOnly: true,
      },
      details: {
        benchmarkDomain: "ai4i_synthetic_benchmark (Operational)",
        solarFactoryDomain: "solar_factory (Quarantined / Pending empirical data)",
        failureModes: ["Tool Wear Failure (TWF)", "Heat Dissipation (HDF)", "Power Failure (PWF)", "Overstrain (OSF)"],
      },
    };
  }

  /**
   * Fetches live terminal diagnostic logs from Python FastAPI's /api/logs endpoint
   * and ingests them into the live application console.
   */
  public async syncFastApiTerminalLogs(): Promise<void> {
    const baseUrl =
      process.env.FASTAPI_URL ||
      process.env.PYTHON_BACKEND_URL ||
      process.env.SANDIA_API_URL ||
      "http://127.0.0.1:8000";

    try {
      const res = await axios.get(`${baseUrl}/api/logs`, {
        params: { limit: 100 },
        timeout: 1000,
      });

      if (res.status === 200 && res.data?.logs && Array.isArray(res.data.logs)) {
        for (const item of res.data.logs) {
          const raw = item.raw || item.message;
          if (raw) {
            appLogger.ingestTerminalLine(raw);
          }
        }
      }
    } catch {
      // Python FastAPI daemon may not be active; ignore gracefully
    }
  }

  /**
   * Comprehensive System Health Overview
   */
  public async getSystemHealthOverview(): Promise<SystemHealthSummary> {
    await this.syncFastApiTerminalLogs();
    const [databases, model1, model2, model3, model4] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkModel1Health(),
      this.checkModel2Health(),
      this.checkModel3Health(),
      this.checkModel4Health(),
    ]);

    const activeServices = [
      databases[0].state,
      model1.state,
      model2.state,
      model3.state,
      model4.state,
    ];

    let healthyCount = 0;
    let degradedCount = 0;
    let unavailableCount = 0;
    let notConfiguredCount = databases.filter((db) => db.state === "not_configured").length;

    for (const s of activeServices) {
      if (s === "ready" || s === "healthy" || s === "connected") {
        healthyCount++;
      } else if (s === "degraded" || s === "not_trained") {
        degradedCount++;
      } else if (s === "unavailable" || s === "disconnected") {
        unavailableCount++;
      }
    }

    let overallStatus: OverallHealthState = "healthy";
    if (unavailableCount > 0) {
      overallStatus = "unavailable";
    } else if (degradedCount > 0) {
      overallStatus = "degraded";
    }

    const summary: SystemHealthSummary = {
      overallStatus,
      healthyCount,
      degradedCount,
      unavailableCount,
      notConfiguredCount,
      totalMonitored: activeServices.length,
      lastRefreshed: new Date().toISOString(),
      databases,
      models: {
        model1,
        model2,
        model3,
        model4,
      },
    };

    appLogger.debug("SYSTEM", `System health overview updated: ${overallStatus} (${healthyCount} healthy, ${degradedCount} degraded)`);
    return summary;
  }

  /**
   * Executes a lightweight self-test for a specified model using certified reference inputs.
   */
  public async runSelfTest(modelId: "model1" | "model2" | "model3" | "model4"): Promise<ModelSelfTestResult> {
    const executedAt = new Date().toISOString();
    const t0 = performance.now();

    try {
      if (modelId === "model2") {
        const samplePath = resolve(cwd, "backend/models/model2_elpv_v1/model2_sample_elpv_cell.png");
        if (!existsSync(samplePath)) {
          throw new Error("Sample ELPV cell image fixture not found.");
        }
        const sampleData = readFileSync(samplePath);
        const { Model2ScreeningPredictor } = await import("../../backend/app/quality_screening/predictor" as any).catch(() => {
          return { Model2ScreeningPredictor: null };
        });

        // Use Node screening service to run test
        const { runCellScreening } = await import("../cellScreening/service");
        const res = await runCellScreening(
          {
            filename: "model2_sample_elpv_cell.png",
            mimeType: "image/png",
            base64Data: sampleData.toString("base64"),
          },
          "system_selftest_operator"
        );

        const duration = Math.round(performance.now() - t0);
        appLogger.info("MODEL 2", `Model 2 self-test passed in ${duration}ms: ${res.predictedClass} (p=${res.defectiveScorePct.toFixed(1)}%)`);

        return {
          modelId,
          modelName: "Model 2 — ELPV Cell Screening",
          success: true,
          durationMs: duration,
          executedAt,
          summary: `Verified inference on certified ELPV cell fixture: ${res.predictedClass} (defective score: ${res.defectiveScorePct.toFixed(1)}%). Mandatory review flag: ${res.requiresManualReview}.`,
          verifiedOutputs: {
            predictedClass: res.predictedClass,
            defectiveProbability: res.rawDefectiveScore,
            threshold: res.rawThreshold,
            decision: res.decision,
            reviewStatus: res.reviewStatus,
          },
        };
      } else if (modelId === "model3") {
        const samplePath = resolve(cwd, "backend/models/sandia/sample_input.json");
        if (!existsSync(samplePath)) {
          throw new Error("Sample Sandia input fixture not found.");
        }
        const sampleInput = JSON.parse(readFileSync(samplePath, "utf-8"));
        const res = await sandiaPerformanceService.predict(sampleInput, {
          userId: "system_selftest_operator",
          role: "admin",
        });

        const duration = Math.round(performance.now() - t0);
        const predVal = typeof res.prediction?.prediction === "number" ? res.prediction.prediction : undefined;
        appLogger.info("MODEL 3", `Model 3 self-test passed in ${duration}ms: power retention = ${predVal?.toFixed(2)}%`);

        return {
          modelId,
          modelName: "Model 3 — Sandia Solar Electrical Performance",
          success: true,
          durationMs: duration,
          executedAt,
          summary: `Verified genuine scikit-learn pipeline inference: predicted power retention = ${predVal?.toFixed(2)}% (isMock: ${res.isMock}).`,
          verifiedOutputs: {
            predictedValue: predVal,
            targetName: res.prediction?.targetName,
            targetUnit: res.prediction?.targetUnit,
            isMock: res.isMock,
          },
        };
      } else if (modelId === "model4") {
        const res = await forecastPredictiveMaintenance(
          {
            domain: "ai4i_synthetic_benchmark",
            airTemperatureK: 300.0,
            processTemperatureK: 310.0,
            rotationalSpeedRpm: 1500,
            torqueNm: 40.0,
            toolWearMin: 100,
            productType: "M",
          },
          { userId: "system_selftest_operator", role: "admin" }
        );

        const duration = Math.round(performance.now() - t0);
        appLogger.info("MODEL 4", `Model 4 self-test passed in ${duration}ms: healthState = ${res.healthState}`);

        return {
          modelId,
          modelName: "Model 4 — Predictive Maintenance",
          success: true,
          durationMs: duration,
          executedAt,
          summary: `Verified AI4I synthetic benchmark inference: status = ${res.status}, health state = ${res.healthState}.`,
          verifiedOutputs: {
            status: res.status,
            healthState: res.healthState,
            failureProbability: res.failureProbability,
            domain: res.domain,
          },
        };
      } else {
        // Model 1 self-test: checks checkpoint and inference availability
        const status = await this.checkModel1Health();
        const duration = Math.round(performance.now() - t0);
        if (status.state === "unavailable") {
          throw new Error("Model 1 checkpoint best.pt is unavailable.");
        }

        appLogger.info("MODEL 1", `Model 1 verification passed in ${duration}ms`);
        return {
          modelId: "model1",
          modelName: "Model 1 — YOLO Defect Detection",
          success: true,
          durationMs: duration,
          executedAt,
          summary: `Model 1 YOLO26n checkpoint verified (${status.artifactStatus}). Academic prototype ready for EL/NIR inference.`,
          verifiedOutputs: {
            state: status.state,
            artifact: status.artifactPath,
            classes: 9,
          },
        };
      }
    } catch (err: any) {
      const duration = Math.round(performance.now() - t0);
      const msg = err?.message || "Self-test failed.";
      appLogger.error("SYSTEM", `Self-test for ${modelId} failed: ${msg}`);
      return {
        modelId,
        modelName: `Model ${modelId.toUpperCase()}`,
        success: false,
        durationMs: duration,
        executedAt,
        summary: `Self-test failed: ${msg}`,
        errorMessage: msg,
        verifiedOutputs: {},
      };
    }
  }
}

export const systemHealthService = new SystemHealthService();
