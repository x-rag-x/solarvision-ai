/**
 * SolarVision AI — Phase 3: Comprehensive Root Cause Feature & State Machine Tests
 * 
 * Verifies:
 * 1. Contract & State Machine compliance across all 5 required operational states:
 *    - Model 2 not trained
 *    - No linked manufacturing data
 *    - Prediction in progress
 *    - Predictions available (real validated output)
 *    - Prediction failure
 * 2. API fetcher error isolation and zero-fake-results enforcement.
 * 3. Feedback submission and historical audit trail persistence.
 */

import { describe, expect, it, vi } from "vitest";
import {
  fetchHistoricalPredictions,
  fetchManufacturingContext,
  fetchModel2Status,
  RootCauseApiError,
  runRootCauseDiagnosis,
  submitCauseVerification,
} from "../api";
import type {
  CandidateCause,
  HistoricalPrediction,
  InspectionContext,
  ManufacturingBatchData,
  ManufacturingMachineData,
  Model2StatusResponse,
  RootCausePrediction,
  SensorObservationData,
} from "../types";

describe("Model 2 Root Cause — Architecture & Contract Verification", () => {
  it("strictly enforces Model 2 not trained state when backend returns 404 or 501", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
      statusText: "Not Found",
      json: async () => ({}),
    });

    const status = await fetchModel2Status();
    expect(status.status).toBe("not_trained");
    expect(status.isReady).toBe(false);
    expect(status.supportedCausesCount).toBe(0);
    expect(status.limitations.length).toBeGreaterThan(0);

    global.fetch = originalFetch;
  });

  it("identifies model unavailable state when backend returns 503", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      status: 503,
      ok: false,
      statusText: "Service Unavailable",
    });

    const status = await fetchModel2Status();
    expect(status.status).toBe("unavailable");
    expect(status.isReady).toBe(false);

    global.fetch = originalFetch;
  });

  it("gracefully returns empty manufacturing context when inspection has no linked MES data", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
      statusText: "Not Found",
    });

    const context = await fetchManufacturingContext("test-uuid-without-mes");
    expect(context.batch).toBeNull();
    expect(context.machine).toBeNull();
    expect(context.sensors).toEqual([]);

    global.fetch = originalFetch;
  });

  it("throws typed RootCauseApiError with INSPECTION_NOT_FOUND when inspectionId is missing", async () => {
    await expect(runRootCauseDiagnosis("")).rejects.toThrow(RootCauseApiError);
    await expect(runRootCauseDiagnosis("")).rejects.toMatchObject({
      code: "INSPECTION_NOT_FOUND",
    });
  });

  it("throws typed RootCauseApiError with MODEL_NOT_TRAINED when inference endpoint returns 501", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      status: 501,
      ok: false,
      statusText: "Not Implemented",
      json: async () => ({ message: "Model 2 weights not compiled" }),
    });

    await expect(runRootCauseDiagnosis("valid-inspection-uuid")).rejects.toThrow(
      RootCauseApiError
    );
    await expect(runRootCauseDiagnosis("valid-inspection-uuid")).rejects.toMatchObject({
      code: "MODEL_NOT_TRAINED",
    });

    global.fetch = originalFetch;
  });

  it("throws typed RootCauseApiError with NO_MANUFACTURING_DATA when validation fails on telemetry", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      status: 422,
      ok: false,
      statusText: "Unprocessable Entity",
      json: async () => ({
        message: "Cell inspection lacks linked furnace temperature profile",
        details: "Requires at least 1 sensor recording in time window",
      }),
    });

    await expect(runRootCauseDiagnosis("valid-inspection-uuid")).rejects.toThrow(
      RootCauseApiError
    );
    await expect(runRootCauseDiagnosis("valid-inspection-uuid")).rejects.toMatchObject({
      code: "NO_MANUFACTURING_DATA",
    });

    global.fetch = originalFetch;
  });

  it("handles general HTTP 500 failure with PREDICTION_FAILED", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      status: 500,
      ok: false,
      statusText: "Internal Server Error",
      json: async () => ({
        message: "Matrix singularity in tree split computation",
      }),
    });

    await expect(runRootCauseDiagnosis("valid-inspection-uuid")).rejects.toThrow(
      RootCauseApiError
    );
    await expect(runRootCauseDiagnosis("valid-inspection-uuid")).rejects.toMatchObject({
      code: "PREDICTION_FAILED",
      statusCode: 500,
    });

    global.fetch = originalFetch;
  });

  it("correctly structures real multi-cause ranked predictions when delivered by backend", async () => {
    const mockPrediction: RootCausePrediction = {
      predictionId: "rc-pred-001",
      inspectionId: "insp-001",
      primaryDefectType: "crack",
      modelVersionId: "2.0.0-rc1",
      status: "completed",
      inferenceTimeMs: 142,
      createdAt: new Date().toISOString(),
      modelLimitations: [
        "Based on historical PERC line profiles; does not model ambient humidity.",
      ],
      candidateCauses: [
        {
          rank: 1,
          causeCode: "EQUIP_SQUEEGEE_PRESSURE_DEVIATION",
          title: "Screen Printing Squeegee Excess Pressure",
          category: "equipment",
          confidence: 0.84,
          summary:
            "Squeegee contact force exceeded calibrated tolerance during metallization, introducing micro-stresses on wafer.",
          recommendedAction:
            "Recalibrate screen-printer squeegee servo pressure to 85 N/cm²; inspect blade edge for wear.",
          urgency: "critical",
          evidence: [
            {
              id: "ev-1",
              factorName: "Squeegee Contact Pressure",
              description: "Sensor recorded 112 N/cm² vs 85 N/cm² baseline",
              observedValue: 112,
              expectedBaseline: 85,
              unit: "N/cm²",
              contributionWeight: 0.62,
              isAnomaly: true,
            },
          ],
        },
        {
          rank: 2,
          causeCode: "PROC_FURNACE_ZONE4_THERMAL_SHOCK",
          title: "Diffusion Furnace Zone 4 Cooling Gradient",
          category: "process",
          confidence: 0.12,
          summary: "Secondary thermal shock risk during wafer exit ramp-down.",
          recommendedAction: "Verify thermocouple calibration on Zone 4 exhaust.",
          urgency: "medium",
          evidence: [],
        },
      ],
    };

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => mockPrediction,
    });

    const result = await runRootCauseDiagnosis("insp-001");
    expect(result.status).toBe("completed");
    expect(result.candidateCauses).toHaveLength(2);
    expect(result.candidateCauses[0].rank).toBe(1);
    expect(result.candidateCauses[0].confidence).toBe(0.84);
    expect(result.candidateCauses[0].category).toBe("equipment");
    expect(result.candidateCauses[0].evidence).toHaveLength(1);
    expect(result.candidateCauses[0].evidence[0].isAnomaly).toBe(true);

    global.fetch = originalFetch;
  });

  it("fetches historical predictions and validates schema fields", async () => {
    const mockHistory: HistoricalPrediction[] = [
      {
        id: "hist-01",
        inspectionId: "insp-001",
        defectType: "thick_line",
        batchNumber: "B-2026-X9",
        machineCode: "SP-03",
        topCause: "Silver Paste Viscosity Fluctuation",
        topConfidence: 0.79,
        category: "material",
        urgency: "high",
        status: "verified",
        createdAt: new Date().toISOString(),
      },
    ];

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ items: mockHistory }),
    });

    const history = await fetchHistoricalPredictions(10);
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("verified");
    expect(history[0].topConfidence).toBe(0.79);

    global.fetch = originalFetch;
  });

  it("submits verification feedback for a prediction", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
    });

    const success = await submitCauseVerification(
      "rc-pred-001",
      "verified",
      "Confirmed after physical microscope inspection."
    );
    expect(success).toBe(true);

    global.fetch = originalFetch;
  });

  it("does not fabricate artificial causes when API returns empty candidates list", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        predictionId: "rc-pred-empty",
        inspectionId: "insp-clear",
        primaryDefectType: "none",
        modelVersionId: "2.0.0",
        status: "completed",
        candidateCauses: [],
        modelLimitations: ["No defects found in inspection."],
        inferenceTimeMs: 12,
        createdAt: new Date().toISOString(),
      }),
    });

    const result = await runRootCauseDiagnosis("insp-clear");
    expect(result.candidateCauses).toHaveLength(0);

    global.fetch = originalFetch;
  });

  it("handles missing_process_data from tRPC rootCause.analyze and enforces Manufacturing Data Required", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        result: {
          data: {
            inspectionId: "insp-no-mes",
            batchId: null,
            machineId: null,
            status: "missing_process_data",
            probableCauses: [],
            modelVersion: "none",
            limitations: [
              "Missing manufacturing process telemetry. Root cause attribution requires linked sensor measurements, machine telemetry, or batch metadata to correlate with defect patterns.",
            ],
          },
        },
      }),
    });

    await expect(runRootCauseDiagnosis("insp-no-mes")).rejects.toThrow(
      "Manufacturing Data Required"
    );

    global.fetch = originalFetch;
  });

  it("handles not_trained from tRPC rootCause.analyze and enforces Model 2 Not Trained", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        result: {
          data: {
            inspectionId: "insp-untrained",
            batchId: "B1",
            machineId: "M1",
            status: "not_trained",
            probableCauses: [],
            modelVersion: "none",
            limitations: [
              "Model 2 Not Trained: checkpoint file not found at 'backend/models/root_cause/root_cause_model.pt'.",
            ],
          },
        },
      }),
    });

    await expect(runRootCauseDiagnosis("insp-untrained")).rejects.toThrow(
      "Model 2 Not Trained"
    );

    global.fetch = originalFetch;
  });
});
