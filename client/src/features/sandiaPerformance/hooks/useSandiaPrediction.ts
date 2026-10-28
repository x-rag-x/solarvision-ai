/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * React Hook for Single and Batch Inference Execution
 */

import { useState } from "react";
import { sandiaApi, SandiaApiError } from "../adapter";
import type {
  SandiaBatchPredictionInput,
  SandiaBatchPredictionResponse,
  SandiaPredictionInput,
  SandiaPredictionResponse,
} from "../types";

export interface UseSandiaPredictionReturn {
  isSubmitting: boolean;
  result: SandiaPredictionResponse | null;
  error: string | null;
  limitations: string[];
  executePrediction: (
    input: SandiaPredictionInput
  ) => Promise<SandiaPredictionResponse | null>;
  executeBatchPrediction: (
    input: SandiaBatchPredictionInput
  ) => Promise<SandiaBatchPredictionResponse | null>;
  reset: () => void;
}

export function useSandiaPrediction(): UseSandiaPredictionReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SandiaPredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitations, setLimitations] = useState<string[]>([]);

  const executePrediction = async (
    input: SandiaPredictionInput
  ): Promise<SandiaPredictionResponse | null> => {
    setIsSubmitting(true);
    setError(null);
    setLimitations([]);

    try {
      const response = await sandiaApi.predict(input);
      setResult(response);
      if (response.limitations) {
        setLimitations(response.limitations);
      }
      return response;
    } catch (err: any) {
      const msg = err?.message || "Inference execution failed.";
      setError(msg);
      if (err instanceof SandiaApiError && err.limitations) {
        setLimitations(err.limitations);
      }
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeBatchPrediction = async (
    input: SandiaBatchPredictionInput
  ): Promise<SandiaBatchPredictionResponse | null> => {
    setIsSubmitting(true);
    setError(null);
    setLimitations([]);

    try {
      const response = await sandiaApi.predictBatch(input);
      if (response.limitations) {
        setLimitations(response.limitations);
      }
      return response;
    } catch (err: any) {
      const msg = err?.message || "Batch inference execution failed.";
      setError(msg);
      if (err instanceof SandiaApiError && err.limitations) {
        setLimitations(err.limitations);
      }
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setLimitations([]);
  };

  return {
    isSubmitting,
    result,
    error,
    limitations,
    executePrediction,
    executeBatchPrediction,
    reset,
  };
}
