/**
 * SolarVision AI — System Health & Live Application Console
 * Unit & Integration Test Suite (Vitest)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { appLogger } from "./logger";
import { systemHealthService } from "./service";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { UNAUTHED_ERR_MSG } from "../../shared/const";

const testOperator: NonNullable<TrpcContext["user"]> = {
  id: 1,
  openId: "test-operator-health",
  name: "Health Test Operator",
  email: "health-test@solarvision.local",
  role: "admin",
  loginMethod: "manus",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createMockContext(user: TrpcContext["user"] = testOperator): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("System Health Telemetry & Database Monitoring", () => {
  it("successfully checks SQLite database connectivity with real SELECT 1 ping", async () => {
    const [sqliteHealth] = await systemHealthService.checkDatabaseHealth();

    expect(sqliteHealth.name).toContain("SQLite");
    expect(sqliteHealth.type).toBe("sqlite");
    expect(["connected", "degraded"]).toContain(sqliteHealth.state);
    expect(typeof sqliteHealth.pingLatencyMs).toBe("number");
    expect(sqliteHealth.pingLatencyMs).toBeGreaterThanOrEqual(0);
    expect(sqliteHealth.details?.tablesVerified).toBe(8);

    const tableNames = sqliteHealth.details?.tables?.map((t) => t.name) || [];
    expect(tableNames).toContain("inspections");
    expect(tableNames).toContain("cell_screening_predictions");
    expect(tableNames).toContain("sandia_performance_predictions");
    expect(tableNames).toContain("maintenance_predictions");
    expect(tableNames).toContain("root_cause_predictions");
  });

  it("reports Supabase as 'not_configured' when remote cloud credentials are unset", async () => {
    const [, supabaseHealth] = await systemHealthService.checkDatabaseHealth();
    expect(supabaseHealth.type).toBe("supabase");
    expect(supabaseHealth.state).toBe("not_configured");
    expect(supabaseHealth.pingLatencyMs).toBeNull();
  });

  it("generates a complete SystemHealthSummary without crashing or fabricating data", async () => {
    const summary = await systemHealthService.getSystemHealthOverview();

    expect(summary.totalMonitored).toBeGreaterThanOrEqual(5);
    expect(summary.databases.length).toBeGreaterThanOrEqual(2);
    expect(summary.models.model1).toBeDefined();
    expect(summary.models.model2).toBeDefined();
    expect(summary.models.model3).toBeDefined();
    expect(summary.models.model4).toBeDefined();
    expect(["healthy", "degraded", "unavailable"]).toContain(summary.overallStatus);
  });
});

describe("Multi-Model Health Checks & Verification Constraints", () => {
  it("verifies Model 1 (YOLO) checkpoint status and persistence availability", async () => {
    const m1 = await systemHealthService.checkModel1Health();

    expect(m1.modelId).toBe("solarvision_m1_yolo_pvelad_v1");
    expect(m1.shortName).toContain("YOLO");
    expect(m1.dbPersistenceAvailable).toBe(true);
    expect(m1.artifactPath).toContain("best.pt");
  });

  it("verifies Model 2 (ELPV) adheres strictly to screening-only and 0.55 threshold", async () => {
    const m2 = await systemHealthService.checkModel2Health();

    expect(m2.modelId).toBe("solarvision_m2_elpv_binary_v1");
    expect(m2.shortName).toContain("ELPV");
    expect(m2.capabilities.isScreeningOnly).toBe(true);
    expect(m2.capabilities.threshold).toBe(0.55);
    expect(m2.capabilities.canSelfTest).toBe(true);

    const limitationsText = m2.limitations.join(" ");
    expect(limitationsText).toContain("Mandatory operator review");
    expect(limitationsText).toContain("zero automatic PASS/REJECT");
  });

  it("verifies Model 3 (Sandia) checks SHA-256 hash and non-mock pipeline integrity", async () => {
    const m3 = await systemHealthService.checkModel3Health();

    expect(m3.modelId).toBe("model3_sandia_reference_power_v1");
    expect(m3.shortName).toContain("Sandia");
    expect(m3.artifactPath).toContain("pipeline.joblib");
    expect(m3.capabilities.isGenuineNonMock).toBe(true);
    expect(m3.capabilities.canSelfTest).toBe(true);
  });

  it("verifies Model 4 (Predictive Maintenance) reflects benchmark domain separation", async () => {
    const m4 = await systemHealthService.checkModel4Health();

    expect(m4.modelId).toBe("solarvision_m4_predictive_maintenance_v1");
    expect(m4.shortName).toContain("Maintenance");
    expect(m4.capabilities.isBenchmarkOnly).toBe(true);
    expect(m4.limitations.join(" ")).toContain("AI4I 2020 synthetic benchmark");
  });
});

describe("Live Application Console & In-Memory Log Buffer", () => {
  beforeEach(() => {
    appLogger.clear();
  });

  it("bounds in-memory log buffer to a strict maximum of 500 records", () => {
    for (let i = 0; i < 550; i++) {
      appLogger.info("SYSTEM", `Event sequence ${i}`);
    }

    expect(appLogger.size).toBe(500);
    const logs = appLogger.getLogs({ limit: 500 });
    expect(logs.length).toBe(500);
    expect(logs[logs.length - 1].message).toBe("Event sequence 549");
    expect(logs[0].message).toBe("Event sequence 50");
  });

  it("deeply sanitizes passwords, bearer tokens, cookies, and base64 payloads", () => {
    appLogger.info("AUTH", "User login attempt with password: SuperSecret123!");
    appLogger.info("API", "Request headers: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDvWS3i5yySX18g50VLQrzw5i9qxFsK08V00AJ8qc");
    appLogger.info("FASTAPI", "Session cookie: sid=s%3Axyz.abcdefgh12345678; Path=/; HttpOnly");
    appLogger.info("MODEL 2", "Inference received base64 data: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAA");

    const entries = appLogger.getLogs();
    const joined = entries.map((e) => e.message).join("\n");

    expect(joined).not.toContain("SuperSecret123!");
    expect(joined).toContain("password=[REDACTED]");

    expect(joined).not.toContain("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(joined).toContain("Bearer [REDACTED_JWT]");

    expect(joined).not.toContain("sid=s%3Axyz.abcdefgh12345678");
    expect(joined).toContain("sid=[REDACTED_COOKIE]");

    expect(joined).not.toContain("iVBORw0KGgoAAAANSUhEUgAAAGAAAABg");
    expect(joined).toContain("[BASE64_IMAGE_DATA]");
  });

  it("filters logs by level, service, and search query", () => {
    appLogger.info("MODEL 1", "Inference YOLO passed");
    appLogger.warn("MODEL 2", "Cell screening requires review");
    appLogger.error("DATABASE", "Connection timeout");
    appLogger.debug("SYSTEM", "Cache warmed");

    const warnOnly = appLogger.getLogs({ level: "WARN" });
    expect(warnOnly.length).toBe(1);
    expect(warnOnly[0].service).toBe("MODEL 2");

    const dbOnly = appLogger.getLogs({ service: "DATABASE" });
    expect(dbOnly.length).toBe(1);
    expect(dbOnly[0].level).toBe("ERROR");

    const searchYolo = appLogger.getLogs({ search: "yolo" });
    expect(searchYolo.length).toBe(1);
    expect(searchYolo[0].message).toContain("YOLO");
  });
});

describe("System Health tRPC Procedure Authorization & Self-Tests", () => {
  const caller = appRouter.createCaller(createMockContext(testOperator));
  const unauthCaller = appRouter.createCaller(createMockContext(null));

  it("allows unauthenticated callers to read public overview telemetry", async () => {
    const res = await unauthCaller.systemHealth.overview();
    expect(res.overallStatus).toBeDefined();
    expect(res.databases.length).toBeGreaterThanOrEqual(1);
  });

  it("allows unauthenticated callers to check individual model health status", async () => {
    const res = await unauthCaller.systemHealth.checkModel({ modelId: "model3" });
    expect(res.modelId).toBe("model3_sandia_reference_power_v1");
    expect(res.shortName).toContain("Sandia");
  });

  it("allows unauthenticated callers to read live sanitized diagnostic logs", async () => {
    const res = await unauthCaller.systemHealth.logs({ limit: 50 });
    expect(res.entries).toBeDefined();
    expect(res.totalBuffered).toBeGreaterThanOrEqual(1);
  });

  it("rejects unauthenticated callers on clearing server log buffer", async () => {
    await expect(unauthCaller.systemHealth.clearLogs()).rejects.toThrow(UNAUTHED_ERR_MSG);
  });

  it("rejects unauthenticated callers on executing self-test mutation", async () => {
    await expect(
      unauthCaller.systemHealth.selfTest({ modelId: "model3" })
    ).rejects.toThrow(UNAUTHED_ERR_MSG);
  });

  it("allows authenticated operator to query live diagnostic logs", async () => {
    appLogger.info("SYSTEM", "Operator access test event");
    const res = await caller.systemHealth.logs({ limit: 50 });
    expect(res.entries).toBeDefined();
    expect(res.totalBuffered).toBeGreaterThanOrEqual(1);
  });

  it("allows authenticated operator to execute Model 3 Sandia self-test", async () => {
    const res = await caller.systemHealth.selfTest({ modelId: "model3" });
    expect(res.modelId).toBe("model3");
    expect(res.success).toBe(true);
    expect(res.durationMs).toBeGreaterThan(0);
    expect(res.verifiedOutputs.isMock).toBe(false);
    expect(typeof res.verifiedOutputs.predictedValue).toBe("number");
  });

  it("allows authenticated operator to execute Model 2 ELPV self-test", async () => {
    const res = await caller.systemHealth.selfTest({ modelId: "model2" });
    expect(res.modelId).toBe("model2");
    expect(res.success).toBe(true);
    expect(res.verifiedOutputs.predictedClass).toBeDefined();
    expect(res.verifiedOutputs.decision).toBe("screening_only");
  });

  it("allows authenticated operator to execute Model 4 self-test", async () => {
    const res = await caller.systemHealth.selfTest({ modelId: "model4" });
    expect(res.modelId).toBe("model4");
    expect(res.success).toBe(true);
    expect(res.verifiedOutputs.domain).toBe("ai4i_synthetic_benchmark");
  });
});
