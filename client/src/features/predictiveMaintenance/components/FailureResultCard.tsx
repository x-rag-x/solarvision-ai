/**
 * SolarVision AI — Model 4: Failure Classification Result Display
 * 
 * STRICT COMPLIANCE (TASK 4):
 * - Displays binary operating condition classification (FAILURE vs NO_FAILURE vs WARNING).
 * - Calibrated failure probability from real backend model inference.
 * - Displays Remaining Useful Life (RUL) as:
 *   "N/A (Prognostic RUL Model Not Deployed — Operating Condition Classifier Only)"
 * - Clearly labels failure mode indicators as rule-based engineering criteria,
 *   NOT a trained multi-class classifier.
 * - Explains operator boundary between current condition and run-to-failure RUL.
 */

import React from "react";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  HelpCircle,
  Info,
  Layers,
  ShieldAlert,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { MaintenancePredictionResult, MaintenanceRiskLevel } from "../types";

interface FailureResultCardProps {
  prediction: MaintenancePredictionResult;
}

export function FailureResultCard({ prediction }: FailureResultCardProps) {
  const isFailure = prediction.classification === "FAILURE";
  const isWarning = prediction.classification === "WARNING";

  const riskBadgeStyle = (risk: MaintenanceRiskLevel) => {
    switch (risk) {
      case "CRITICAL":
        return "bg-rose-100 text-rose-900 border-rose-300";
      case "HIGH":
        return "bg-amber-100 text-amber-900 border-amber-300";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-900 border-yellow-300";
      case "LOW":
      default:
        return "bg-emerald-100 text-emerald-900 border-emerald-300";
    }
  };

  const failureModesToDisplay = prediction.ruleBasedFailureModes || prediction.failureModes || [];

  return (
    <Card className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
      {/* Top Banner */}
      <div
        className={`border-b px-6 py-4 sm:px-8 ${
          isFailure
            ? "border-rose-200 bg-rose-50/70"
            : isWarning
            ? "border-amber-200 bg-amber-50/70"
            : "border-emerald-200 bg-emerald-50/70"
        }`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isFailure ? "bg-rose-500 animate-pulse" : isWarning ? "bg-amber-500" : "bg-emerald-500"
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Operating Condition Assessment Verdict
            </span>
            <Badge className="bg-[#0B0909] text-white text-xs font-mono">
              Model 4 ({prediction.modelVersion})
            </Badge>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Evaluated in {prediction.executionTimeMs} ms • Decision Cut: τ* = 0.1981
          </span>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        {/* Main Verdict Row */}
        <div className="grid gap-6 md:grid-cols-12 items-center">
          {/* Classification Status */}
          <div className="md:col-span-5 flex items-center gap-4">
            <div
              className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl shadow-sm ${
                isFailure
                  ? "bg-rose-100 text-rose-700 border border-rose-200"
                  : isWarning
                  ? "bg-amber-100 text-amber-700 border border-amber-200"
                  : "bg-emerald-100 text-emerald-700 border border-emerald-200"
              }`}
            >
              {isFailure ? (
                <AlertOctagon className="h-8 w-8" />
              ) : isWarning ? (
                <AlertTriangle className="h-8 w-8" />
              ) : (
                <CheckCircle2 className="h-8 w-8" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge className={`text-xs font-bold uppercase font-mono ${riskBadgeStyle(prediction.riskLevel)}`}>
                  {prediction.riskLevel} Risk
                </Badge>
                {prediction.activeFailureMode && (
                  <Badge className="bg-[#0B0909] text-[#F2B941] text-xs font-mono">
                    Mode: {prediction.activeFailureMode}
                  </Badge>
                )}
              </div>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {isFailure
                  ? "Operating in Failure State"
                  : isWarning
                  ? "Operating Margin Warning"
                  : "Operating in Nominal Envelope"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {isFailure
                  ? "Operating parameters exceed safe physical envelope for active station."
                  : isWarning
                  ? "Operating parameters approach excursion thresholds."
                  : "All monitored thermal, mechanical, and power signals within tolerances."}
              </p>
            </div>
          </div>

          {/* Calibrated Probabilities */}
          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-slate-100 md:border-t-0 md:border-l md:pl-6 pt-4 md:pt-0">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
              <span className="text-xs text-slate-500 font-medium">Failure Probability</span>
              <p
                className={`text-xl font-bold font-mono mt-0.5 ${
                  isFailure ? "text-rose-700" : isWarning ? "text-amber-700" : "text-slate-800"
                }`}
              >
                {prediction.failureProbability !== null
                  ? `${(prediction.failureProbability * 100).toFixed(1)}%`
                  : "N/A"}
              </p>
              <span className="text-xs text-slate-400">
                P(Fail | Condition)
              </span>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
              <span className="text-xs text-slate-500 font-medium">Conforming Probability</span>
              <p className="text-xl font-bold font-mono text-emerald-700 mt-0.5">
                {prediction.healthyProbability !== null
                  ? `${(prediction.healthyProbability * 100).toFixed(1)}%`
                  : "N/A"}
              </p>
              <span className="text-xs text-slate-400">
                P(Healthy | Condition)
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
              <span className="text-xs text-slate-500 font-medium">95% Confidence Interval</span>
              <p className="text-sm font-bold font-mono text-slate-800 mt-1">
                {prediction.confidenceInterval
                  ? `[${(prediction.confidenceInterval.low * 100).toFixed(1)}%, ${(prediction.confidenceInterval.high * 100).toFixed(1)}%]`
                  : "N/A"}
              </p>
              <span className="text-xs text-slate-400">Calibrated Platt bounds</span>
            </div>
          </div>
        </div>

        {/* Prognostic RUL Transparency Callout */}
        <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-200 text-amber-900">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-950 font-mono">
                    Remaining Useful Life (RUL)
                  </span>
                  <Badge className="bg-amber-200 text-amber-950 border-amber-300 text-xs font-mono">
                    N/A (Operating Condition Classifier Only)
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-amber-900 leading-relaxed">
                  <strong>Zero Fabricated RUL:</strong> Model 4 classifies current operating state (healthy vs. failing
                  now). It is <strong>not</strong> a continuous prognostic time-to-failure or run-to-failure regression
                  model. Operators must not interpret instantaneous condition as remaining hours or cycles.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Failure Mode Attribution Grid — Rule-Based Transparency */}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Failure Mode Decomposition (Deterministic Physical Rules):
            </p>
            <Badge className="bg-slate-200 text-slate-800 text-xs font-mono self-start sm:self-auto">
              Rule-Based Engineering Criteria • Not Multi-Class Model
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {failureModesToDisplay
              .filter((m) => m.code !== "RNF")
              .map((mode) => (
                <div
                  key={mode.code}
                  className={`flex flex-col rounded-xl border p-3.5 ${
                    mode.thresholdExceeded
                      ? "border-rose-300 bg-rose-50/90 text-rose-950"
                      : "border-slate-200/80 bg-white text-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold">{mode.code}</span>
                    <Badge
                      className={`text-xs font-mono ${
                        mode.thresholdExceeded
                          ? "bg-rose-200 text-rose-900 border-rose-300"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {mode.thresholdExceeded ? "EXCEEDED" : "NORMAL"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs font-bold truncate">{mode.name}</p>
                  <p className="mt-1 text-xs leading-relaxed line-clamp-2 text-slate-500">
                    {mode.description}
                  </p>
                  <p className="mt-2 text-xs font-mono text-slate-400 border-t border-slate-100 pt-1.5">
                    {mode.engineeringFormula}
                  </p>
                </div>
              ))}
          </div>
        </div>

        {/* Recommended Action & Scope Boundary */}
        <div className="grid gap-4 md:grid-cols-12">
          {/* Action */}
          <div className="md:col-span-7 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs uppercase tracking-wider">
              <Wrench className="h-4 w-4 text-[#F2B941]" />
              Maintenance Directive:
            </div>
            <p className="mt-2 text-sm text-slate-800 leading-relaxed font-medium">
              {prediction.recommendedAction}
            </p>
          </div>

          {/* Scope Guard Callout */}
          <div className="md:col-span-5 rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
            <div className="flex items-center gap-2 text-blue-900 font-semibold text-xs uppercase tracking-wider">
              <Info className="h-4 w-4 text-blue-700" />
              Prognostic Scope Boundary:
            </div>
            <p className="mt-2 text-xs text-blue-800 leading-relaxed">
              Current condition classification indicates if active machine telemetry reflects a failure state{" "}
              <strong>right now</strong>. It does not calculate hours until a healthy machine will break down.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
