/**
 * SolarVision AI — Phase 3: Root Cause State Machine & Data Hook
 * 
 * Orchestrates the full lifecycle of Root Cause Analysis:
 * 1. Checks Model 2 readiness (trained vs untrained vs offline).
 * 2. Fetches linked manufacturing batch, machine, and sensor telemetry.
 * 3. Enforces that if Model 2 is untrained, the UI stays in `model_not_trained`.
 * 4. Enforces that if no manufacturing data exists, UI shows `no_manufacturing_data`.
 * 5. Handles live asynchronous inference (`loading` -> `ready` or `error`).
 * 6. Loads and manages the historical prediction log.
 */

import { useCallback, useEffect, useState } from "react";
import {
  fetchHistoricalPredictions,
  fetchManufacturingContext,
  fetchModel2Status,
  RootCauseApiError,
  runRootCauseDiagnosis,
  submitCauseVerification,
} from "./api";
import type {
  HistoricalPrediction,
  InspectionContext,
  ManufacturingBatchData,
  ManufacturingMachineData,
  Model2StatusResponse,
  RootCausePrediction,
  RootCauseState,
  RootCauseUIStatus,
  SensorObservationData,
} from "./types";

export interface UseRootCauseOptions {
  initialInspection?: InspectionContext | null;
  autoCheckModelStatus?: boolean;
}

export function useRootCause({
  initialInspection = null,
  autoCheckModelStatus = true,
}: UseRootCauseOptions = {}) {
  const [selectedInspection, setSelectedInspection] = useState<InspectionContext | null>(
    initialInspection
  );
  const [modelStatus, setModelStatus] = useState<Model2StatusResponse | null>(null);
  const [batchData, setBatchData] = useState<ManufacturingBatchData | null>(null);
  const [machineData, setMachineData] = useState<ManufacturingMachineData | null>(null);
  const [sensorObservations, setSensorObservations] = useState<SensorObservationData[]>([]);
  const [prediction, setPrediction] = useState<RootCausePrediction | null>(null);
  const [history, setHistory] = useState<HistoricalPrediction[]>([]);
  const [uiStatus, setUiStatus] = useState<RootCauseUIStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [errorDetails, setErrorDetails] = useState<string | undefined>();

  // 1. Check Model 2 status
  const checkModelStatus = useCallback(async () => {
    try {
      const statusRes = await fetchModel2Status();
      setModelStatus(statusRes);
      return statusRes;
    } catch (err: any) {
      const fallbackStatus: Model2StatusResponse = {
        status: "unavailable",
        modelName: "SolarVision-M2-Etiology",
        modelVersion: "unknown",
        isReady: false,
        trainingStatus: "Failed to connect to Model 2 status service.",
        supportedCausesCount: 0,
        limitations: ["Service unreachable."],
      };
      setModelStatus(fallbackStatus);
      return fallbackStatus;
    }
  }, []);

  // 2. Load manufacturing context when inspection changes
  const loadManufacturingContext = useCallback(async (inspection: InspectionContext | null) => {
    if (!inspection) {
      setBatchData(null);
      setMachineData(null);
      setSensorObservations([]);
      return;
    }

    try {
      const context = await fetchManufacturingContext(inspection.inspectionId);
      setBatchData(context.batch);
      setMachineData(context.machine);
      setSensorObservations(context.sensors);
    } catch (err) {
      setBatchData(null);
      setMachineData(null);
      setSensorObservations([]);
    }
  }, []);

  // 3. Load historical predictions
  const loadHistory = useCallback(async () => {
    try {
      const records = await fetchHistoricalPredictions(50);
      setHistory(records);
    } catch (err) {
      // Historical log failure shouldn't crash diagnosis view
      setHistory([]);
    }
  }, []);

  // Initial setup
  useEffect(() => {
    if (autoCheckModelStatus) {
      checkModelStatus();
    }
    loadHistory();
  }, [autoCheckModelStatus, checkModelStatus, loadHistory]);

  // When selected inspection changes
  useEffect(() => {
    if (selectedInspection) {
      loadManufacturingContext(selectedInspection);
      setPrediction(null);
      setErrorMessage(undefined);
      setErrorDetails(undefined);
      setUiStatus("idle");
    }
  }, [selectedInspection, loadManufacturingContext]);

  // 4. Trigger root cause diagnosis
  const runDiagnosis = useCallback(
    async (defectId?: number) => {
      if (!selectedInspection) {
        setUiStatus("error");
        setErrorMessage("Please select a solar cell inspection first.");
        return;
      }

      setUiStatus("loading");
      setErrorMessage(undefined);
      setErrorDetails(undefined);

      try {
        // First verify model status
        const currentModelStatus = modelStatus || (await checkModelStatus());
        if (!currentModelStatus.isReady || currentModelStatus.status === "not_trained") {
          setUiStatus("model_not_trained");
          return;
        }

        // Check if manufacturing data is missing
        if (!batchData && !machineData && sensorObservations.length === 0) {
          // Attempt reload of context
          const reloaded = await fetchManufacturingContext(selectedInspection.inspectionId);
          if (!reloaded.batch && !reloaded.machine && reloaded.sensors.length === 0) {
            setUiStatus("no_manufacturing_data");
            return;
          }
          setBatchData(reloaded.batch);
          setMachineData(reloaded.machine);
          setSensorObservations(reloaded.sensors);
        }

        // Run real model diagnosis from Agent 1
        const result = await runRootCauseDiagnosis(
          selectedInspection.inspectionId,
          defectId,
          selectedInspection
        );

        if (result.status === "model_not_trained") {
          setUiStatus("model_not_trained");
          return;
        }

        setPrediction(result);
        setUiStatus("ready");

        // Refresh history to reflect newly logged diagnosis
        loadHistory();
      } catch (err: any) {
        if (err instanceof RootCauseApiError) {
          if (err.code === "MODEL_NOT_TRAINED") {
            setUiStatus("model_not_trained");
            return;
          }
          if (err.code === "NO_MANUFACTURING_DATA") {
            setUiStatus("no_manufacturing_data");
            return;
          }
          setUiStatus("error");
          setErrorMessage(err.message);
          setErrorDetails(err.details);
        } else {
          setUiStatus("error");
          setErrorMessage(err.message || "An unexpected error occurred during root cause inference.");
        }
      }
    },
    [selectedInspection, modelStatus, checkModelStatus, batchData, machineData, sensorObservations, loadHistory]
  );

  // 5. Verification feedback action
  const handleVerifyCause = useCallback(
    async (predictionId: string, status: "verified" | "dismissed", notes?: string) => {
      const ok = await submitCauseVerification(predictionId, status, notes);
      if (ok) {
        loadHistory();
      }
      return ok;
    },
    [loadHistory]
  );

  const state: RootCauseState = {
    uiStatus,
    modelStatus,
    selectedInspection,
    batchData,
    machineData,
    sensorObservations,
    prediction,
    history,
    errorMessage,
    errorDetails,
  };

  return {
    state,
    selectedInspection,
    setSelectedInspection,
    modelStatus,
    batchData,
    machineData,
    sensorObservations,
    prediction,
    history,
    uiStatus,
    errorMessage,
    errorDetails,
    runDiagnosis,
    checkModelStatus,
    loadHistory,
    handleVerifyCause,
    setUiStatus, // Exposed for testability & manual state simulation
  };
}
