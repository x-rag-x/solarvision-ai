/**
 * SolarVision AI — Phase 3: Probable Cause Results Component
 * 
 * Renders multiple ranked candidate causes returned strictly by Model 2.
 * 
 * STRICT COMPLIANCE:
 * - Does not invent artificial predictions or illustrative percentages.
 * - Only renders candidate causes when delivered by a real, validated API.
 * - Displays confidence, causal category, evidence breakdown, and recommended corrective actions.
 */

import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  Droplets,
  ExternalLink,
  Flame,
  HelpCircle,
  Lightbulb,
  ShieldCheck,
  Sliders,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CandidateCause, CauseCategory, RootCausePrediction } from "../types";

export interface ProbableCauseResultsProps {
  prediction: RootCausePrediction | null;
  onVerifyFeedback?: (predictionId: string, status: "verified" | "dismissed", notes?: string) => void;
}

export function ProbableCauseResults({
  prediction,
  onVerifyFeedback,
}: ProbableCauseResultsProps) {
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, "verified" | "dismissed">>({});

  if (!prediction || prediction.candidateCauses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
          <Compass className="h-6 w-6" />
        </div>
        <h4 className="mt-3 text-sm font-semibold text-slate-800">
          No Root Cause Prediction Generated
        </h4>
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
          Execute root cause diagnosis on the active inspection to evaluate causal hypotheses
          against multi-sensor telemetry.
        </p>
      </div>
    );
  }

  const handleFeedback = (causeCode: string, status: "verified" | "dismissed") => {
    setFeedbackGiven((prev) => ({ ...prev, [causeCode]: status }));
    if (onVerifyFeedback) {
      onVerifyFeedback(prediction.predictionId, status, `User feedback on cause: ${causeCode}`);
    }
  };

  const getCategoryIcon = (category: CauseCategory) => {
    switch (category) {
      case "equipment":
        return <Wrench className="h-3.5 w-3.5 text-blue-600" />;
      case "process":
        return <Sliders className="h-3.5 w-3.5 text-[#F2B941]" />;
      case "material":
        return <Droplets className="h-3.5 w-3.5 text-purple-600" />;
      case "environment":
        return <Flame className="h-3.5 w-3.5 text-rose-600" />;
      default:
        return <Compass className="h-3.5 w-3.5 text-slate-600" />;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "critical":
        return "bg-rose-100 text-rose-800 border-rose-300";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "low":
        return "bg-slate-100 text-slate-700 border-slate-300";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      {/* Header with Model Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Model 2 Inference Output
          </span>
          <h3 className="text-sm font-bold text-slate-900">
            Probable Root Cause Etiology ({prediction.candidateCauses.length} Ranked Hypotheses)
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
            {prediction.inferenceTimeMs}ms inference
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            v{prediction.modelVersionId}
          </span>
        </div>
      </div>

      {/* Candidate Causes List */}
      <div className="space-y-4">
        {prediction.candidateCauses.map((candidate) => {
          const confPct = Math.round(candidate.confidence * 100);
          const feedback = feedbackGiven[candidate.causeCode];

          return (
            <div
              key={candidate.causeCode}
              className={`rounded-xl border p-4.5 transition-all ${
                candidate.rank === 1
                  ? "border-[#F2B941] bg-[#FFFDF5] shadow-[0_4px_16px_rgba(242,185,65,0.08)]"
                  : "border-slate-200 bg-white"
              }`}
            >
              {/* Top Bar: Rank, Title, Confidence Meter */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-xs font-black ${
                      candidate.rank === 1
                        ? "bg-[#F2B941] text-slate-950 shadow-sm"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    #{candidate.rank}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {candidate.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 capitalize">
                        {getCategoryIcon(candidate.category)}
                        {candidate.category} factor
                      </span>
                      <span
                        className={`rounded border px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${getUrgencyBadge(
                          candidate.urgency
                        )}`}
                      >
                        {candidate.urgency} urgency
                      </span>
                    </div>
                  </div>
                </div>

                {/* Validated Confidence Display */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-base font-black text-slate-900">{confPct}%</span>
                    <p className="text-[10px] text-slate-400 font-medium">Model Probability</p>
                  </div>
                  <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        confPct >= 70
                          ? "bg-[#087e6d]"
                          : confPct >= 40
                          ? "bg-[#F2B941]"
                          : "bg-slate-400"
                      }`}
                      style={{ width: `${confPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Summary Description */}
              <p className="mt-3 text-xs leading-relaxed text-slate-700">
                {candidate.summary}
              </p>

              {/* Contributing Evidence Factors */}
              {candidate.evidence.length > 0 && (
                <div className="mt-3 rounded-lg border border-slate-200/80 bg-white/90 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Supporting Telemetric & Defect Evidence
                  </p>
                  <div className="mt-2 space-y-2">
                    {candidate.evidence.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-1 border-b border-slate-100 pb-1.5 last:border-0 last:pb-0"
                      >
                        <div>
                          <span className="font-semibold text-slate-800">{ev.factorName}: </span>
                          <span className="text-slate-600">{ev.description}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono">
                          <span className="text-slate-500">Obs:</span>
                          <span className="font-bold text-slate-900">
                            {ev.observedValue} {ev.unit || ""}
                          </span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-500">Base:</span>
                          <span className="text-slate-700">
                            {ev.expectedBaseline} {ev.unit || ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Engineering Action */}
              <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <Lightbulb className="h-4 w-4 text-[#F2B941] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                    Corrective Recommendation
                  </p>
                  <p className="mt-0.5 text-xs text-slate-800">
                    {candidate.recommendedAction}
                  </p>
                </div>
              </div>

              {/* Validation / Feedback Action */}
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  Process Engineer Feedback:
                </span>
                {feedback ? (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold ${
                      feedback === "verified" ? "text-[#087e6d]" : "text-slate-500"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {feedback === "verified" ? "Confirmed Root Cause" : "Dismissed by Operator"}
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFeedback(candidate.causeCode, "verified")}
                      className="h-7 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                    >
                      <Check className="mr-1 h-3 w-3 text-emerald-600" />
                      Confirm Cause
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFeedback(candidate.causeCode, "dismissed")}
                      className="h-7 text-xs border-slate-300 text-slate-600 hover:bg-slate-100"
                    >
                      <X className="mr-1 h-3 w-3 text-slate-400" />
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
