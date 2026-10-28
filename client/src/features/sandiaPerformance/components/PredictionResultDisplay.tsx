/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * Inference Results & Telemetry Diagnostics Display
 * 
 * STRICT COMPLIANCE:
 * - Reflects genuine API response values without invention.
 * - Displays module ID, predicted value, target unit, latency, warnings, and limitations.
 * - Confines test mock disclaimers to explicit mock responses.
 */

import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { SandiaPredictionResponse } from "../types";

interface PredictionResultDisplayProps {
  result: SandiaPredictionResponse | null;
  error?: string | null;
  limitations?: string[];
}

export function PredictionResultDisplay({
  result,
  error,
  limitations = [],
}: PredictionResultDisplayProps) {
  if (error) {
    return (
      <Card className="rounded-3xl border border-rose-300 bg-rose-50/70 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-rose-950">Inference Request Failed</h4>
            <p className="text-xs text-rose-800 leading-relaxed">{error}</p>
            {limitations.length > 0 && (
              <div className="mt-3 space-y-1">
                <span className="text-[11px] font-semibold text-rose-900 uppercase">Limitations & Boundary Notes:</span>
                <ul className="list-disc pl-4 text-[11px] text-rose-700 space-y-0.5">
                  {limitations.map((lim, i) => (
                    <li key={i}>{lim}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  if (!result || !result.prediction) {
    return null;
  }

  const pred = result.prediction;
  const isMock = Boolean(result.is_mock || pred.is_mock);
  const targetName = pred.target_name || "Electrical Output";
  const targetUnit = pred.target_unit || "W";

  // Format prediction value cleanly
  const formattedVal =
    typeof pred.prediction === "number"
      ? Number.isInteger(pred.prediction)
        ? String(pred.prediction)
        : pred.prediction.toFixed(2)
      : String(pred.prediction);

  return (
    <Card className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-8 space-y-6">
      {/* Top Banner if Mock */}
      {isMock && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-950">Isolated Test Mock Fixture</p>
            <p className="text-amber-800 text-[11px] mt-0.5">
              This prediction was produced by an isolated test mock fixture, not a trained production pipeline artifact.
            </p>
          </div>
        </div>
      )}

      {/* Header Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold gap-1 text-[10px]">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              INFERENCE_SUCCESS
            </Badge>
            <span className="text-xs font-mono text-slate-400">
              Contract v{result.contract_version}
            </span>
          </div>
          <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            Predicted Electrical Performance Result
          </h3>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 font-mono self-start sm:self-auto">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            {result.processing_time_ms} ms
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-slate-400" />
            v{result.model_version}
          </span>
        </div>
      </div>

      {/* Main KPI Card */}
      <div className="rounded-2xl bg-[#0B0909] p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F2B941]">
            {targetName}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black tracking-tight text-white font-mono">
              {formattedVal}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-slate-400 font-mono">
              {targetUnit}
            </span>
          </div>
          {pred.prediction_label && (
            <p className="mt-2 text-xs text-emerald-400 font-mono">
              Classification Tag: {pred.prediction_label}
            </p>
          )}
        </div>

        <div className="border-t sm:border-t-0 sm:border-l border-white/10 pt-4 sm:pt-0 sm:pl-6 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">PV Module:</span>
            <span className="font-mono text-slate-200">{pred.module_id || "Unspecified"}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Model Pipeline:</span>
            <span className="font-mono text-slate-200">{result.model_name}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Statistical Confidence:</span>
            <span className="text-slate-400 italic text-[11px]">
              {pred.confidence !== null && pred.confidence !== undefined
                ? `${(pred.confidence * 100).toFixed(1)}%`
                : "Deterministic Pipeline (N/A)"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Standard Uncertainty:</span>
            <span className="text-slate-400 italic text-[11px]">
              {pred.uncertainty !== null && pred.uncertainty !== undefined
                ? `±${pred.uncertainty} ${targetUnit}`
                : "Not Provided by Model"}
            </span>
          </div>
        </div>
      </div>

      {/* Features Consumed Breakdown */}
      {pred.features_used && pred.features_used.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Features Ingested by Scikit-Learn Pipeline ({pred.features_used.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {pred.features_used.map((f) => (
              <Badge key={f} variant="outline" className="text-[11px] font-mono bg-white border-slate-200 text-slate-700">
                {f}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Sensor Boundary Warnings */}
      {pred.warnings && pred.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>Telemetry Boundary Notices ({pred.warnings.length})</span>
          </div>
          <ul className="list-disc pl-5 text-xs text-amber-800 space-y-1">
            {pred.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Limitations / Disclaimers */}
      {result.limitations && result.limitations.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-1.5 text-xs text-slate-600">
          <span className="font-semibold text-slate-700 uppercase text-[10px] tracking-wider">
            Operational Limitations & Contract Caveats
          </span>
          <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-500">
            {result.limitations.map((lim, idx) => (
              <li key={idx}>{lim}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
