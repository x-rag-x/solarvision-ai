/**
 * SolarVision AI — Model 3: Predictive Quality & Performance Monitoring
 * Main Integrated Industrial Dashboard Overview
 * 
 * Supports both:
 * 1. Primary: Sandia Solar Electrical Performance Prediction (Default Model 3 View)
 * 2. Secondary: UCI SECOM process quality benchmark & dual-domain validation
 * 
 * Strictly preserves SECOM functionality while establishing Sandia as the primary Model 3 operational view.
 */

import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  Award,
  BarChart3,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  Flame,
  HelpCircle,
  Layers,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sun,
  XCircle,
  Zap,
} from "lucide-react";
import { AuthGuard } from "@/components/solarvision/AuthGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { BenchmarkEvaluationCard } from "./components/BenchmarkEvaluationCard";
import { ConfusionMatrixCard } from "./components/ConfusionMatrixCard";
import { DualDomainStatusBanner } from "./components/DualDomainStatusBanner";
import { PredictionSimulator } from "./components/PredictionSimulator";
import { SolarReadinessPanel } from "./components/SolarReadinessPanel";
import { SandiaPerformanceDashboard } from "../sandiaPerformance";
import type { ActiveTab } from "./types";

export type Model3Mode = "sandia_performance" | "secom_benchmark";

export function PredictiveQualityOverview() {
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState<ActiveTab>("benchmark");
  // Sandia Solar Electrical Performance is the primary default Model 3 view
  const [modelMode, setModelMode] = useState<Model3Mode>("sandia_performance");

  // Synchronize mode from route or query params if explicitly requested
  useEffect(() => {
    if (
      location.includes("secom") ||
      (typeof window !== "undefined" && window.location.search.includes("mode=secom"))
    ) {
      setModelMode("secom_benchmark");
    } else if (
      location.includes("sandia") ||
      (typeof window !== "undefined" && window.location.search.includes("mode=sandia"))
    ) {
      setModelMode("sandia_performance");
    }
  }, [location]);

  return (
    <AuthGuard
      title="Authentication required for predictive quality operations"
      description="Access to Model 3 predictive quality forecasting, in-situ sensor metrology, and factory yield risk models is strictly restricted to authenticated operators and quality engineers."
    >
      <div className="space-y-8">
        {/* Page Top Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F2B941]">
                Quality Operations / M3
              </span>
              <Badge className="bg-[#0B0909] text-white text-[10px] font-mono">
                Model 3 Predictive Operations
              </Badge>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {modelMode === "sandia_performance"
                ? "Solar Electrical Performance Prediction"
                : "Predictive Quality Monitoring"}
            </h1>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              {modelMode === "sandia_performance"
                ? "Calibrated environmental sensor telemetry modeling, IV curve prediction, and Sandia National Laboratories dataset integration."
                : "In-situ process telemetry modeling, multi-sensor yield excursion prediction, and dual-domain validation."}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {modelMode === "sandia_performance" ? (
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[#F2B941]" />
                <span className="font-semibold text-slate-900">Sandia PSEL Primary</span>
                <span className="mx-1 text-slate-300">•</span>
                <span className="font-mono text-[11px] text-slate-500">Contract v1.0.0</span>
                <span className="mx-1 text-slate-300">•</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-emerald-700 font-medium">Pipeline Verified</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Benchmark Ready</span>
                <span className="mx-1 text-slate-300">•</span>
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span>Solar Not Trained</span>
              </div>
            )}
          </div>
        </div>

        {/* Dual Mode Switcher: Sandia FIRST on left, UCI SECOM SECOND on right */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {/* OPTION 1: Sandia Solar Electrical Performance (Primary Default) */}
          <button
            type="button"
            data-testid="mode-tab-sandia"
            onClick={() => setModelMode("sandia_performance")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer",
              modelMode === "sandia_performance"
                ? "bg-[#0B0909] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <Zap
              className={cn(
                "h-4 w-4",
                modelMode === "sandia_performance" ? "text-[#F2B941]" : "text-amber-500"
              )}
            />
            Sandia Solar Electrical Performance
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-mono",
                modelMode === "sandia_performance"
                  ? "bg-white/20 text-[#F2B941]"
                  : "bg-amber-100 text-amber-800"
              )}
            >
              Primary Model 3
            </span>
          </button>

          {/* OPTION 2: UCI SECOM Process Benchmark (Secondary Tab) */}
          <button
            type="button"
            data-testid="mode-tab-secom"
            onClick={() => setModelMode("secom_benchmark")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer",
              modelMode === "secom_benchmark"
                ? "bg-[#0B0909] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <Cpu
              className={cn(
                "h-4 w-4",
                modelMode === "secom_benchmark" ? "text-[#F2B941]" : "text-slate-500"
              )}
            />
            UCI SECOM Process Benchmark
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-mono",
                modelMode === "secom_benchmark"
                  ? "bg-white/20 text-[#F2B941]"
                  : "bg-slate-100 text-slate-700"
              )}
            >
              Secondary Benchmark
            </span>
          </button>
        </div>

        {/* WORKFLOW 1 (Default): Sandia Solar Electrical Performance Prediction */}
        {modelMode === "sandia_performance" && (
          <SandiaPerformanceDashboard />
        )}

        {/* WORKFLOW 2 (Secondary): UCI SECOM Predictive Quality (Preserved 100%) */}
        {modelMode === "secom_benchmark" && (
          <div className="space-y-8">
            {/* Dual Domain Status & Safety Quarantine Notice */}
            <DualDomainStatusBanner />

            {/* Main Dashboard Tabs */}
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as ActiveTab)}>
              <div className="border-b border-slate-200">
                <TabsList className="h-12 w-full justify-start rounded-none bg-transparent p-0 gap-2 sm:gap-6 overflow-x-auto">
                  <TabsTrigger
                    value="benchmark"
                    className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-3 sm:px-4 pb-3 pt-2 text-xs font-semibold text-slate-500 transition-all hover:text-slate-900 data-[state=active]:border-[#0B0909] data-[state=active]:text-slate-900 data-[state=active]:shadow-none"
                  >
                    <Cpu className="mr-2 h-4 w-4 text-[#F2B941]" />
                    UCI SECOM Benchmark
                  </TabsTrigger>
                  <TabsTrigger
                    value="prediction"
                    className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-3 sm:px-4 pb-3 pt-2 text-xs font-semibold text-slate-500 transition-all hover:text-slate-900 data-[state=active]:border-[#0B0909] data-[state=active]:text-slate-900 data-[state=active]:shadow-none"
                  >
                    <Play className="mr-2 h-4 w-4 text-emerald-600" />
                    Benchmark Prediction Simulator
                  </TabsTrigger>
                  <TabsTrigger
                    value="solar_readiness"
                    className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-3 sm:px-4 pb-3 pt-2 text-xs font-semibold text-slate-500 transition-all hover:text-slate-900 data-[state=active]:border-[#0B0909] data-[state=active]:text-slate-900 data-[state=active]:shadow-none"
                  >
                    <Sun className="mr-2 h-4 w-4 text-rose-600" />
                    Solar PV Factory Readiness
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Tab 1: SECOM Benchmark Evaluation Dashboard */}
              <TabsContent value="benchmark" className="mt-6 space-y-6">
                <BenchmarkEvaluationCard />
                <ConfusionMatrixCard />
              </TabsContent>

              {/* Tab 2: Prediction Simulator */}
              <TabsContent value="prediction" className="mt-6 space-y-6">
                <PredictionSimulator />
              </TabsContent>

              {/* Tab 3: Solar PV Factory Readiness */}
              <TabsContent value="solar_readiness" className="mt-6 space-y-6">
                <SolarReadinessPanel />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
