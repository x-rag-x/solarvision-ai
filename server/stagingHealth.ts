/**
 * SolarVision AI — Staging Health & Readiness Verification Endpoint
 *
 * Implements strict runtime component validation for Render staging deployment:
 * 1. Persistent SQLite database connectivity & query execution.
 * 2. Upload storage directory accessibility and writeability.
 * 3. Internal Python FastAPI inference service health (http://127.0.0.1:8000/health).
 * 4. Model 3 Sandia performance model genuine readiness (http://127.0.0.1:8000/sandia-performance/status).
 *
 * Security Policy:
 * - Public responses are strictly minimal: only overall status and generic component readiness.
 * - Filesystem paths, internal URLs, secrets, and environment details are NEVER exposed in responses.
 * - Diagnostic details and stack traces are logged exclusively to server stderr/stdout.
 * - Returns HTTP 200 when all required components are ready; HTTP 503 on any failure.
 */

import type { Request, Response } from "express";
import axios from "axios";
import { existsSync, mkdirSync, accessSync, constants } from "node:fs";
import { getSqliteDb } from "./sqlite";
import { getUploadsDir } from "./storage";
import { sandiaPerformanceService } from "./sandiaPerformance/service";

export type ComponentState = "ok" | "unready" | "error";

export interface GenericComponentStatus {
  status: ComponentState;
}

export interface StagingHealthResponse {
  status: "healthy" | "unhealthy";
  components: {
    node: GenericComponentStatus;
    database: GenericComponentStatus;
    storage: GenericComponentStatus;
    fastapi: GenericComponentStatus;
    sandia: GenericComponentStatus;
  };
  error?: string;
}

export async function checkStagingReadiness(): Promise<{
  isHealthy: boolean;
  statusCode: number;
  response: StagingHealthResponse;
  internalDiagnostics: {
    failures: string[];
    [key: string]: any;
  };
}> {
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
    const stmt = db.prepare("SELECT 1 as alive");
    const result = stmt.get() as { alive: number } | undefined;
    if (result?.alive === 1) {
      components.database = { status: "ok" };
    } else {
      components.database = { status: "error" };
      failures.push("SQLite query did not return alive=1");
    }
  } catch (err: any) {
    components.database = { status: "error" };
    failures.push(`Database error: ${err?.message || "Failed to query SQLite database"}`);
  }

  // 2. Verify Storage & Uploads Directory
  try {
    const uploadsDir = getUploadsDir();
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }
    accessSync(uploadsDir, constants.R_OK | constants.W_OK);
    components.storage = { status: "ok" };
  } catch (err: any) {
    components.storage = { status: "error" };
    failures.push(`Storage directory error: ${err?.message || "Directory not accessible"}`);
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
      components.fastapi = { status: "ok" };
    } else {
      components.fastapi = { status: "error" };
      failures.push(`FastAPI health check returned status code ${fastapiResp.status}`);
    }
  } catch (err: any) {
    components.fastapi = { status: "error" };
    failures.push(`FastAPI connection failed: ${err?.message || "Internal service unreachable"}`);
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

    if (isGenuineReady) {
      components.sandia = { status: "ok" };
    } else {
      components.sandia = { status: "unready" };
      if (requireSandia) {
        failures.push(
          `Sandia Model 3 is not ready: ${sandiaStatus.unavailabilityReason || "genuine artifact not loaded"}`
        );
      }
    }
  } catch (err: any) {
    components.sandia = { status: "error" };
    if (requireSandia) {
      failures.push(`Sandia Model 3 status check failed: ${err?.message || "status query error"}`);
    }
  }

  const isHealthy = failures.length === 0;
  const statusCode = isHealthy ? 200 : 503;

  if (!isHealthy) {
    console.error(
      `[StagingHealth] Health check failed (${statusCode}): ${failures.join("; ")}`
    );
  }

  // Minimal public response: strictly overall status and generic component readiness
  const response: StagingHealthResponse = {
    status: isHealthy ? "healthy" : "unhealthy",
    components,
    ...(failures.length > 0
      ? { error: "One or more required runtime services are unavailable." }
      : {}),
  };

  return {
    isHealthy,
    statusCode,
    response,
    internalDiagnostics: { failures },
  };
}

/**
 * Express Route Handler for /healthz, /health, and /api/health
 */
export async function stagingHealthHandler(_req: Request, res: Response) {
  const { statusCode, response } = await checkStagingReadiness();
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  return res.status(statusCode).json(response);
}
