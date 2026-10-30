/**
 * SolarVision AI — Model 2 Cell Screening UI Clarity Test Suite
 *
 * Verifies all 7 UI clarity scenarios:
 * 1. Defectiveness score 14.89% → Predicted Healthy + Operator Verification Required.
 * 2. Score below the configured cutoff → Predicted Healthy.
 * 3. Score exactly at the configured cutoff (55%) → Predicted Defective.
 * 4. Score above the cutoff → Predicted Defective.
 * 5. Both predictions retain mandatory verification and research disclaimer.
 * 6. Historical results show the correct prediction and verification requirement.
 * 7. Printable prod-mode report preserves updated terminology and verification requirement.
 */

import * as React from "react";
(globalThis as any).React = React;
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Ensure global location exists in node test environment
if (typeof globalThis.location === "undefined") {
  (globalThis as any).location = {
    pathname: "/cell-screening",
    search: "",
    hash: "",
    href: "http://localhost/cell-screening",
  };
}

// Mock wouter hooks for SSR rendering
vi.mock("wouter", () => ({
  useLocation: () => ["/cell-screening", vi.fn()],
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock app mode (dev vs prod)
let mockIsProd = false;
let mockIsDev = true;

vi.mock("@/contexts/ModeContext", () => ({
  useAppMode: () => ({
    mode: mockIsProd ? "prod" : "dev",
    isDev: mockIsDev,
    isProd: mockIsProd,
    setMode: vi.fn(),
    toggleMode: vi.fn(),
  }),
}));

// Mock history data
let mockHistoryData: any[] = [];

// Mock TRPC hooks
vi.mock("@/lib/trpc", () => ({
  trpc: {
    model2Elpv: {
      status: {
        useQuery: () => ({
          data: {
            modelId: "solarvision_m2_elpv_binary_v1",
            artifactsPresent: true,
            checkpointPath: "model2_efficientnet_b0.pt",
            inputScope: "complete_single_cell_EL_image",
            threshold: 0.55,
            benchmark: {
              modelId: "solarvision_m2_elpv_binary_v1",
              dataset: "ELPV 1.0.0.post1",
              license: "CC BY-NC-SA 4.0",
              accuracy: 0.6981,
              defectiveRecall: 0.6867,
              defectivePrecision: 0.4597,
              f1Defective: 0.5507,
              threshold: 0.55,
              testSetSize: 308,
              testHealthyCount: 225,
              testDefectiveCount: 83,
              limitations: [
                "Research benchmark with 69.81% accuracy, 68.67% defective recall, 45.97% defective precision on 308 held-out images.",
                "Mandatory operator review required on every output: zero automatic PASS/REJECT decisions.",
              ],
            },
          },
          isLoading: false,
        }),
      },
      history: {
        useQuery: () => ({
          data: mockHistoryData,
          refetch: vi.fn(),
          isLoading: false,
        }),
      },
      predict: {
        useMutation: () => ({
          mutateAsync: vi.fn(),
          isPending: false,
        }),
      },
    },
  },
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "operator_01", role: "operator", name: "Operator Alex" },
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

import { CellScreeningView, type ScreeningResult } from "../features/cellScreening";

function makeScreeningResult(overrides: Partial<ScreeningResult> = {}): ScreeningResult {
  const rawDefectiveScore = overrides.rawDefectiveScore ?? 0.1489;
  const rawThreshold = overrides.rawThreshold ?? 0.55;
  const defectiveScorePct = overrides.defectiveScorePct ?? Math.round(rawDefectiveScore * 10000) / 100;
  const thresholdPct = overrides.thresholdPct ?? Math.round(rawThreshold * 10000) / 100;
  const isDefective = rawDefectiveScore >= rawThreshold;
  const predictedClass = overrides.predictedClass ?? (isDefective ? "defective" : "healthy");

  return {
    screeningId: "scr-test-uuid-12345",
    imageUrl: "/uploads/cell-screenings/test.png",
    sourceFilename: "cell0079.png",
    modelId: "solarvision_m2_elpv_binary_v1",
    predictedClass,
    defectiveScorePct,
    rawDefectiveScore,
    thresholdPct,
    rawThreshold,
    requiresManualReview: true,
    decision: "screening_only",
    reviewStatus: "pending",
    inputScope: "complete_single_cell_EL_image",
    warning: "Research screening only. Not a certified accept/reject decision.",
    summary: `Predicted ${predictedClass === "defective" ? "Defective" : "Healthy"} (${predictedClass}, defective score ${defectiveScorePct}%) — manual review required`,
    dataProvenance: "ELPV",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Model 2 Screening Result UI Clarity Fix", () => {
  beforeEach(() => {
    mockIsProd = false;
    mockIsDev = true;
    mockHistoryData = [];
  });

  // ========================================================================
  // Scenario 1: Defectiveness score 14.89%
  // ========================================================================
  it("Scenario 1: Defectiveness score 14.89% displays Predicted Healthy + Operator Verification Required", () => {
    const result = makeScreeningResult({
      rawDefectiveScore: 0.1489,
      defectiveScorePct: 14.89,
      predictedClass: "healthy",
    });

    const html = renderToString(<CellScreeningView initialResult={result} />);

    // 1. Terminology: Predicted Healthy instead of standalone Healthy
    expect(html).toContain("Predicted Healthy");
    // Should NOT have an ambiguous standalone "Verdict: Healthy" or "Healthy Predicted"
    expect(html).not.toContain("Healthy Predicted");
    expect(html).not.toContain(">Verdict<");

    // 2. Defectiveness Score prominent display
    expect(html).toContain("Defectiveness Score");
    expect(html).toContain("14.89%");

    // 3. Decision Threshold marked at 55%
    expect(html).toContain("Decision Threshold");
    expect(html).toContain("55%");

    // 4. Operator Verification: Required with clear explanation (no standalone unexplained "Mandatory")
    expect(html).toContain("Operator Verification");
    expect(html).toContain("Required");
    expect(html).toContain(
      "Human verification is required before a quality decision, regardless of the AI prediction."
    );
    expect(html).not.toContain('<span class="font-semibold text-warning">Mandatory</span>');

    // 5. Probability Gauge region labels
    expect(html).toContain("Predicted Healthy (&lt; 55%)");
    expect(html).toContain("Predicted Defective (≥ 55%)");
    expect(html).toContain(
      "This score is a model-estimated defectiveness probability, not a certified quality measurement."
    );

    // 6. Operator Directive for healthy prediction
    expect(html).toContain("Predicted Healthy — Verification Required");
    expect(html).toContain(
      "The model estimates a low likelihood of defects. An operator must verify the cell before approving its quality."
    );

    // 7. Research disclaimer below result
    expect(html).toContain(
      "Research screening result only. Human review is required before a final quality decision."
    );
  });

  // ========================================================================
  // Scenario 2: Score below cutoff
  // ========================================================================
  it("Scenario 2: Score below the configured cutoff (47.57% < 55%) displays Predicted Healthy", () => {
    const result = makeScreeningResult({
      rawDefectiveScore: 0.4757,
      defectiveScorePct: 47.57,
      predictedClass: "healthy",
    });

    const html = renderToString(<CellScreeningView initialResult={result} />);

    expect(html).toContain("Predicted Healthy");
    expect(html).toContain("47.57%");
    expect(html).toContain("Predicted Healthy — Verification Required");
    expect(html).toContain(
      "The model estimates a low likelihood of defects. An operator must verify the cell before approving its quality."
    );
    expect(html).toContain("Operator Verification");
    expect(html).toContain("Required");
  });

  // ========================================================================
  // Scenario 3: Score exactly at configured cutoff (55.0% == 55%)
  // ========================================================================
  it("Scenario 3: Score exactly at the configured cutoff (55.0% == 55%) displays Predicted Defective", () => {
    const result = makeScreeningResult({
      rawDefectiveScore: 0.55,
      defectiveScorePct: 55.0,
      predictedClass: "defective",
    });

    const html = renderToString(<CellScreeningView initialResult={result} />);

    expect(html).toContain("Predicted Defective");
    expect(html).toContain("55%");
    expect(html).toContain("Predicted Defective — Verification Required");
    expect(html).toContain(
      "The model estimates a higher likelihood of defects. An operator must inspect the cell and confirm the findings before making a quality decision."
    );
    expect(html).toContain("Operator Verification");
    expect(html).toContain("Required");
  });

  // ========================================================================
  // Scenario 4: Score above cutoff (96.34% > 55%)
  // ========================================================================
  it("Scenario 4: Score above the cutoff (96.34% > 55%) displays Predicted Defective", () => {
    const result = makeScreeningResult({
      rawDefectiveScore: 0.9634,
      defectiveScorePct: 96.34,
      predictedClass: "defective",
    });

    const html = renderToString(<CellScreeningView initialResult={result} />);

    expect(html).toContain("Predicted Defective");
    expect(html).toContain("96.34%");
    expect(html).toContain("Predicted Defective — Verification Required");
    expect(html).toContain(
      "The model estimates a higher likelihood of defects. An operator must inspect the cell and confirm the findings before making a quality decision."
    );
    expect(html).toContain("Operator Verification");
    expect(html).toContain("Required");
  });

  // ========================================================================
  // Scenario 5: Both predictions retain mandatory verification
  // ========================================================================
  it("Scenario 5: Both healthy and defective predictions retain mandatory operator verification", () => {
    const healthyResult = makeScreeningResult({
      rawDefectiveScore: 0.1489,
      defectiveScorePct: 14.89,
      predictedClass: "healthy",
    });
    const defectiveResult = makeScreeningResult({
      rawDefectiveScore: 0.9634,
      defectiveScorePct: 96.34,
      predictedClass: "defective",
    });

    const healthyHtml = renderToString(<CellScreeningView initialResult={healthyResult} />);
    const defectiveHtml = renderToString(<CellScreeningView initialResult={defectiveResult} />);

    // Both contain Operator Verification: Required
    expect(healthyHtml).toContain("Operator Verification");
    expect(healthyHtml).toContain("Required");
    expect(healthyHtml).toContain(
      "Human verification is required before a quality decision, regardless of the AI prediction."
    );
    expect(healthyHtml).toContain(
      "Research screening result only. Human review is required before a final quality decision."
    );

    expect(defectiveHtml).toContain("Operator Verification");
    expect(defectiveHtml).toContain("Required");
    expect(defectiveHtml).toContain(
      "Human verification is required before a quality decision, regardless of the AI prediction."
    );
    expect(defectiveHtml).toContain(
      "Research screening result only. Human review is required before a final quality decision."
    );

    // Neither implies automated certification or defect-free guarantee
    expect(healthyHtml).not.toContain("certified defect-free");
    expect(defectiveHtml).not.toContain("certified defect-free");
    expect(healthyHtml).not.toContain("Autonomous PASS");
  });

  // ========================================================================
  // Scenario 6: Historical results show correct prediction and verification
  // ========================================================================
  it("Scenario 6: Historical results show the correct prediction and verification requirement", () => {
    mockHistoryData = [
      {
        id: "rec-001",
        sourceFilename: "cell0079.png",
        predictedClass: "healthy",
        defectiveScorePct: 14.89,
        defectiveProbability: 0.1489,
        threshold: 0.55,
        createdAt: "2026-10-30T10:00:00Z",
      },
      {
        id: "rec-002",
        sourceFilename: "cell0003.png",
        predictedClass: "defective",
        defectiveScorePct: 96.34,
        defectiveProbability: 0.9634,
        threshold: 0.55,
        createdAt: "2026-10-30T10:05:00Z",
      },
    ];

    const html = renderToString(<CellScreeningView />);

    expect(html).toContain("Recent Cell Screening History");
    expect(html).toContain("cell0079.png");
    expect(html).toContain("cell0003.png");

    // Must show Predicted Healthy and Predicted Defective with scores
    expect(html).toContain("Predicted Healthy (14.89%)");
    expect(html).toContain("Predicted Defective (96.34%)");

    // Each row must indicate Verification Required
    expect(html).toContain("Verification Required");
  });

  // ========================================================================
  // Scenario 7: Prod mode report layout
  // ========================================================================
  it("Scenario 7: Prod mode report reflects updated terminology and mandatory human verification", () => {
    mockIsProd = true;
    mockIsDev = false;

    const healthyResult = makeScreeningResult({
      rawDefectiveScore: 0.1489,
      defectiveScorePct: 14.89,
      predictedClass: "healthy",
    });

    const html = renderToString(<CellScreeningView initialResult={healthyResult} />);

    expect(html).toContain("Cell Screening Report");
    expect(html).toContain("Predicted Healthy");
    expect(html).toContain("Predicted Healthy — Verification Required");
    expect(html).toContain("Defectiveness Score");
    expect(html).toContain("Decision Threshold");
    expect(html).toContain("Operator Verification");
    expect(html).toContain(
      "Human verification is required before a quality decision, regardless of the AI prediction."
    );
    expect(html).toContain(
      "Research screening result only. Human review is required before a final quality decision."
    );
    expect(html).not.toContain("Mandatory Review");
    expect(html).not.toContain("Defective Likelihood Flagged");
  });
});
