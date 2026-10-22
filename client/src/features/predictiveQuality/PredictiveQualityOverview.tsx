/**
 * SolarVision AI — Model 3: Predictive Quality Monitoring
 * Main Integrated Industrial Dashboard Overview
 */

import React, { useState } from "react";
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
} from "lucide-react";
import { AuthGuard } from "@/components/solarvision/AuthGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BenchmarkEvaluationCard } from "./components/BenchmarkEvaluationCard";
import { ConfusionMatrixCard } from "./components/ConfusionMatrixCard";
import { DualDomainStatusBanner } from "./components/DualDomainStatusBanner";
import { PredictionSimulator } from "./components/PredictionSimulator";
import { SolarReadinessPanel } from "./components/SolarReadinessPanel";
import type { ActiveTab } from "./types";

export function PredictiveQualityOverview() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("benchmark");

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
                Model 3 Predictive Quality
              </Badge>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Predictive Quality Monitoring
            </h1>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              In-situ process telemetry modeling, multi-sensor yield excursion prediction, and dual-domain validation.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Benchmark Ready</span>
              <span className="mx-1 text-slate-300">•</span>
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>Solar Not Trained</span>
            </div>
          </div>
        </div>

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
    </AuthGuard>
  );
}
