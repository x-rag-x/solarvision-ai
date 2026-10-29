/**
 * SolarVision AI — Staging Health & Readiness Verification Endpoint
 *
 * Implements strict runtime component validation for Render staging deployment:
 * 1. Persistent SQLite database connectivity & query execution.
 * 2. Upload storage directory accessibility and writeability.
 * 3. Internal Python FastAPI inference service health (http://127.0.0.1:8000/health).
 * 4. Model 3 Sandia performance model genuine readiness (http://127.0.0.1:8000/sandia-performance/status).
 *
 * Fails deployment with HTTP 503 if any required component is unavailable.
 */

import type { Request, Response } from "express";
import axios from "axios";
import { existsSync, mkdirSync, accessSync, constants } from "node:fs";
import { getSqliteDb, getSqliteDbPath } from "./sqlite";
import { getUploadsDir } from "./storage";
import { sandiaPerformanceService } from "./sandiaPerformance/service";

export interface ComponentCheck {
  status: "ok" | "unready" | "error";
  details?: string;
  [key: string]: any;
}

export interface StagingHealthResponse {
  status: "healthy" | "unhealthy";
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  components: {
    node: ComponentCheck;
    database: ComponentCheck;
    storage: ComponentCheck;
    fastapi: ComponentCheck;
    sandia: ComponentCheck;
  };
  error?: string;
}

export async function checkStagingReadiness(): Promise<{
  isHealthy: boolean;
  statusCode: number;
  response: StagingHealthResponse;
}> {
  const timestamp = new Date().toISOString();
  const uptimeSeconds = Math.round(process.uptime());
  const environment = process.env.NODE_ENV || "development";

  const components: StagingHealthResponse["components"] = {
    node: { status: "ok" },
    database: { status: "error" },
    storage: { status: "error" },
    fastapi: { status: "error" },
    sandia: { status: "unready" },
  };

  const failures: string[] = [];

  // 1. Verify SQLite Database
  try {
    const db = getSqliteDb();
    // Execute a lightweight query to confirm database integrity
    const stmt = db.prepare("SELECT 1 as alive");
    const result = stmt.get() as { alive: number } | undefined;
    const dbPath = getSqliteDbPath();
    components.database = {
      status: "ok",
      path: dbPath,
      alive: result?.alive === 1,
    };
  } catch (err: any) {
    components.database = {
      status: "error",
      details: err?.message || "Failed to query SQLite database",
    };
    failures.push(`Database error: ${components.database.details}`);
  }

  // 2. Verify Storage & Uploads Directory
  try {
    const uploadsDir = getUploadsDir();
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }
    accessSync(uploadsDir, constants.R_OK | constants.W_OK);
    components.storage = {
      status: "ok",
      uploadsDir,
    };
  } catch (err: any) {
    components.storage = {
      status: "error",
      details: err?.message || "Storage directory not readable/writable",
    };
    failures.push(`Storage error: ${components.storage.details}`);
  }

  // 3. Verify Python FastAPI Internal Service
  const fastapiBaseUrl =
    process.env.SANDIA_API_URL ||
    process.env.PYTHON_BACKEND_URL ||
    process.env.FASTAPI_URL ||
    "http://127.0.0.1:8000";

  try {
    const fastapiResp = await axios.get(`${fastapiBaseUrl}/health`, {
      timeout: 4000,
      headers: { Accept: "application/json" },
    });

    if (fastapiResp.status === 200 && fastapiResp.data?.status === "ok") {
      components.fastapi = {
        status: "ok",
        url: fastapiBaseUrl,
        modelReady: Boolean(fastapiResp.data?.model_ready),
      };
    } else {
      components.fastapi = {
        status: "error",
        url: fastapiBaseUrl,
        details: `FastAPI /health returned unexpected status code ${fastapiResp.status}`,
      };
      failures.push(components.fastapi.details!);
    }
  } catch (err: any) {
    components.fastapi = {
      status: "error",
      url: fastapiBaseUrl,
      details: err?.message || "Failed to reach internal FastAPI service at 127.0.0.1:8000",
    };
    failures.push(`Python FastAPI service unavailable: ${components.fastapi.details}`);
  }

  // 4. Verify Sandia Performance Model 3 Genuine Readiness
  const requireSandia =
    process.env.REQUIRE_SANDIA_MODEL === undefined
      ? true // Default to strict in staging
      : process.env.REQUIRE_SANDIA_MODEL.toLowerCase() === "true" ||
        process.env.REQUIRE_SANDIA_MODEL === "1";

  try {
    const sandiaStatus = await sandiaPerformanceService.getStatus();
    const isGenuineReady = sandiaStatus.isReady && !sandiaStatus.isMock;

    components.sandia = {
      status: isGenuineReady ? "ok" : "unready",
      isReady: sandiaStatus.isReady,
      isMock: sandiaStatus.isMock,
      modelName: sandiaStatus.modelName,
      modelVersion: sandiaStatus.modelVersion,
      artifactName: sandiaStatus.artifactName,
      unavailabilityReason: sandiaStatus.unavailabilityReason || undefined,
    };

    if (requireSandia && !isGenuineReady) {
      failures.push(
        `Sandia Model 3 is not ready: ${sandiaStatus.unavailabilityReason || "genuine artifact not loaded"}`
      );
    }
  } catch (err: any) {
    components.sandia = {
      status: "error",
      details: err?.message || "Failed to query Sandia model status",
    };
    if (requireSandia) {
      failures.push(`Sandia Model 3 status check failed: ${components.sandia.details}`);
    }
  }

  const isHealthy = failures.length === 0;
  const statusCode = isHealthy ? 200 : 503;

  const response: StagingHealthResponse = {
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp,
    uptimeSeconds,
    environment,
    components,
    ...(failures.length > 0
      ? { error: `Required runtime component unavailable: ${failures.join("; ")}` }
      : {}),
  };

  return { isHealthy, statusCode, response };
}

/**
 * Express Route Handler for /healthz and /health
 */
export async function stagingHealthHandler(_req: Request, res: Response) {
  const { statusCode, response } = await checkStagingReadiness();
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  return res.status(statusCode).json(response);
}
