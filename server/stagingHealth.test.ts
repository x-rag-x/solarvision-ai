import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { checkStagingReadiness } from "./stagingHealth";
import { sandiaPerformanceService } from "./sandiaPerformance/service";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

describe("Staging Health & Readiness Verification (Requirement 1 & 3)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns minimal 200 Healthy when SQLite, storage, FastAPI, and genuine Sandia model are ready", async () => {
    process.env.REQUIRE_SANDIA_MODEL = "true";

    // Mock FastAPI /health 200 response
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { status: "ok", model_ready: true },
    } as any);

    // Mock Sandia service reporting ready and not mock
    vi.spyOn(sandiaPerformanceService, "getStatus").mockResolvedValueOnce({
      status: "ready",
      isReady: true,
      isMock: false,
      trainerHandoffPending: false,
      modelName: "SolarVision-Sandia-Performance-Model3",
      modelVersion: "1.0.0",
      contractVersion: "1.0.0",
      artifactName: "pipeline.joblib",
      featureSchemaLoaded: true,
      targetDefinitionLoaded: true,
      sampleInputLoaded: true,
      expectedDim: 9,
    });

    const { isHealthy, statusCode, response } = await checkStagingReadiness();

    expect(response.error).toBeUndefined();
    expect(isHealthy).toBe(true);
    expect(statusCode).toBe(200);
    expect(response.status).toBe("healthy");
    expect(response.components.node.status).toBe("ok");
    expect(response.components.database.status).toBe("ok");
    expect(response.components.storage.status).toBe("ok");
    expect(response.components.fastapi.status).toBe("ok");
    expect(response.components.sandia.status).toBe("ok");

    // Security check: strictly minimal, NO internal info leakage
    const responseJson = JSON.stringify(response);
    expect(responseJson).not.toMatch(/[a-zA-Z]:\\|\/app\/|\/data|solarvision\.db/);
    expect(responseJson).not.toContain("127.0.0.1");
    expect(responseJson).not.toContain("8000");
    expect(responseJson).not.toContain("http://");
    expect((response as any).uptimeSeconds).toBeUndefined();
    expect((response as any).environment).toBeUndefined();
    expect((response as any).timestamp).toBeUndefined();
  });

  it("fails staging deployment with HTTP 503 and generic error when FastAPI is unreachable", async () => {
    process.env.REQUIRE_SANDIA_MODEL = "true";

    mockedAxios.get.mockRejectedValueOnce(
      new Error("connect ECONNREFUSED 127.0.0.1:8000")
    );

    vi.spyOn(sandiaPerformanceService, "getStatus").mockRejectedValueOnce(
      new Error("Internal service unreachable")
    );

    const { isHealthy, statusCode, response, internalDiagnostics } = await checkStagingReadiness();

    expect(isHealthy).toBe(false);
    expect(statusCode).toBe(503);
    expect(response.status).toBe("unhealthy");
    expect(response.components.fastapi.status).toBe("error");

    // Public error message must be generic, NO URL leakage
    expect(response.error).toBe("One or more required runtime services are unavailable.");
    const responseJson = JSON.stringify(response);
    expect(responseJson).not.toContain("127.0.0.1");
    expect(responseJson).not.toContain("8000");
    expect(responseJson).not.toContain("ECONNREFUSED");

    // Internal diagnostics preserves server-side debugging details
    expect(internalDiagnostics.failures.some(f => f.includes("FastAPI"))).toBe(true);
  });

  it("fails staging deployment with HTTP 503 when Sandia model is unready / not loaded", async () => {
    process.env.REQUIRE_SANDIA_MODEL = "true";

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { status: "ok", model_ready: true },
    } as any);

    vi.spyOn(sandiaPerformanceService, "getStatus").mockResolvedValueOnce({
      status: "unready",
      isReady: false,
      isMock: false,
      trainerHandoffPending: true,
      modelName: "SolarVision-Sandia-Performance-Model3",
      modelVersion: "none",
      contractVersion: "1.0.0",
      artifactName: "pipeline.joblib",
      unavailabilityReason: "pipeline.joblib not found at /app/backend/models/sandia/pipeline.joblib",
      featureSchemaLoaded: true,
      targetDefinitionLoaded: true,
      sampleInputLoaded: true,
      expectedDim: 9,
    });

    const { isHealthy, statusCode, response, internalDiagnostics } = await checkStagingReadiness();

    expect(isHealthy).toBe(false);
    expect(statusCode).toBe(503);
    expect(response.status).toBe("unhealthy");
    expect(response.components.sandia.status).toBe("unready");
    expect(response.error).toBe("One or more required runtime services are unavailable.");

    // Verify no filesystem paths are leaked in the public response
    const responseJson = JSON.stringify(response);
    expect(responseJson).not.toContain("/app/backend/models/sandia");

    // Internal diagnostic retains detailed reason for server-side logs
    expect(internalDiagnostics.failures.some(f => f.includes("Sandia Model 3 is not ready"))).toBe(true);
  });

  it("fails staging deployment with HTTP 503 when Sandia model is mock in staging", async () => {
    process.env.REQUIRE_SANDIA_MODEL = "true";

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { status: "ok", model_ready: true },
    } as any);

    vi.spyOn(sandiaPerformanceService, "getStatus").mockResolvedValueOnce({
      status: "ready",
      isReady: true,
      isMock: true, // Mock predictor active instead of real model
      trainerHandoffPending: false,
      modelName: "SolarVision-Sandia-Performance-Model3",
      modelVersion: "mock-1.0.0",
      contractVersion: "1.0.0",
      artifactName: "pipeline.joblib",
      featureSchemaLoaded: true,
      targetDefinitionLoaded: true,
      sampleInputLoaded: true,
      expectedDim: 9,
    });

    const { isHealthy, statusCode, response } = await checkStagingReadiness();

    expect(isHealthy).toBe(false);
    expect(statusCode).toBe(503);
    expect(response.status).toBe("unhealthy");
    expect(response.components.sandia.status).toBe("unready");
    expect(response.error).toBe("One or more required runtime services are unavailable.");
  });
});
