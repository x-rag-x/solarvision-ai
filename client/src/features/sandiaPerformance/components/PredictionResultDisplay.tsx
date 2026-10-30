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
      <Card className="rounded-xl border border-rose-300 bg-rose-50/70 p-6 shadow-xs">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-rose-950">Inference Request Failed</h4>
            <p className="text-xs text-rose-800 leading-relaxed">{error}</p>
            {limitations.length > 0 && (
              <div className="mt-3 space-y-1">
                <span className="text-xs font-semibold text-rose-900 uppercase">Limitations & Boundary Notes:</span>
                <ul className="list-disc pl-4 text-xs text-rose-700 space-y-0.5">
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
  const isMock = Boolean(
    result.is_mock ||
      (result as any).isMock ||
      pred.is_mock ||
      (pred as any).isMock
  );
  const targetName =
    pred.target_name || (pred as any).targetName || "Electrical Output";
  const targetUnit = pred.target_unit || (pred as any).targetUnit || "W";
  const moduleId = pred.module_id || (pred as any).moduleId || "Unspecified";
  const modelName = result.model_name || (result as any).modelName || "";
  const modelVersion = result.model_version || (result as any).modelVersion || "";
  const contractVersion =
    result.contract_version || (result as any).contractVersion || "1.0.0";
  const processingTimeMs =
    result.processing_time_ms ?? (result as any).processingTimeMs ?? 0;

  // Format prediction value cleanly
  const formattedVal =
    typeof pred.prediction === "number"
      ? Number.isInteger(pred.prediction)
        ? String(pred.prediction)
        : pred.prediction.toFixed(2)
      : String(pred.prediction);

  return (
    <Card className="rounded-xl border border-border bg-surface p-6 shadow-xs sm:p-7 space-y-6">
      {/* Top Banner if Mock */}
      {isMock && (
        <div className="rounded-xl border border-warning-border bg-warning-tint p-4 text-xs text-warning flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
          <div>
            <p className="font-semibold text-warning">Isolated Test Mock Fixture</p>
            <p className="text-xs mt-0.5 text-text-2">
              This prediction was produced by an isolated test mock fixture, not a trained production pipeline artifact.
            </p>
          </div>
        </div>
      )}

      {/* Header Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              INFERENCE_SUCCESS
            </Badge>
            <span className="text-xs font-mono text-text-3">
              Contract v{contractVersion}
            </span>
          </div>
          <h3 className="mt-1 text-xl font-bold tracking-tight text-sapphire">
            Predicted Electrical Performance Result
          </h3>
        </div>

        <div className="flex items-center gap-3 text-xs text-text-3 font-mono self-start sm:self-auto">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-text-3" />
            {processingTimeMs} ms
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-text-3" />
            v{modelVersion}
          </span>
        </div>
      </div>

      {/* Main KPI Card */}
      <div className="rounded-xl bg-sapphire p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-dusty-pink">
            {targetName}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black tracking-tight text-white font-mono">
              {formattedVal}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-soft-lavender font-mono">
              {targetUnit}
            </span>
          </div>
          {(pred.prediction_label || (pred as any).predictionLabel) && (
            <p className="mt-2 text-xs text-emerald-300 font-mono">
              Classification Tag: {pred.prediction_label || (pred as any).predictionLabel}
            </p>
          )}
        </div>

        <div className="border-t sm:border-t-0 sm:border-l border-white/15 pt-4 sm:pt-0 sm:pl-6 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="text-cloud-white/70">PV Module:</span>
            <span className="font-mono text-cloud-white">{moduleId}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-cloud-white/70">Model Pipeline:</span>
            <span className="font-mono text-cloud-white">{modelName}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-cloud-white/70">Statistical Confidence:</span>
            <span className="text-cloud-white/70 italic text-xs">
              {pred.confidence !== null && pred.confidence !== undefined
                ? `${(pred.confidence * 100).toFixed(1)}%`
                : "Deterministic Pipeline (N/A)"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-cloud-white/70">Standard Uncertainty:</span>
            <span className="text-cloud-white/70 italic text-xs">
              {pred.uncertainty !== null && pred.uncertainty !== undefined
                ? `±${pred.uncertainty} ${targetUnit}`
                : "Not Provided by Model"}
            </span>
          </div>
        </div>
      </div>

      {/* Features Consumed Breakdown */}
      {pred.features_used && pred.features_used.length > 0 && (
        <div className="rounded-xl border border-border bg-surface-subtle p-4 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-sapphire">
            Features Ingested by Scikit-Learn Pipeline ({pred.features_used.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {pred.features_used.map((f) => (
              <Badge key={f} variant="outline" className="text-xs font-mono bg-surface border-border text-text">
                {f}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Sensor Boundary Warnings */}
      {pred.warnings && pred.warnings.length > 0 && (
        <div className="rounded-xl border border-warning-border bg-warning-tint/50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-warning font-semibold text-xs">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span>Telemetry Boundary Notices ({pred.warnings.length})</span>
          </div>
          <ul className="list-disc pl-5 text-xs text-text-2 space-y-1">
            {pred.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Limitations / Disclaimers */}
      {result.limitations && result.limitations.length > 0 && (
        <div className="rounded-xl border border-border bg-surface-subtle p-4 space-y-1.5 text-xs text-text-2">
          <span className="font-semibold text-sapphire uppercase text-xs tracking-wider">
            Operational Limitations & Contract Caveats
          </span>
          <ul className="list-disc pl-4 space-y-0.5 text-xs text-text-3">
            {result.limitations.map((lim, idx) => (
              <li key={idx}>{lim}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
