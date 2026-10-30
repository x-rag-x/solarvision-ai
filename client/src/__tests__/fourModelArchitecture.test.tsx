/**
 * SolarVision AI — Four-Model Architecture & Root Cause Visibility Tests
 *
 * Verifies:
 * 1. Home dashboard correctly displays the verified four models:
 *    - Model 1: AI-Based Solar Cell Defect Detection (YOLO / PyTorch, PVELAD, Academic Prototype, Run Inspection -> /inspection)
 *    - Model 2: AI-Based Solar Cell Defectiveness Screening (EfficientNet-B0 / PyTorch, ELPV, 69.81% Acc, 68.67% Rec, 45.97% Prec, 55.07% F1, 0.55 cutoff, Cell Screening -> /cell-screening)
 *    - Model 3: Sandia Solar Electrical Performance Prediction (scikit-learn, Sandia research, power_retention_pct, MAE 0.793 pp, RMSE 1.107 pp, R² 0.581, Predict Performance -> /predictive-quality)
 *    - Model 4: AI-Based Equipment Predictive Maintenance (AI4I 2020, TWF/HDF/PWF/OSF/RNF, Acc 96.67%, AUC 0.931, Maintenance Center -> /predictive-maintenance)
 * 2. Complete removal of outdated Model 2 Root-Cause / DATASET_BLOCKED descriptions from Home cards and Stage 02.
 * 3. Settings page has "Optional / Experimental Modules" section and "Enable Root Cause Analysis" with the exact required copy.
 * 4. DashboardLayout dynamically includes or excludes Root cause analysis based on enableRootCause setting.
 */

import * as React from "react";
(globalThis as any).React = React;
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Ensure global location exists in node test environment
if (typeof globalThis.location === "undefined") {
  (globalThis as any).location = {
    pathname: "/",
    search: "",
    hash: "",
    href: "http://localhost/",
  };
}

// Mock wouter hooks for SSR rendering
vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock TRPC hooks
let mockEnableRootCause = false;

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      dashboard: { stats: { invalidate: vi.fn() } },
    }),
    system: {
      getSettings: {
        useQuery: () => ({
          data: { enableRootCause: mockEnableRootCause },
          refetch: vi.fn(),
          isLoading: false,
        }),
      },
      updateSettings: {
        useMutation: () => ({
          mutateAsync: vi.fn(),
          isPending: false,
        }),
      },
    },
    dashboard: {
      stats: {
        useQuery: () => ({
          data: { configured: true, totalInspections: 10, totalDetections: 5 },
          isLoading: false,
        }),
      },
    },
    inspection: {
      history: {
        useQuery: () => ({
          data: [],
          isLoading: false,
        }),
      },
    },
    model: {
      status: {
        useQuery: () => ({
          data: { exists: true, modelPath: "best.pt", error: null },
        }),
      },
    },
    model2Elpv: {
      status: {
        useQuery: () => ({
          data: { status: "ready", modelId: "solarvision_m2_elpv_binary_v1" },
        }),
      },
    },
    sandiaPerformance: {
      status: {
        useQuery: () => ({
          data: { status: "ready", manifestVerified: true },
        }),
      },
    },
    predictiveQuality: {
      status: {
        useQuery: () => ({
          data: { status: "ready" },
        }),
      },
    },
    predictiveMaintenance: {
      status: {
        useQuery: () => ({
          data: { status: "ready" },
        }),
      },
    },
    auth: {
      me: {
        useQuery: () => ({
          data: { id: 1, role: "admin", name: "Marcus (Admin)" },
        }),
      },
    },
  },
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: 1, role: "admin", name: "Marcus (Admin)" },
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

import Home from "../pages/Home";
import Settings from "../pages/Settings";
import DashboardLayout from "../components/DashboardLayout";

describe("Four-Model Operational Architecture on Overview Dashboard", () => {
  it("renders genuine Model 1 Visual Defect Detection card with YOLO and PVELAD validation", () => {
    const html = renderToString(<Home />);

    expect(html).toContain("AI-Based Solar Cell Defect Detection");
    expect(html).toContain("YOLO / PyTorch");
    expect(html).toContain("best.pt verified");
    expect(html).toContain("PVELAD (91.87% mAP@50)");
    expect(html).toContain("Solar Cell EL/NIR");
    expect(html).toContain("Academic Prototype");
    expect(html).toContain("Run Inspection");
    expect(html).toContain('href="/inspection"');
  });

  it("renders genuine Model 2 Solar Cell Defectiveness Screening card with ELPV metrics", () => {
    const html = renderToString(<Home />);

    expect(html).toContain("AI-Based Solar Cell Defectiveness Screening");
    expect(html).toContain("EfficientNet-B0 / PyTorch");
    expect(html).toContain("ELPV (2,624 images)");
    expect(html).toContain("69.81% / 68.67%");
    expect(html).toContain("45.97% / 55.07% (τ=0.55)");
    expect(html).toContain("Cell Screening");
    expect(html).toContain('href="/cell-screening"');

    // Confirms removal of outdated root cause / blocked telemetry references from Model 2 card
    expect(html).not.toContain("DATASET_BLOCKED");
    expect(html).not.toContain("Training Blocked");
    expect(html).not.toContain("Missing Factory Telemetry");
  });

  it("renders genuine Model 3 Sandia Solar Electrical Performance card", () => {
    const html = renderToString(<Home />);

    expect(html).toContain("Sandia Solar Electrical Performance Prediction");
    expect(html).toContain("scikit-learn Pipeline");
    expect(html).toContain("Sandia PV Research");
    expect(html).toContain("power_retention_pct");
    expect(html).toContain("0.793 pp / 1.107 pp / 0.581");
    expect(html).toContain("Predict Performance");
    expect(html).toContain('href="/predictive-quality"');
  });

  it("renders genuine Model 4 Equipment Predictive Maintenance card with failure modes", () => {
    const html = renderToString(<Home />);

    expect(html).toContain("AI-Based Equipment Predictive Maintenance");
    expect(html).toContain("AI4I 2020 Pipeline");
    expect(html).toContain("TWF, HDF, PWF, OSF, RNF");
    expect(html).toContain("Acc 96.67% · AUC 0.931");
    expect(html).toContain("Maintenance Center");
    expect(html).toContain('href="/predictive-maintenance"');
  });

  it("includes M2 Cell Screening in the 6-step demonstration guide instead of Root Cause", () => {
    const html = renderToString(<Home />);

    expect(html).toContain("M2 Cell Screening");
    expect(html).toContain('href="/cell-screening"');
    expect(html).toContain("M3 Sandia Performance");
  });
});

describe("Settings Page — Optional / Experimental Modules", () => {
  it("renders the Optional / Experimental Modules section with exact specification", () => {
    const html = renderToString(<Settings />);

    expect(html).toContain("Optional / Experimental Modules");
    expect(html).toContain("Enable Root Cause Analysis");
    expect(html).toContain(
      "Show the experimental manufacturing root-cause analysis module in SolarVision. This feature is not trained on a verified, linked factory root-cause dataset and should not be treated as production-grade causal diagnosis."
    );
    expect(html).toContain("Data Preservation Guarantee");
  });
});

describe("DashboardLayout Sidebar Navigation — Root Cause Visibility Invariant", () => {
  it("omits Root cause analysis from the sidebar navigation by default when disabled", () => {
    mockEnableRootCause = false;
    const html = renderToString(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    expect(html).not.toContain("Root cause analysis");
    expect(html).toContain("Cell screening (Model 2)");
    expect(html).toContain("Inspection history");
    expect(html).toContain("Predictive quality");
    expect(html).toContain("Predictive maintenance");
  });

  it("displays Root cause analysis in the sidebar navigation when enabled", () => {
    mockEnableRootCause = true;
    const html = renderToString(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    expect(html).toContain("Root cause analysis");
    expect(html).toContain("<span>Root cause analysis</span>");
  });
});
