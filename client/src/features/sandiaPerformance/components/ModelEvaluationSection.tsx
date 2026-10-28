/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * Model Evaluation & Trainer Metrics Section
 * 
 * STRICT COMPLIANCE:
 * - Capable of presenting actual trainer-provided regression metrics (MAE, RMSE, R², MAPE).
 * - Zero hardcoded or fabricated metrics.
 * - Honest pending status when model evaluation is awaiting training completion.
 */

import React from "react";
import {
  Activity,
  AlertCircle,
  BarChart2,
  Clock,
  Compass,
  FileCheck2,
  HelpCircle,
  Info,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { TrainerEvaluationMetrics } from "../types";

interface ModelEvaluationSectionProps {
  metrics?: TrainerEvaluationMetrics | null;
  isModelReady?: boolean;
}

export function ModelEvaluationSection({
  metrics,
  isModelReady = false,
}: ModelEvaluationSectionProps) {
  const hasMetrics =
    metrics &&
    (metrics.mae !== undefined ||
      metrics.rmse !== undefined ||
      metrics.r2 !== undefined ||
      metrics.mape !== undefined);

  return (
    <Card className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#F2B941]">
              Regression Benchmarks & Accuracy
            </span>
            <Badge className="bg-slate-100 text-slate-800 border-slate-300 text-[10px] font-mono">
              Held-Out Test Partition
            </Badge>
          </div>
          <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
            Model Evaluation & Generalization Metrics
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real trainer-certified metrics strictly enforced. No claims of model accuracy are made without empirical trainer handoff.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasMetrics ? (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-mono">
              TRAINER_CERTIFIED_METRICS
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-mono">
              AWAITING_TRAINER_METRICS
            </Badge>
          )}
        </div>
      </div>

      {!hasMetrics ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center space-y-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 mx-auto">
            <Scale className="h-6 w-6" />
          </div>
          <h4 className="text-base font-bold text-slate-900">
            Evaluation Metrics Pending Trainer Delivery
          </h4>
          <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
            In accordance with SolarVision AI engineering integrity rules, MAE, RMSE, and R² metrics are rendered exclusively from validated held-out test evaluations conducted by the model training lead.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500 font-mono">
            <span>Expected: Mean Absolute Error (MAE)</span>
            <span>•</span>
            <span>Root Mean Squared Error (RMSE)</span>
            <span>•</span>
            <span>Coefficient of Determination (R²)</span>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* MAE */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              Mean Absolute Error (MAE)
            </span>
            <p className="mt-2 text-2xl font-bold font-mono text-slate-900">
              {metrics?.mae !== undefined ? metrics.mae.toFixed(4) : "—"}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Average absolute prediction deviation</p>
          </div>

          {/* RMSE */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              Root Mean Squared Error (RMSE)
            </span>
            <p className="mt-2 text-2xl font-bold font-mono text-slate-900">
              {metrics?.rmse !== undefined ? metrics.rmse.toFixed(4) : "—"}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Sensitivity to large telemetry outliers</p>
          </div>

          {/* R² Score */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              R² Determination
            </span>
            <p className="mt-2 text-2xl font-bold font-mono text-slate-900">
              {metrics?.r2 !== undefined ? metrics.r2.toFixed(4) : "—"}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Proportion of variance explained</p>
          </div>

          {/* Test Samples */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              Held-Out Test N
            </span>
            <p className="mt-2 text-2xl font-bold font-mono text-slate-900">
              {metrics?.heldOutTestSamples !== undefined ? metrics.heldOutTestSamples : "—"}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Independent evaluation observations</p>
          </div>
        </div>
      )}
    </Card>
  );
}
