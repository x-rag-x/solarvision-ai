import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { checkStagingReadiness } from "./stagingHealth";
import { sandiaPerformanceService } from "./sandiaPerformance/service";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

describe("Render Staging Lifecycle & Slow Readiness Suite (Tasks 2, 5, 6, 9)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("handles slow FastAPI startup: returns HTTP 503 while Node is open but FastAPI is booting", async () => {
    process.env.REQUIRE_SANDIA_MODEL = "true";

    // Simulate FastAPI connection refused during slow startup / container initialization
    mockedAxios.get.mockRejectedValueOnce(
      new Error("connect ECONNREFUSED 127.0.0.1:8000")
    );
    vi.spyOn(sandiaPerformanceService, "getStatus").mockRejectedValueOnce(
      new Error("connect ECONNREFUSED 127.0.0.1:8000")
    );

    const { isHealthy, statusCode, response, internalDiagnostics } = await checkStagingReadiness();

    // Node is up, but full readiness gate holds back deployment (HTTP 503)
    expect(isHealthy).toBe(false);
    expect(statusCode).toBe(503);
    expect(response.status).toBe("unhealthy");
    expect(response.components.node.status).toBe("ok");
    expect(response.components.database.status).toBe("ok");
    expect(response.components.storage.status).toBe("ok");
    expect(response.components.fastapi.status).toBe("error");
    expect(response.components.sandia.status).toBe("error");

    // Public response must never leak internal ports or loopback addresses
    const jsonStr = JSON.stringify(response);
    expect(jsonStr).not.toContain("127.0.0.1");
    expect(jsonStr).not.toContain("8000");
    expect(jsonStr).not.toContain("ECONNREFUSED");
    expect(response.error).toBe("One or more required runtime services are unavailable.");

    // Server-side internal diagnostics retains error detail for operator logging
    expect(internalDiagnostics.failures.some(f => f.includes("FastAPI"))).toBe(true);
  });

  it("transitions smoothly to HTTP 200 once slow FastAPI and genuine Sandia pipeline complete startup", async () => {
    process.env.REQUIRE_SANDIA_MODEL = "true";

    // Simulate FastAPI ready response after initialization window
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { status: "ok", model_exists: true, model_ready: true },
    } as any);

    // Simulate genuine Sandia model status
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

    expect(isHealthy).toBe(true);
    expect(statusCode).toBe(200);
    expect(response.status).toBe("healthy");
    expect(response.components.fastapi.status).toBe("ok");
    expect(response.components.sandia.status).toBe("ok");
    expect(response.error).toBeUndefined();
  });

  it("fails startup readiness with HTTP 503 if FastAPI returns 500 Internal Error during boot", async () => {
    process.env.REQUIRE_SANDIA_MODEL = "true";

    mockedAxios.get.mockResolvedValueOnce({
      status: 500,
      data: { status: "error", detail: "CUDA/PyTorch allocation failed" },
    } as any);

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

    const { isHealthy, statusCode, response, internalDiagnostics } = await checkStagingReadiness();

    expect(isHealthy).toBe(false);
    expect(statusCode).toBe(503);
    expect(response.components.fastapi.status).toBe("error");
    expect(internalDiagnostics.failures.some(f => f.includes("FastAPI health check returned status code 500"))).toBe(true);
  });

  it("fails startup readiness with HTTP 503 if Sandia Model 3 is unready or mock in strict staging mode", async () => {
    process.env.REQUIRE_SANDIA_MODEL = "true";

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { status: "ok", model_ready: true },
    } as any);

    // Sandia loaded in mock mode
    vi.spyOn(sandiaPerformanceService, "getStatus").mockResolvedValueOnce({
      status: "ready",
      isReady: true,
      isMock: true,
      unavailabilityReason: "Synthetic predictor active; genuine checkpoint missing",
      trainerHandoffPending: true,
      modelName: "SolarVision-Sandia-Performance-Model3",
      modelVersion: "1.0.0",
      contractVersion: "1.0.0",
      artifactName: "pipeline.joblib",
      featureSchemaLoaded: true,
      targetDefinitionLoaded: true,
      sampleInputLoaded: true,
      expectedDim: 9,
    });

    const { isHealthy, statusCode, response, internalDiagnostics } = await checkStagingReadiness();

    expect(isHealthy).toBe(false);
    expect(statusCode).toBe(503);
    expect(response.components.sandia.status).toBe("unready");
    expect(internalDiagnostics.failures.some(f => f.includes("Sandia Model 3 is not ready"))).toBe(true);
  });

  it("strictly preserves operator secret and passcode protection without leakage in healthcheck", async () => {
    process.env.JWT_SECRET = "super-secret-jwt-key-minimum-32-characters-long!";
    process.env.OPERATOR_PASSCODE = "super-secure-passcode-for-staging-12345!";

    mockedAxios.get.mockRejectedValueOnce(new Error("FastAPI timeout"));
    vi.spyOn(sandiaPerformanceService, "getStatus").mockRejectedValueOnce(new Error("Sandia timeout"));

    const { response } = await checkStagingReadiness();
    const jsonStr = JSON.stringify(response);

    expect(jsonStr).not.toContain("super-secret-jwt-key");
    expect(jsonStr).not.toContain("super-secure-passcode");
    expect(jsonStr).not.toContain(process.env.JWT_SECRET);
    expect(jsonStr).not.toContain(process.env.OPERATOR_PASSCODE);
  });

  it("remains responsive and returns HTTP 200 while FastAPI handles concurrent or slow inference", async () => {
    process.env.REQUIRE_SANDIA_MODEL = "true";

    // FastAPI /health responds normally without being blocked by threadpool YOLO inference
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { status: "ok", model_exists: true, model_ready: true },
    } as any);

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

    const t0 = performance.now();
    const { isHealthy, statusCode, response } = await checkStagingReadiness();
    const elapsed = performance.now() - t0;

    expect(isHealthy).toBe(true);
    expect(statusCode).toBe(200);
    expect(response.status).toBe("healthy");
    expect(response.components.fastapi.status).toBe("ok");
    expect(response.components.sandia.status).toBe("ok");
    expect(elapsed).toBeLessThan(1000); // Confirms check executes smoothly without blocking
  });
});
