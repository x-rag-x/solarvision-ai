/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * Trainer-Certified Generalization Metrics Card
 * 
 * STRICT COMPLIANCE:
 * - Renders ONLY metrics provided by trainer handoff metadata.
 * - Displays MAE, RMSE, and R² if provided by trainer contract.
 * - If metrics are not yet delivered, displays honest pending status.
 */

import React from "react";
import {
  Award,
  CheckCircle2,
  Clock,
  HelpCircle,
  Percent,
  Scale,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { TrainerEvaluationMetrics } from "../types";

interface ModelEvaluationSectionProps {
  metrics: TrainerEvaluationMetrics | null;
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
    <Card className="rounded-xl border border-border bg-surface p-6 shadow-xs sm:p-7 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-sapphire">
              Regression Benchmarks & Accuracy
            </span>
            <Badge className="bg-surface-subtle text-text-2 border border-border text-xs font-mono">
              Held-Out Test Partition
            </Badge>
          </div>
          <h3 className="mt-1 text-lg font-bold tracking-tight text-sapphire">
            Model Evaluation & Generalization Metrics
          </h3>
          <p className="text-xs text-text-3 mt-0.5">
            Real trainer-certified metrics strictly enforced. No claims of model accuracy are made without empirical trainer handoff.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasMetrics ? (
            <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-mono">
              TRAINER_CERTIFIED_METRICS
            </Badge>
          ) : (
            <Badge className="bg-warning-tint text-warning border-warning-border text-xs font-mono">
              AWAITING_TRAINER_METRICS
            </Badge>
          )}
        </div>
      </div>

      {!hasMetrics ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-subtle p-8 text-center space-y-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-surface text-sapphire border border-border mx-auto shadow-xs">
            <Scale className="h-6 w-6" />
          </div>
          <h4 className="text-base font-bold text-sapphire">
            Evaluation Metrics Pending Trainer Delivery
          </h4>
          <p className="text-xs text-text-2 max-w-lg mx-auto leading-relaxed">
            In accordance with SolarVision AI engineering integrity rules, MAE, RMSE, and R² metrics are rendered exclusively from validated held-out test evaluations conducted by the model training lead.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-text-3 font-mono">
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
          <div className="rounded-xl border border-border bg-surface-subtle p-4">
            <span className="text-text-3 text-xs font-semibold uppercase tracking-wider">
              Mean Absolute Error (MAE)
            </span>
            <p className="mt-2 text-2xl font-bold font-mono text-sapphire">
              {metrics?.mae !== undefined ? metrics.mae.toFixed(4) : "—"}
            </p>
            <p className="text-xs text-text-3 mt-1">Average absolute prediction deviation</p>
          </div>

          {/* RMSE */}
          <div className="rounded-xl border border-border bg-surface-subtle p-4">
            <span className="text-text-3 text-xs font-semibold uppercase tracking-wider">
              Root Mean Squared Error (RMSE)
            </span>
            <p className="mt-2 text-2xl font-bold font-mono text-sapphire">
              {metrics?.rmse !== undefined ? metrics.rmse.toFixed(4) : "—"}
            </p>
            <p className="text-xs text-text-3 mt-1">Sensitivity to large telemetry outliers</p>
          </div>

          {/* R² Score */}
          <div className="rounded-xl border border-border bg-surface-subtle p-4">
            <span className="text-text-3 text-xs font-semibold uppercase tracking-wider">
              R² Determination
            </span>
            <p className="mt-2 text-2xl font-bold font-mono text-sapphire">
              {metrics?.r2 !== undefined ? metrics.r2.toFixed(4) : "—"}
            </p>
            <p className="text-xs text-text-3 mt-1">Proportion of variance explained</p>
          </div>

          {/* Test Samples */}
          <div className="rounded-xl border border-border bg-surface-subtle p-4">
            <span className="text-text-3 text-xs font-semibold uppercase tracking-wider">
              Held-Out Test N
            </span>
            <p className="mt-2 text-2xl font-bold font-mono text-sapphire">
              {metrics?.heldOutTestSamples !== undefined ? metrics.heldOutTestSamples : "—"}
            </p>
            <p className="text-xs text-text-3 mt-1">Independent evaluation observations</p>
          </div>
        </div>
      )}
    </Card>
  );
}
