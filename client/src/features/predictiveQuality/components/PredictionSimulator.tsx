/**
 * SolarVision AI — Model 3: Predictive Quality Monitoring
 * Validated UCI SECOM Benchmark Prediction Simulator & Workflow
 */

import React, { useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  Cpu,
  FileText,
  HelpCircle,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { startLogin } from "@/const";
import { runBenchmarkPrediction, PredictiveQualityApiError } from "../api";
import { PRESET_SAMPLE_VECTORS, VERIFIED_BENCHMARK_METADATA } from "../benchmarkData";
import type { BenchmarkPredictionResult, PresetSampleVector, RiskLevel } from "../types";

export function PredictionSimulator() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("preset-nominal-pass");
  const [featureInputText, setFeatureInputText] = useState<string>(() => {
    const defaultPreset = PRESET_SAMPLE_VECTORS[0];
    return JSON.stringify(defaultPreset.features);
  });
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<BenchmarkPredictionResult | null>(null);
  const [error, setError] = useState<{
    message: string;
    code: string;
    details?: string;
  } | null>(null);

  // Compute live feature count for user guidance
  const currentFeatureCount = React.useMemo(() => {
    try {
      const parsed = JSON.parse(featureInputText.trim());
      if (Array.isArray(parsed)) return parsed.length;
    } catch {
      // Try CSV parsing
      const items = featureInputText.split(/[\s,]+/).filter(Boolean);
      return items.length;
    }
    return 0;
  }, [featureInputText]);

  const handleSelectPreset = (preset: PresetSampleVector) => {
    setSelectedPresetId(preset.id);
    setIsCustomMode(false);
    setFeatureInputText(JSON.stringify(preset.features));
    setError(null);
  };

  const handleExecutePrediction = async () => {
    setLoading(true);
    setError(null);

    try {
      let vector: number[] = [];
      try {
        const parsed = JSON.parse(featureInputText.trim());
        if (Array.isArray(parsed)) {
          vector = parsed.map(Number);
        } else {
          throw new Error("Input must be a JSON array of 590 numbers.");
        }
      } catch {
        // Fallback to comma/whitespace separated parsing
        const items = featureInputText.split(/[\s,]+/).filter(Boolean);
        vector = items.map(Number);
      }

      // Execute authenticated benchmark inference
      const result = await runBenchmarkPrediction(vector);
      setPrediction(result);
    } catch (err: any) {
      if (err instanceof PredictiveQualityApiError) {
        setError({
          message: err.message,
          code: err.code,
          details: err.details,
        });
      } else {
        setError({
          message: err.message || "An unexpected error occurred during benchmark prediction.",
          code: "INFERENCE_FAILED",
        });
      }
      setPrediction(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerDimensionError = () => {
    setIsCustomMode(true);
    // Supply 50 features instead of 590 to demonstrate dimensional safety validation
    const invalidVector = new Array(50).fill(0.5);
    setFeatureInputText(JSON.stringify(invalidVector));
    setError(null);
  };

  const riskBadgeColor = (risk: RiskLevel) => {
    switch (risk) {
      case "CRITICAL":
        return "bg-rose-100 text-rose-800 border-rose-300";
      case "HIGH":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "LOW":
      default:
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#0B0909] text-[#F2B941]">
                <Cpu className="h-4 w-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 sm:text-lg">
                UCI SECOM Benchmark Prediction Workflow
              </h3>
              <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-xs font-mono">
                Domain Isolated
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Submit a validated 590-feature in-situ measurement vector to evaluate yield excursion risk.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-mono">
              Vector Size: <span className={currentFeatureCount === 590 ? "font-bold text-emerald-700" : "font-bold text-rose-700"}>{currentFeatureCount}</span> / 590
            </span>
          </div>
        </div>

        {/* Preset Selector Buttons */}
        <div className="mt-6 border-t border-slate-100 pt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Select Verified Preset Wafer Run:
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {PRESET_SAMPLE_VECTORS.map((preset) => {
              const active = !isCustomMode && selectedPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`flex flex-col rounded-2xl border p-4 text-left transition-all ${
                    active
                      ? "border-[#0B0909] bg-[#0B0909] text-white shadow-md"
                      : "border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 hover:bg-slate-100/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${active ? "text-[#F2B941]" : "text-slate-500"}`}>
                      {preset.tag}
                    </span>
                    <Badge
                      className={`text-xs font-mono uppercase ${
                        preset.expectedOutcome === "FAIL"
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      }`}
                    >
                      Exp: {preset.expectedOutcome}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-bold truncate">{preset.name}</p>
                  <p className={`mt-1 text-xs leading-relaxed line-clamp-2 ${active ? "text-slate-300" : "text-slate-500"}`}>
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => setIsCustomMode(true)}
              className={`text-xs font-semibold ${isCustomMode ? "text-[#0B0909] underline" : "text-slate-500 hover:text-slate-900"}`}
            >
              Custom 590-Dimensional Input Vector
            </button>
            <button
              onClick={handleTriggerDimensionError}
              className="text-xs text-slate-400 hover:text-rose-600 underline"
            >
              Test Dimension Mismatch (Send 50 Features)
            </button>
          </div>
        </div>

        {/* Custom Input Textarea (Collapsible / Editable) */}
        {isCustomMode && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-2">
              <span>Raw Vector Payload (JSON Array or Comma-separated)</span>
              <span className={`font-mono text-xs ${currentFeatureCount === 590 ? "text-emerald-700" : "text-rose-600"}`}>
                {currentFeatureCount === 590 ? "✓ 590 signals present" : `⚠ ${currentFeatureCount} signals (590 required)`}
              </span>
            </div>
            <Textarea
              value={featureInputText}
              onChange={(e) => setFeatureInputText(e.target.value)}
              rows={4}
              className="font-mono text-xs text-slate-800 bg-white"
              placeholder="[0.245, -1.02, 0.05, ... exactly 590 numbers]"
            />
          </div>
        )}

        {/* Action Button */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            onClick={handleExecutePrediction}
            disabled={loading}
            className="h-11 gap-2 rounded-xl bg-[#0B0909] px-6 text-xs font-semibold text-white shadow-md hover:bg-slate-800"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[#F2B941]" />
                Evaluating Benchmark Inference...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 text-[#F2B941]" />
                Run Benchmark Inference
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => handleSelectPreset(PRESET_SAMPLE_VECTORS[0])}
            disabled={loading}
            className="h-11 gap-2 rounded-xl border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
            Reset to Sample #001
          </Button>
        </div>
      </Card>

      {/* Error Banners */}
      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-50/80 p-5 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-800 font-mono">
                  {error.code}
                </span>
                <Badge className="bg-rose-200 text-rose-900 border-rose-300 text-xs">
                  Rejected
                </Badge>
              </div>
              <h4 className="mt-1 text-sm font-bold text-rose-950">{error.message}</h4>
              {error.details && (
                <p className="mt-1 text-xs text-rose-800 font-mono bg-rose-100/60 rounded p-1.5 inline-block">
                  {error.details}
                </p>
              )}

              {error.code === "UNAUTHORIZED" && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    onClick={() => startLogin()}
                    className="rounded-xl bg-rose-900 text-white text-xs hover:bg-rose-800"
                  >
                    Re-authenticate Operator Session
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Real Prediction Results Output */}
      {prediction && !error && (
        <Card className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4 sm:px-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Verified Prediction Output
                </span>
                <Badge className="bg-slate-200 text-slate-800 text-xs font-mono">
                  {prediction.modelVersion}
                </Badge>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Computed in {prediction.executionTimeMs} ms • Decision Threshold τ = {prediction.thresholdUsed}
              </span>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Top Verdict Panel */}
            <div className="grid gap-6 md:grid-cols-12 items-center">
              <div className="md:col-span-5 flex items-center gap-4">
                <div
                  className={`grid h-16 w-16 place-items-center rounded-2xl shadow-sm ${
                    prediction.outcome === "FAIL"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {prediction.outcome === "FAIL" ? (
                    <XCircle className="h-8 w-8" />
                  ) : (
                    <CheckCircle2 className="h-8 w-8" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Wafer Verdict
                    </span>
                    <Badge className={riskBadgeColor(prediction.riskLevel)}>
                      {prediction.riskLevel} RISK
                    </Badge>
                  </div>
                  <h3
                    className={`text-2xl font-black tracking-tight ${
                      prediction.outcome === "FAIL" ? "text-rose-700" : "text-emerald-700"
                    }`}
                  >
                    {prediction.outcome === "FAIL" ? "FAIL (SCRAP EXCURSION)" : "PASS (CONFORMING)"}
                  </h3>
                </div>
              </div>

              {/* Probabilities Breakdown */}
              <div className="md:col-span-7 grid grid-cols-2 gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div>
                  <span className="text-xs font-medium text-slate-500">Excursion Probability P(Fail)</span>
                  <p className="mt-1 text-2xl font-bold font-mono text-slate-900">
                    {(prediction.probabilityFail * 100).toFixed(2)}%
                  </p>
                  <p className="text-xs text-slate-400">
                    CI: [{(prediction.confidenceInterval.low * 100).toFixed(1)}%, {(prediction.confidenceInterval.high * 100).toFixed(1)}%]
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500">Conforming Probability P(Pass)</span>
                  <p className="mt-1 text-2xl font-bold font-mono text-slate-900">
                    {(prediction.probabilityPass * 100).toFixed(2)}%
                  </p>
                  <p className="text-xs text-slate-400">
                    Probability sum = 1.0 (calibrated)
                  </p>
                </div>
              </div>
            </div>

            {/* Threshold Calibration Notice */}
            <div className="rounded-2xl border border-slate-200/90 bg-amber-50/40 p-3.5 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Threshold Calibration Logic:</span> The SECOM semiconductor benchmark dataset has a 6.64% baseline fail rate (14:1 class imbalance). To prevent catastrophic false-negative rates, the decision boundary is calibrated to τ = {prediction.thresholdUsed} (7.0%). A posterior failure probability of {(prediction.probabilityFail * 100).toFixed(2)}% triggers an excursion verdict because it exceeds this calibrated 7.0% decision threshold.
            </div>

            {/* Actionable Engineering Recommendation */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#F2B941]" />
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Actionable Automated Guidance:
                  </span>
                  <p className="mt-0.5 text-xs text-slate-800 leading-relaxed font-medium">
                    {prediction.recommendedAction}
                  </p>
                </div>
              </div>
            </div>

            {/* Top Contributing Deviating Features */}
            {prediction.topFeatures && prediction.topFeatures.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Top Deviating In-Situ Sensor Signals:
                </h4>
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden text-xs">
                  {prediction.topFeatures.map((feat) => (
                    <div key={feat.featureIndex} className="flex items-center justify-between p-3 hover:bg-slate-50">
                      <div>
                        <span className="font-semibold text-slate-900">
                          {feat.featureName || `Sensor Channel #${feat.featureIndex}`}
                        </span>
                        <p className="text-xs text-slate-500">{feat.description}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-semibold text-slate-800">
                          Z: {feat.zScore > 0 ? `+${feat.zScore}` : feat.zScore} σ
                        </span>
                        <Badge
                          className={`ml-2 text-xs ${
                            feat.impactDirection === "increases_risk"
                              ? "bg-rose-100 text-rose-800 border-rose-300"
                              : "bg-emerald-100 text-emerald-800 border-emerald-300"
                          }`}
                        >
                          {feat.impactDirection === "increases_risk" ? "+ Risk" : "- Risk"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
