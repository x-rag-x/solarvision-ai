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
import { useAppMode } from "@/contexts/ModeContext";
import { AuthGuard } from "@/components/solarvision/AuthGuard";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Shared SolarVision UI Components
import PageHeader from "@/components/solarvision/PageHeader";
import ModelBadge from "@/components/solarvision/ModelBadge";
import StatusBadge from "@/components/solarvision/StatusBadge";
import NoticeBar from "@/components/solarvision/NoticeBar";

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
  const { isDev, isProd } = useAppMode();
  const [activeTab, setActiveTab] = useState<ActiveTab>("benchmark");
  const [modelMode, setModelMode] = useState<Model3Mode>("sandia_performance");

  // Synchronize mode from URL search param or path
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view");
      if (view === "secom" || location.includes("secom")) {
        setModelMode("secom_benchmark");
        return;
      }
      if (view === "sandia" || location.includes("sandia")) {
        setModelMode("sandia_performance");
        return;
      }
    }
  }, [location]);

  return (
    <AuthGuard
      title="Authentication Required for Performance Forecasting"
      description="Access to Model 3 electrical performance forecasting, IV curve metrology, and yield regression pipelines is restricted to authenticated operators."
    >
      <div className="space-y-6">
        {/* Page Top Header */}
        <PageHeader
          title={
            modelMode === "sandia_performance"
              ? "Solar Electrical Performance Forecast"
              : "Predictive Quality Benchmark"
          }
          description={
            modelMode === "sandia_performance"
              ? "Calibrated reference-normalized PV electrical power retention prediction using verified Sandia National Laboratories research pipeline."
              : "In-situ process telemetry modeling and multi-sensor yield excursion prediction based on the UCI SECOM semiconductor dataset."
          }
          badge={<ModelBadge model="M3" />}
          actions={
            <div className="flex items-center gap-2">
              {modelMode === "sandia_performance" ? (
                <StatusBadge tone="success">Sandia Pipeline Verified</StatusBadge>
              ) : (
                <StatusBadge tone="info">SECOM Benchmark Ready</StatusBadge>
              )}
            </div>
          }
        />

        {/* Mandatory Domain & Methodological Notice */}
        <NoticeBar
          tone="info"
          message={
            modelMode === "sandia_performance"
              ? "Sandia National Laboratories PV Research: Target power_retention_pct with verified MAE 0.793 pp · RMSE 1.107 pp · R² 0.581."
              : "UCI SECOM Benchmark: Semiconductor manufacturing sensor dataset; not certified for crystalline solar cells."
          }
          details={
            <div className="space-y-1.5">
              <p>
                <strong>Scientific Isolation:</strong> Model 3 evaluates solar cell IV degradation against the Sandia regression pipeline.
              </p>
              <p>
                The secondary UCI SECOM benchmark is preserved in developer mode for process excursion research but is isolated from solar factory certification.
              </p>
            </div>
          }
        />

        {/* Mode Switcher Segmented Control (Available in Dev mode, or when requested) */}
        {isDev && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-1.5 shadow-xs">
            {/* OPTION 1: Sandia Solar Electrical Performance */}
            <button
              type="button"
              data-testid="mode-tab-sandia"
              onClick={() => setModelMode("sandia_performance")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                modelMode === "sandia_performance"
                  ? "bg-[#965660] text-white shadow-xs"
                  : "text-text-2 hover:bg-surface-subtle hover:text-text"
              }`}
            >
              <Zap
                className={`h-4 w-4 ${
                  modelMode === "sandia_performance" ? "text-[#F2DBD7]" : "text-[#965660]"
                }`}
              />
              <span>Sandia Solar Electrical Performance</span>
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-mono ${
                  modelMode === "sandia_performance"
                    ? "bg-white/20 text-white"
                    : "bg-surface-subtle text-text-3 border border-border"
                }`}
              >
                Primary Model 3
              </span>
            </button>

            {/* OPTION 2: UCI SECOM Process Benchmark */}
            <button
              type="button"
              data-testid="mode-tab-secom"
              onClick={() => setModelMode("secom_benchmark")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                modelMode === "secom_benchmark"
                  ? "bg-terracotta text-white shadow-xs"
                  : "text-text-2 hover:bg-surface-subtle hover:text-text"
              }`}
            >
              <Cpu
                className={`h-4 w-4 ${
                  modelMode === "secom_benchmark" ? "text-white" : "text-text-3"
                }`}
              />
              <span>UCI SECOM Process Benchmark</span>
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-mono ${
                  modelMode === "secom_benchmark"
                    ? "bg-white/20 text-white"
                    : "bg-surface-subtle text-text-3 border border-border"
                }`}
              >
                Secondary Benchmark
              </span>
            </button>
          </div>
        )}

        {/* WORKFLOW 1 (Default): Sandia Solar Electrical Performance Prediction */}
        {modelMode === "sandia_performance" && <SandiaPerformanceDashboard />}

        {/* WORKFLOW 2 (Secondary): UCI SECOM Predictive Quality */}
        {modelMode === "secom_benchmark" && (
          <div className="space-y-6">
            <DualDomainStatusBanner />

            {/* SECOM Tabs */}
            <Tabs value={activeTab} onValueChange={val => setActiveTab(val as ActiveTab)}>
              <div className="border-b border-border">
                <TabsList className="h-10 w-full justify-start rounded-none bg-transparent p-0 gap-4">
                  <TabsTrigger
                    value="benchmark"
                    className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 text-xs font-semibold text-text-3 data-[state=active]:border-sapphire data-[state=active]:text-sapphire"
                  >
                    <Cpu className="mr-2 h-3.5 w-3.5 text-text-3" />
                    UCI SECOM Benchmark
                  </TabsTrigger>
                  <TabsTrigger
                    value="prediction"
                    className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 text-xs font-semibold text-text-3 data-[state=active]:border-sapphire data-[state=active]:text-sapphire"
                  >
                    <Play className="mr-2 h-3.5 w-3.5 text-success" />
                    Prediction Simulator
                  </TabsTrigger>
                  <TabsTrigger
                    value="solar_readiness"
                    className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 text-xs font-semibold text-text-3 data-[state=active]:border-sapphire data-[state=active]:text-sapphire"
                  >
                    <Sun className="mr-2 h-3.5 w-3.5 text-warning" />
                    Solar PV Factory Readiness
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="benchmark" className="mt-4 space-y-4">
                <BenchmarkEvaluationCard />
                <ConfusionMatrixCard />
              </TabsContent>

              <TabsContent value="prediction" className="mt-4 space-y-4">
                <PredictionSimulator />
              </TabsContent>

              <TabsContent value="solar_readiness" className="mt-4 space-y-4">
                <SolarReadinessPanel />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

export default PredictiveQualityOverview;
