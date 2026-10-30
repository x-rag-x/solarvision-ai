/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * Model Status, Readiness & Artifact Provenance Card
 */

import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  FileCode2,
  Layers,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SandiaModelStatusResponse } from "../types";

interface ModelStatusCardProps {
  status: SandiaModelStatusResponse | null;
  loading: boolean;
  onRefresh: () => void;
  isRunning?: boolean;
}

export function ModelStatusCard({
  status,
  loading,
  onRefresh,
  isRunning = false,
}: ModelStatusCardProps) {
  const isReady = Boolean(status?.is_ready);
  const statusKey = isRunning
    ? "prediction_running"
    : status?.status || (isReady ? "ready" : "not_trained");
  const isPendingTrainer = Boolean(status?.trainer_handoff_pending);
  const isMock = Boolean(status?.is_mock);

  const getStatusBadge = () => {
    if (isRunning) {
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold gap-1 animate-pulse">
          <RefreshCw className="h-3 w-3 animate-spin" />
          PREDICTION_RUNNING
        </Badge>
      );
    }
    if (isReady) {
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          READY (PIPELINE LOADED)
        </Badge>
      );
    }
    if (statusKey === "missing_features") {
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold gap-1">
          <AlertTriangle className="h-3 w-3 text-amber-600" />
          SCHEMA_PENDING
        </Badge>
      );
    }
    if (statusKey === "validation_error") {
      return (
        <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-semibold gap-1">
          <AlertCircle className="h-3 w-3 text-rose-600" />
          VALIDATION_ERROR
        </Badge>
      );
    }
    if (statusKey === "error") {
      return (
        <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-semibold gap-1">
          <AlertCircle className="h-3 w-3 text-rose-600" />
          MODEL_UNAVAILABLE
        </Badge>
      );
    }
    return (
      <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-semibold gap-1">
        <AlertCircle className="h-3 w-3 text-rose-600" />
        NOT_TRAINED
      </Badge>
    );
  };

  return (
    <Card className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-8">
      {/* Header Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {getStatusBadge()}
            {isPendingTrainer && (
              <Badge className="bg-slate-100 text-slate-800 border-slate-300 text-xs font-mono">
                TRAINER_HANDOFF_PENDING
              </Badge>
            )}
            {isMock && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs font-mono">
                TEST_MOCK_ACTIVE
              </Badge>
            )}
            <span className="text-xs text-slate-500 font-mono">
              Contract v{status?.contract_version || "1.0.0"}
            </span>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Sandia Solar Electrical Performance Predictor
          </h2>
          <p className="text-xs text-slate-600 sm:text-sm max-w-2xl leading-relaxed">
            Infers photovoltaic electrical performance (Pmp, maximum power point, and electrical conversion characteristics) using calibrated environmental and meteorological sensor telemetry.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="gap-2 rounded-xl border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-slate-400" : "text-[#F2B941]"}`} />
          Refresh Model Status
        </Button>
      </div>

      {/* Unavailability Notice / Handoff Explanation */}
      {!isReady && (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-xs text-rose-900">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-rose-950">
                Model Pipeline Quarantined — Ready State Requires Model Artifact
              </p>
              <p className="text-rose-800 leading-relaxed">
                {status?.unavailability_reason ||
                  "Sandia solar electrical performance model artifact (pipeline.joblib) has not yet been delivered by the training team. Zero synthetic numbers or fabricated confidences are returned."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Architecture & Telemetry Grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-4">
        {/* Artifact Name */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <FileCode2 className="h-3.5 w-3.5 text-slate-500" />
            Artifact
          </span>
          <p className="mt-1.5 text-sm font-bold font-mono text-slate-900 truncate" title={status?.artifact_name}>
            {status?.artifact_name || "pipeline.joblib"}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">scikit-learn pipeline</p>
        </div>

        {/* Model Version */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            Model Version
          </span>
          <p className="mt-1.5 text-sm font-bold font-mono text-slate-900 truncate">
            {status?.model_version || "none"}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Trained checkpoint tag</p>
        </div>

        {/* Feature Schema Status */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-slate-500" />
            Feature Schema
          </span>
          <p className="mt-1.5 text-sm font-bold text-slate-900">
            {status?.feature_schema_loaded ? (
              <span className="text-emerald-700 font-semibold">Loaded ({status.expected_dim ?? status.feature_schema?.features?.length ?? 0} features)</span>
            ) : (
              <span className="text-amber-700 font-semibold">Pending Trainer</span>
            )}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">feature_schema.json</p>
        </div>

        {/* Dataset Provenance */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[#F2B941]" />
            Provenance
          </span>
          <p className="mt-1.5 text-xs font-semibold text-slate-900 truncate" title="Sandia National Laboratories PSEL">
            Sandia National Lab
          </p>
          <p className="text-xs text-slate-400 mt-0.5">PSEL Telemetry Dataset</p>
        </div>
      </div>
    </Card>
  );
}
