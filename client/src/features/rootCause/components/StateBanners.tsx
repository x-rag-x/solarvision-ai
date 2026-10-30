/**
 * SolarVision AI — Phase 3: Root Cause State Banners & Industrial Feedback
 * 
 * Provides dedicated, accessible components for the 5 required states:
 * 1. Model 2 not trained
 * 2. No linked manufacturing data
 * 3. Prediction in progress (loading skeleton)
 * 4. Prediction failure (error state)
 * 5. Model unavailable
 */

import React from "react";
import {
  AlertTriangle,
  BrainCircuit,
  Database,
  Flame,
  Gauge,
  HelpCircle,
  Layers,
  Loader2,
  RefreshCw,
  ServerOff,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Model2StatusResponse } from "../types";

// ==========================================
// 1. Model 2 Not Trained Banner
// ==========================================
export interface ModelNotTrainedBannerProps {
  modelStatus?: Model2StatusResponse | null;
  onRefreshStatus?: () => void;
}

export function ModelNotTrainedBanner({
  modelStatus,
  onRefreshStatus,
}: ModelNotTrainedBannerProps) {
  return (
    <div
      role="status"
      aria-label="Model 2 Not Trained"
      className="rounded-2xl border border-amber-300 bg-amber-50/70 p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500 text-slate-950 shadow-md">
            <BrainCircuit className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-amber-500/30 bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-900">
                Model 2 Lifecycle: Untrained
              </span>
              <span className="text-xs text-amber-800">
                Architecture: Multimodal Etiology Classifier
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Model 2 Not Trained
            </h3>
            <p className="max-w-2xl text-xs leading-relaxed text-slate-700">
              Model 2 correlates electroluminescence (EL) defect bounding boxes with manufacturing
              execution system (MES) sensor streams (furnace zone temperatures, screen printer squeegee
              wear, vacuum pressure). The training checkpoint has not yet been compiled.
            </p>
            <div className="mt-3 rounded-xl border border-amber-200/80 bg-white/80 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Required Training Prerequisites
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Synchronized dataset matching cell EL images to machine telemetry time windows
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Calibrated ground truth labels for process deviations (screen mesh, thermal gradients)
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Agent 1 backend training pipeline execution (`backend/training/train_model2.py`)
                </li>
              </ul>
            </div>
          </div>
        </div>

        {onRefreshStatus && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshStatus}
            className="shrink-0 border-amber-300 bg-white text-xs font-semibold text-amber-950 hover:bg-amber-100"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Check Model Status
          </Button>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 2. No Linked Manufacturing Data Banner
// ==========================================
export interface NoManufacturingDataBannerProps {
  inspectionId?: string;
  onRetryContext?: () => void;
}

export function NoManufacturingDataBanner({
  inspectionId,
  onRetryContext,
}: NoManufacturingDataBannerProps) {
  return (
    <div
      role="status"
      aria-label="No Manufacturing Data"
      className="rounded-2xl border border-blue-200 bg-blue-50/70 p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white shadow-md">
            <Database className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-blue-400/40 bg-blue-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-blue-900">
                Data Dependency Missing
              </span>
              {inspectionId && (
                <span className="font-mono text-xs text-blue-700 truncate max-w-[200px]">
                  ID: {inspectionId}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Manufacturing Data Required
            </h3>
            <p className="max-w-2xl text-xs leading-relaxed text-slate-700">
              This solar cell inspection record contains optical defect classifications from Model 1, but
              lacks linked batch metadata, machine identifiers, or sensor measurements in the database.
              Root Cause Analysis requires process telemetry (furnace temperatures, squeegee pressure, or machine codes) to determine physical etiology.
            </p>
            <p className="text-xs text-slate-500">
              To evaluate root cause, assign a valid <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-900 font-mono">batchId</code> or select an inspection logged from an active production line.
            </p>
          </div>
        </div>

        {onRetryContext && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetryContext}
            className="shrink-0 border-blue-300 bg-white text-xs font-semibold text-blue-950 hover:bg-blue-100"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Reload Telemetry
          </Button>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 3. Prediction In Progress Skeleton
// ==========================================
export function PredictionInProgressSkeleton() {
  return (
    <div
      role="status"
      aria-label="Prediction in progress"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-slate-950">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Evaluating Multimodal Root Cause Etiology...
              </h3>
              <p className="text-xs text-slate-500">
                Correlating spatial defect bounding boxes with process sensor telemetry
              </p>
            </div>
          </div>
          <span className="rounded-full bg-surface-subtle px-3 py-1 text-xs font-semibold text-slate-900">
            Inferring Candidates
          </span>
        </div>

        {/* Pipeline steps animation */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Layers className="h-4 w-4 text-primary" />
              Step 1: Feature Extraction
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Parsing 9 defect classes and bounding box spatial centroids
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-full bg-success rounded-full" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Gauge className="h-4 w-4 text-blue-500" />
              Step 2: Sensor Cross-Matching
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Aligning temperature, squeegee pressure, and vacuum curves
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-2/3 bg-primary animate-pulse rounded-full" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Flame className="h-4 w-4 text-purple-500" />
              Step 3: Random Forest / Multi-Modal Ranking
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Evaluating decision tree ensemble feature importances and cause candidates
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-1/4 bg-slate-400 rounded-full" />
            </div>
          </div>
        </div>

        {/* Placeholder cards */}
        <div className="space-y-3 pt-2">
          <div className="h-20 w-full animate-pulse rounded-xl bg-slate-100" />
          <div className="h-20 w-full animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. Prediction Failure Banner
// ==========================================
export interface PredictionFailureBannerProps {
  message?: string;
  details?: string;
  onRetry?: () => void;
}

export function PredictionFailureBanner({
  message = "Failed to complete root cause prediction.",
  details,
  onRetry,
}: PredictionFailureBannerProps) {
  return (
    <div
      role="alert"
      aria-label="Prediction Failure"
      className="rounded-2xl border border-rose-300 bg-rose-50/80 p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-600 text-white shadow-md">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-rose-400/40 bg-rose-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-rose-900">
                Inference Failure
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Root Cause Prediction Could Not Be Executed
            </h3>
            <p className="max-w-2xl text-xs leading-relaxed text-slate-700">
              {message}
            </p>
            {details && (
              <div className="mt-2 rounded-lg bg-white/80 p-2.5 font-mono text-xs text-rose-950 border border-rose-200">
                {details}
              </div>
            )}
          </div>
        </div>

        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="shrink-0 border-rose-300 bg-white text-xs font-semibold text-rose-950 hover:bg-rose-100"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Retry Diagnosis
          </Button>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 5. Model Unavailable Banner
// ==========================================
export function ModelUnavailableBanner({ onCheckAgain }: { onCheckAgain?: () => void }) {
  return (
    <div
      role="status"
      aria-label="Model 2 Unavailable"
      className="rounded-2xl border border-slate-300 bg-slate-100/90 p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-700 text-white shadow-md">
            <ServerOff className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <span className="rounded-md border border-slate-300 bg-slate-200 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-800">
              Service Offline
            </span>
            <h3 className="text-base font-bold text-slate-900">
              Model 2 Inference Service Offline
            </h3>
            <p className="max-w-2xl text-xs text-slate-600">
              The backend root cause inference worker is not responding or is undergoing maintenance.
              Please check backend service logs or contact the systems administrator.
            </p>
          </div>
        </div>
        {onCheckAgain && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCheckAgain}
            className="shrink-0 border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-200"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Retry Connection
          </Button>
        )}
      </div>
    </div>
  );
}
