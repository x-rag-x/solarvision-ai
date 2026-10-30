/**
 * SolarVision AI — Model 3: Predictive Quality Monitoring
 * Confusion Matrix Card & Precision/Recall Threshold Tradeoff Visualizer
 */

import React, { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Info,
  Sliders,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VERIFIED_BENCHMARK_METADATA } from "../benchmarkData";

export function ConfusionMatrixCard() {
  const [selectedThreshold, setSelectedThreshold] = useState<"optimal" | "default">("optimal");
  const meta = VERIFIED_BENCHMARK_METADATA;
  const m = meta.metrics;

  // Comparison figures between optimal cost-sensitive threshold (tau = 0.07) and default naive threshold (tau = 0.50)
  const isOptimal = selectedThreshold === "optimal";

  const matrix = isOptimal
    ? {
        tn: m.trueNegatives, // 196
        fp: m.falsePositives, // 31
        fn: m.falseNegatives, // 5
        tp: m.truePositives, // 4
        recall: `${(m.recallFail * 100).toFixed(1)}%`,
        precision: `${(m.precisionFail * 100).toFixed(1)}%`,
        accuracy: `${(m.accuracy * 100).toFixed(1)}%`,
        missedScrapCount: m.falseNegatives,
        escapedYieldLoss: "5 wafers escaped undetected",
      }
    : {
        tn: 227,
        fp: 0,
        fn: 9,
        tp: 0,
        recall: "0.0%",
        precision: "0.0%",
        accuracy: "96.2%",
        missedScrapCount: 9,
        escapedYieldLoss: "All 9 defective wafers escaped (0% detection)",
      };

  return (
    <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 sm:text-lg">
              Held-Out Test Confusion Matrix (N = 236 Wafers)
            </h3>
            <Badge className="bg-slate-100 text-slate-800 text-xs font-mono">
              Chronological Split
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visualizing classification trade-offs between false scrap alarms and undetected defect escapes.
          </p>
        </div>

        {/* Threshold Switcher */}
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/70 p-1 self-start sm:self-auto">
          <button
            onClick={() => setSelectedThreshold("optimal")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              isOptimal
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Optimal Threshold (τ = 0.07)
          </button>
          <button
            onClick={() => setSelectedThreshold("default")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              !isOptimal
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Default Naive (τ = 0.50)
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        {/* 2x2 Matrix Grid */}
        <div className="lg:col-span-7">
          <div className="relative">
            {/* Column & Row Labels */}
            <div className="mb-2 grid grid-cols-2 text-center text-xs font-semibold text-slate-600 pl-16">
              <div>Predicted Conforming (Pass)</div>
              <div className="text-rose-700">Predicted Excursion (Fail)</div>
            </div>

            <div className="flex">
              {/* Vertical Row Headers */}
              <div className="flex w-16 flex-col justify-around text-right pr-3 text-xs font-semibold text-slate-600">
                <div className="leading-tight">Actual Pass</div>
                <div className="leading-tight text-rose-700">Actual Fail</div>
              </div>

              {/* 2x2 Cells */}
              <div className="grid flex-1 grid-cols-2 gap-3">
                {/* Cell 1: True Negative (TN) */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-center transition-all">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
                    <span>True Negative (TN)</span>
                    <span className="font-mono">{((matrix.tn / 236) * 100).toFixed(1)}%</span>
                  </div>
                  <p className="mt-2 text-3xl font-bold font-mono text-emerald-950">
                    {matrix.tn}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Correctly cleared conforming wafers
                  </p>
                </div>

                {/* Cell 2: False Positive (FP) */}
                <div className={`rounded-2xl border p-5 text-center transition-all ${
                  matrix.fp > 0
                    ? "border-amber-200 bg-amber-50/70 text-amber-950"
                    : "border-slate-200 bg-slate-50 text-slate-400"
                }`}>
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
                    <span>False Positive (FP)</span>
                    <span className="font-mono">{((matrix.fp / 236) * 100).toFixed(1)}%</span>
                  </div>
                  <p className="mt-2 text-3xl font-bold font-mono text-amber-950">
                    {matrix.fp}
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    False alarms (conforming flagged for review)
                  </p>
                </div>

                {/* Cell 3: False Negative (FN) - CRITICAL DANGER ZONE */}
                <div className={`rounded-2xl border p-5 text-center transition-all ${
                  matrix.fn > 0
                    ? "border-rose-300 bg-rose-50/80 text-rose-950"
                    : "border-slate-200 bg-slate-50 text-slate-400"
                }`}>
                  <div className="flex items-center justify-between text-xs font-semibold text-rose-800">
                    <span className="flex items-center gap-1">
                      False Negative (FN)
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertCircle className="h-3 w-3 text-rose-600" />
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">
                            Defective wafers undetected, risking field failure.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </span>
                    <span className="font-mono">{((matrix.fn / 236) * 100).toFixed(1)}%</span>
                  </div>
                  <p className="mt-2 text-3xl font-bold font-mono text-rose-950">
                    {matrix.fn}
                  </p>
                  <p className="mt-1 text-xs text-rose-700 font-medium">
                    Escaped defects (missed scrap)
                  </p>
                </div>

                {/* Cell 4: True Positive (TP) */}
                <div className={`rounded-2xl border p-5 text-center transition-all ${
                  matrix.tp > 0
                    ? "border-emerald-300 bg-emerald-100/70 text-emerald-950"
                    : "border-slate-200 bg-slate-50 text-slate-400"
                }`}>
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
                    <span>True Positive (TP)</span>
                    <span className="font-mono">{((matrix.tp / 236) * 100).toFixed(1)}%</span>
                  </div>
                  <p className="mt-2 text-3xl font-bold font-mono text-emerald-950">
                    {matrix.tp}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Correctly intercepted yield excursions
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Analytical Explanation & Pitfalls */}
        <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-5 lg:col-span-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Info className="h-4 w-4 text-[#F2B941]" />
              <span>Operational Yield Impact</span>
            </div>

            <div className="mt-4 space-y-2.5 text-xs text-slate-600 leading-relaxed">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="font-medium text-slate-700">Failure Recall (Defects Caught):</span>
                <span className={`font-mono font-bold ${isOptimal ? "text-emerald-700" : "text-rose-700"}`}>
                  {matrix.recall}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="font-medium text-slate-700">Precision (True In Excursions):</span>
                <span className="font-mono font-bold text-slate-900">{matrix.precision}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="font-medium text-slate-700">Overall Raw Accuracy:</span>
                <span className="font-mono font-bold text-slate-900">{matrix.accuracy}</span>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-700">
              {isOptimal ? (
                <p>
                  <span className="font-semibold text-emerald-800">Cost-Sensitive Optimization:</span> Setting τ* = 0.07 detects 4 of 9 failure events ({matrix.recall} recall), preventing defective wafers from escaping into module assembly at the expense of 31 inspection alerts.
                </p>
              ) : (
                <p>
                  <span className="font-semibold text-rose-800">The Accuracy Fallacy:</span> At default τ = 0.50, raw accuracy appears deceptively high (96.2%), yet <span className="font-bold underline text-rose-700">zero defects are intercepted</span> (0.0% recall). This demonstrates why standard accuracy is dangerous in manufacturing quality control.
                </p>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-400">
            Source: Chronological held-out evaluation on 236 continuous manufacturing runs.
          </div>
        </div>
      </div>
    </Card>
  );
}
