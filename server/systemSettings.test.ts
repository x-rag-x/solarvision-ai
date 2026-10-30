import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import {
  getSqliteDb,
  getSystemSetting,
  setSystemSetting,
  isRootCauseEnabled,
  setRootCauseEnabled,
} from "./sqlite";
import type { TrpcContext } from "./_core/context";

function createMockContext(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

const adminUser: NonNullable<TrpcContext["user"]> = {
  id: 1,
  openId: "admin-tester",
  name: "Admin Tester",
  email: "admin@solarvision.local",
  role: "admin",
  loginMethod: "operator-credential",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const regularOperator: NonNullable<TrpcContext["user"]> = {
  id: 2,
  openId: "operator-tester",
  name: "Operator Tester",
  email: "operator@solarvision.local",
  role: "user",
  loginMethod: "operator-credential",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("System Settings & Root Cause Module Visibility (Task 2)", () => {
  beforeEach(() => {
    // Reset setting before each test
    const db = getSqliteDb();
    db.prepare("DELETE FROM system_settings WHERE key = 'enable_root_cause'").run();
  });

  it("defaults enable_root_cause to false on a clean configuration", () => {
    expect(getSystemSetting("enable_root_cause")).toBeNull();
    expect(isRootCauseEnabled()).toBe(false);
  });

  it("persists enable_root_cause to SQLite and retrieves updated boolean status", () => {
    setRootCauseEnabled(true);
    expect(getSystemSetting("enable_root_cause")).toBe("true");
    expect(isRootCauseEnabled()).toBe(true);

    setRootCauseEnabled(false);
    expect(getSystemSetting("enable_root_cause")).toBe("false");
    expect(isRootCauseEnabled()).toBe(false);
  });

  it("exposes public tRPC system.getSettings with enableRootCause boolean", async () => {
    const unauthedCaller = appRouter.createCaller(createMockContext(null));
    const initial = await unauthedCaller.system.getSettings();
    expect(initial).toEqual({ enableRootCause: false });

    setRootCauseEnabled(true);
    const updated = await unauthedCaller.system.getSettings();
    expect(updated).toEqual({ enableRootCause: true });
  });

  it("denies unauthenticated callers from modifying system settings", async () => {
    const unauthedCaller = appRouter.createCaller(createMockContext(null));
    await expect(
      unauthedCaller.system.updateSettings({ enableRootCause: true })
    ).rejects.toThrow();
  });

  it("denies non-admin operators from modifying system settings with FORBIDDEN", async () => {
    const operatorCaller = appRouter.createCaller(createMockContext(regularOperator));
    await expect(
      operatorCaller.system.updateSettings({ enableRootCause: true })
    ).rejects.toThrow(/You do not have required permission/i);
  });

  it("allows authorized administrators to toggle enableRootCause setting", async () => {
    const adminCaller = appRouter.createCaller(createMockContext(adminUser));
    const result = await adminCaller.system.updateSettings({ enableRootCause: true });
    expect(result).toEqual({ success: true, enableRootCause: true });
    expect(isRootCauseEnabled()).toBe(true);

    const toggleOff = await adminCaller.system.updateSettings({ enableRootCause: false });
    expect(toggleOff).toEqual({ success: true, enableRootCause: false });
    expect(isRootCauseEnabled()).toBe(false);
  });

  it("enforces feature availability server-side: blocks rootCause.analyze when disabled", async () => {
    setRootCauseEnabled(false);
    const operatorCaller = appRouter.createCaller(createMockContext(regularOperator));

    await expect(
      operatorCaller.rootCause.analyze({
        inspectionId: "00000000-0000-0000-0000-000000000000",
        defects: [],
      })
    ).rejects.toThrow(/Root Cause Analysis is currently disabled in system settings/i);
  });
});
