import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { UNAUTHED_ERR_MSG } from "../shared/const";

const testOperator: NonNullable<TrpcContext["user"]> = {
  id: 1,
  openId: "test-operator",
  name: "Test Operator",
  email: "test-operator@solarvision.local",
  role: "user",
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

describe("tRPC API Contract & Input Validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Explicitly inject authenticated fixture into test caller
  const caller = appRouter.createCaller(createMockContext(testOperator));
  const unauthCaller = appRouter.createCaller(createMockContext(null));

  // ==========================================================================
  // 0. Anonymous User Rejection on Protected Procedures (Requirement 2)
  // ==========================================================================
  describe("Authentication Gate Enforcement", () => {
    it("rejects anonymous callers on dashboard.stats", async () => {
      await expect(unauthCaller.dashboard.stats()).rejects.toThrow(UNAUTHED_ERR_MSG);
    });

    it("rejects anonymous callers on analytics.defects", async () => {
      await expect(unauthCaller.analytics.defects()).rejects.toThrow(UNAUTHED_ERR_MSG);
    });

    it("rejects anonymous callers on inspection.history", async () => {
      await expect(unauthCaller.inspection.history()).rejects.toThrow(UNAUTHED_ERR_MSG);
    });

    it("rejects anonymous callers on inspection.detail", async () => {
      await expect(
        unauthCaller.inspection.detail({ inspectionId: "00000000-0000-0000-0000-000000000000" })
      ).rejects.toThrow(UNAUTHED_ERR_MSG);
    });

    it("rejects anonymous callers on inspection.run", async () => {
      await expect(
        unauthCaller.inspection.run({
          filename: "test.jpg",
          mimeType: "image/jpeg",
          base64Data: "a".repeat(150),
        })
      ).rejects.toThrow(UNAUTHED_ERR_MSG);
    });

    it("rejects anonymous callers on sandiaPerformance.predict", async () => {
      await expect(
        unauthCaller.sandiaPerformance.predict({
          features: { Effective_Irradiance: 1000 },
        })
      ).rejects.toThrow(UNAUTHED_ERR_MSG);
    });

    it("rejects anonymous callers on sandiaPerformance.predictBatch", async () => {
      await expect(
        unauthCaller.sandiaPerformance.predictBatch({
          items: [{ features: { Effective_Irradiance: 1000 } }],
        })
      ).rejects.toThrow(UNAUTHED_ERR_MSG);
    });

    it("rejects anonymous callers on sandiaPerformance.history", async () => {
      await expect(unauthCaller.sandiaPerformance.history({})).rejects.toThrow(UNAUTHED_ERR_MSG);
    });

    it("rejects anonymous callers on sandiaPerformance.detail", async () => {
      await expect(
        unauthCaller.sandiaPerformance.detail({ id: "non-existent-id" })
      ).rejects.toThrow(UNAUTHED_ERR_MSG);
    });
  });

  // ==========================================================================
  // 1. Standalone Operator Mode Access Control (Requirement 2)
  // ==========================================================================
  describe("Standalone Operator Mode Access Control", () => {
    it("reports passcodeRequired=true when OPERATOR_PASSCODE is set", async () => {
      process.env.OPERATOR_PASSCODE = "staging-secret-passcode-99";
      const config = await unauthCaller.auth.config();
      expect(config.passcodeRequired).toBe(true);
    });

    it("reports passcodeRequired=false when no operator passcode is set", async () => {
      delete process.env.OPERATOR_PASSCODE;
      delete process.env.STAGING_OPERATOR_ACCESS_CODE;
      delete process.env.OPERATOR_ACCESS_CODE;
      const config = await unauthCaller.auth.config();
      expect(config.passcodeRequired).toBe(false);
    });

    it("rejects login attempt when OPERATOR_PASSCODE is set but no passcode provided", async () => {
      process.env.OPERATOR_PASSCODE = "staging-secret-passcode-99";
      await expect(
        unauthCaller.auth.login({
          operatorId: "anonymous-visitor",
          name: "Attacker",
          role: "admin",
        })
      ).rejects.toThrow("Invalid or missing operator passcode");
    });

    it("rejects login attempt when OPERATOR_PASSCODE is set and wrong passcode provided", async () => {
      process.env.OPERATOR_PASSCODE = "staging-secret-passcode-99";
      await expect(
        unauthCaller.auth.login({
          operatorId: "anonymous-visitor",
          name: "Attacker",
          role: "admin",
          passcode: "incorrect-passcode",
        })
      ).rejects.toThrow("Invalid or missing operator passcode");
    });

    it("allows login and returns token when OPERATOR_PASSCODE is set and correct passcode provided", async () => {
      process.env.OPERATOR_PASSCODE = "staging-secret-passcode-99";
      const result = await unauthCaller.auth.login({
        operatorId: "verified-operator",
        name: "Verified Operator",
        role: "user",
        passcode: "staging-secret-passcode-99",
      });

      expect(result.success).toBe(true);
      expect(typeof result.token).toBe("string");
      expect(result.user?.openId).toBe("verified-operator");
    });
  });

  // ==========================================================================
  // 2. Model Status Contract
  // ==========================================================================
  it("model.status conforms to client contract and does not leak full paths", async () => {
    const status = await caller.model.status();
    expect(typeof status.status).toBe("string");
    expect(typeof status.modelPath).toBe("string");
    expect(status.modelPath).toBe("best.pt"); // Sanitized to basename
    expect(typeof status.exists).toBe("boolean");
    expect(status.modelName).toBe("YOLO26n");
    expect(Array.isArray(status.classNames)).toBe(true);
    expect(typeof status.independentMetricsStatus).toBe("string");
    expect(typeof status.supabaseConfigured).toBe("boolean");
  });

  // ==========================================================================
  // 3. Dashboard Stats Contract
  // ==========================================================================
  it("dashboard.stats conforms to contract shape", async () => {
    const stats = await caller.dashboard.stats();
    expect(stats.configured).toBe(true);
    expect(typeof stats.inspections).toBe("number");
    expect(typeof stats.detections).toBe("number");
    expect(
      stats.avgProcessingTimeMs === null || typeof stats.avgProcessingTimeMs === "number"
    ).toBe(true);
    expect(typeof stats.defectTypes).toBe("number");
  });

  // ==========================================================================
  // 4. Analytics Defects Contract
  // ==========================================================================
  it("analytics.defects conforms to contract shape", async () => {
    const analytics = await caller.analytics.defects();
    expect(analytics.configured).toBe(true);
    expect(Array.isArray(analytics.byType)).toBe(true);
    expect(Array.isArray(analytics.recentTrend)).toBe(true);

    if (analytics.byType.length > 0) {
      const first = analytics.byType[0];
      expect(typeof first.defectType).toBe("string");
      expect(typeof first.count).toBe("number");
      expect(typeof first.avgConfidence).toBe("number");
    }

    if (analytics.recentTrend.length > 0) {
      const first = analytics.recentTrend[0];
      expect(typeof first.day).toBe("string");
      expect(typeof first.inspections).toBe("number");
      expect(typeof first.detections).toBe("number");
    }
  });

  // ==========================================================================
  // 5. Inspection Detail Validation & Contract
  // ==========================================================================
  it("inspection.detail rejects invalid non-UUID identifier", async () => {
    await expect(
      caller.inspection.detail({ inspectionId: "invalid-uuid-format" })
    ).rejects.toThrow();

    await expect(
      caller.inspection.detail({ inspectionId: "123" })
    ).rejects.toThrow();
  });

  it("inspection.detail returns null for valid non-existent UUID", async () => {
    const result = await caller.inspection.detail({
      inspectionId: "00000000-0000-0000-0000-000000000000",
    });
    expect(result).toBeNull();
  });

  // ==========================================================================
  // 6. Inspection History Validation & Contract
  // ==========================================================================
  it("inspection.history respects limit bounds and defaults to 25", async () => {
    const historyDefault = await caller.inspection.history();
    expect(Array.isArray(historyDefault)).toBe(true);

    const historyLimited = await caller.inspection.history({ limit: 5 });
    expect(Array.isArray(historyLimited)).toBe(true);
    expect(historyLimited.length).toBeLessThanOrEqual(5);

    // Rejects limit < 1
    await expect(caller.inspection.history({ limit: 0 })).rejects.toThrow();

    // Rejects limit > 100
    await expect(caller.inspection.history({ limit: 101 })).rejects.toThrow();
  });

  // ==========================================================================
  // 7. Inspection Run Input Validation
  // ==========================================================================
  it("inspection.run rejects empty filename", async () => {
    await expect(
      caller.inspection.run({
        filename: "",
        mimeType: "image/jpeg",
        base64Data: "a".repeat(150),
      })
    ).rejects.toThrow();
  });

  it("inspection.run rejects non-image mimeType", async () => {
    await expect(
      caller.inspection.run({
        filename: "malicious.sh",
        mimeType: "application/x-sh",
        base64Data: "a".repeat(150),
      })
    ).rejects.toThrow();

    await expect(
      caller.inspection.run({
        filename: "test.pdf",
        mimeType: "application/pdf",
        base64Data: "a".repeat(150),
      })
    ).rejects.toThrow();
  });

  it("inspection.run rejects payload below 100 characters", async () => {
    await expect(
      caller.inspection.run({
        filename: "tiny.jpg",
        mimeType: "image/jpeg",
        base64Data: "dG9vX3Nob3J0",
      })
    ).rejects.toThrow();
  });

  // ==========================================================================
  // 8. Auth Procedures Contract
  // ==========================================================================
  it("auth.me returns null for anonymous caller and user for authenticated caller", async () => {
    const anonCaller = appRouter.createCaller(createMockContext(null));
    expect(await anonCaller.auth.me()).toBeNull();

    const mockUser = {
      id: 99,
      openId: "tester-user",
      email: "tester@solarvision.local",
      name: "QA Tester",
      loginMethod: "manus",
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const authCaller = appRouter.createCaller(createMockContext(mockUser));
    const me = await authCaller.auth.me();
    expect(me).toEqual(mockUser);
  });
});
