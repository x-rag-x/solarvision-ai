/**
 * SolarVision AI — Task 1 & Task 2: Sandia-First Dashboard & Navigation Integrity Tests
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Task 1 & Task 2: Sandia-First Dashboard & Navigation Integrity", () => {
  const cwd = process.cwd();

  it("verifies PredictiveQualityOverview renders Sandia Solar Electrical Performance as default first view", () => {
    const file = readFileSync(
      resolve(cwd, "client/src/features/predictiveQuality/PredictiveQualityOverview.tsx"),
      "utf-8"
    );

    // Initial state must be "sandia_performance"
    expect(file).toContain('useState<Model3Mode>("sandia_performance")');

    // First button rendered must be Sandia
    const sandiaIndex = file.indexOf("Sandia Solar Electrical Performance");
    const secomIndex = file.indexOf("UCI SECOM Process Benchmark");

    expect(sandiaIndex).toBeGreaterThan(0);
    expect(secomIndex).toBeGreaterThan(0);
    expect(sandiaIndex).toBeLessThan(secomIndex);

    // Badges must correctly identify Sandia as Primary and SECOM as Secondary
    expect(file).toContain("Primary Model 3");
    expect(file).toContain("Secondary Benchmark");
  });

  it("verifies DashboardLayout places 'System health' immediately above 'Settings'", () => {
    const layoutFile = readFileSync(
      resolve(cwd, "client/src/components/DashboardLayout.tsx"),
      "utf-8"
    );

    // Locate menuItems array
    expect(layoutFile).toContain('{ icon: HeartPulse, label: "System health", path: "/system-health" }');

    const modelPerfIndex = layoutFile.indexOf('path: "/model"');
    const systemHealthIndex = layoutFile.indexOf('path: "/system-health"');
    const settingsIndex = layoutFile.indexOf('path: "/settings"');

    expect(modelPerfIndex).toBeGreaterThan(0);
    expect(systemHealthIndex).toBeGreaterThan(modelPerfIndex);
    expect(settingsIndex).toBeGreaterThan(systemHealthIndex);
  });

  it("verifies App.tsx mounts the /system-health route", () => {
    const appFile = readFileSync(resolve(cwd, "client/src/App.tsx"), "utf-8");
    expect(appFile).toContain('import SystemHealth from "./pages/SystemHealth";');
    expect(appFile).toContain('<Route path="/system-health" component={SystemHealth} />');
  });
});

