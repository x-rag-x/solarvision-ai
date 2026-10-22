/**
 * SolarVision AI — Model 4: Predictive Maintenance Overview Dashboard
 * 
 * Main integrated industrial dashboard for Model 4.
 * STRICT COMPLIANCE:
 * - Domain segregation between AI4I 2020 Benchmark and Solar Factory Equipment.
 * - Current-failure classification under operating condition, NOT Remaining Useful Life (RUL).
 * - Zero fabricated scores or arbitrary confidence percentages.
 * - Retrieves real database history from Agent 1's persistence layer.
 */

import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertOctagon,
  BarChart3,
  CheckCircle2,
  Cpu,
  Factory,
  History,
  Layers,
  Play,
  RotateCcw,
  ShieldAlert,
  Wrench,
  XCircle,
} from "lucide-react";
import { AuthGuard } from "@/components/solarvision/AuthGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { startLogin } from "@/const";
import {
  fetchMaintenanceHistory,
  runMaintenancePrediction,
  PredictiveMaintenanceApiError,
} from "./api";
import {
  PRESET_MAINTENANCE_SAMPLES,
  VERIFIED_BENCHMARK_METADATA,
} from "./benchmarkData";
import { AssessmentHistoryTable } from "./components/AssessmentHistoryTable";
import { BenchmarkEvaluationCard } from "./components/BenchmarkEvaluationCard";
import { DualDomainStatusBanner } from "./components/DualDomainStatusBanner";
import { EquipmentSelector } from "./components/EquipmentSelector";
import { FailureResultCard } from "./components/FailureResultCard";
import { MaintenanceInputPanel } from "./components/MaintenanceInputPanel";
import { SolarFactoryReadinessPanel } from "./components/SolarFactoryReadinessPanel";
import type {
  ActiveMaintenanceTab,
  MaintenanceInputMeasurements,
  MaintenancePredictionResult,
  PresetMaintenanceSample,
} from "./types";

export function PredictiveMaintenanceOverview() {
  const [activeTab, setActiveTab] = useState<ActiveMaintenanceTab>("inference_simulator");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("AI4I-BENCHMARK-MILL-01");
  const [isSolarSelected, setIsSolarSelected] = useState<boolean>(false);

  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
    PRESET_MAINTENANCE_SAMPLES[0].id
  );
  const [measurements, setMeasurements] = useState<MaintenanceInputMeasurements>(
    () => PRESET_MAINTENANCE_SAMPLES[0].measurements
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<MaintenancePredictionResult | null>(null);
  const [history, setHistory] = useState<MaintenancePredictionResult[]>([]);
  const [error, setError] = useState<{
    code: string;
    message: string;
    details?: string;
  } | null>(null);

  // Load persisted history from Agent 1's database endpoint on mount
  const refreshHistory = async () => {
    setHistoryLoading(true);
    try {
      const records = await fetchMaintenanceHistory(50);
      setHistory(records);
    } catch {
      // Non-critical if database is unseeded or unauthenticated
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    refreshHistory();
  }, []);

  const handleSelectEquipment = (id: string, isSolar: boolean) => {
    setSelectedEquipmentId(id);
    setIsSolarSelected(isSolar);
    setError(null);
    if (isSolar) {
      setPrediction(null);
    }
  };

  const handleSelectPreset = (preset: PresetMaintenanceSample) => {
    setSelectedPresetId(preset.id);
    setMeasurements({
      ...preset.measurements,
      machineId: selectedEquipmentId,
    });
    setError(null);
  };

  const handleExecuteAssessment = async () => {
    // If solar equipment is selected, block execution with explicit domain error
    if (isSolarSelected) {
      setError({
        code: "MODEL_NOT_TRAINED",
        message: `Deployment Blocked: Solar equipment (${selectedEquipmentId}) does not have a trained production checkpoint. Zero synthetic maintenance predictions can be served.`,
        details: "Requires authentic IoT edge telemetry and factory CMMS ground-truth failure logs.",
      });
      setPrediction(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await runMaintenancePrediction({
        ...measurements,
        machineId: selectedEquipmentId,
      });

      setPrediction(result);
      setHistory((prev) => [result, ...prev.slice(0, 49)]);

      // Background refetch to ensure database synchronization
      refreshHistory().catch(() => {});
    } catch (err: any) {
      if (err instanceof PredictiveMaintenanceApiError) {
        setError({
          code: err.code,
          message: err.message,
          details: err.details,
        });
      } else {
        setError({
          code: "INFERENCE_FAILED",
          message: err.message || "An unexpected error occurred during maintenance assessment.",
        });
      }
      setPrediction(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReloadAssessment = (item: MaintenancePredictionResult) => {
    setMeasurements(item.inputMeasurements);
    setPrediction(item);
    setSelectedPresetId(null);
    setSelectedEquipmentId(item.inputMeasurements.machineId || "AI4I-BENCHMARK-MILL-01");
    setIsSolarSelected(false);
    setActiveTab("inference_simulator");
    setError(null);
  };

  return (
    <AuthGuard
      title="Authentication required for predictive maintenance operations"
      description="Access to Model 4 predictive maintenance forecasting, station telemetry, and equipment failure classification is restricted to authenticated operators and maintenance engineers."
    >
      <div className="space-y-8">
        {/* Top Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F2B941]">
                Quality Operations / M4
              </span>
              <Badge className="bg-[#0B0909] text-white text-[10px] font-mono">
                Model 4 Predictive Maintenance
              </Badge>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Predictive Maintenance & Equipment Health
            </h1>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Operating-condition failure risk assessment, physical failure mode attribution, and condition-based maintenance.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>AI4I Benchmark Ready</span>
              <span className="mx-1 text-slate-300">•</span>
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>Solar Equipment Not Trained</span>
            </div>
          </div>
        </div>

        {/* Dual Domain Status & Quarantine Notice */}
        <DualDomainStatusBanner />

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as ActiveMaintenanceTab)}>
          <div className="border-b border-slate-200">
            <TabsList className="h-12 w-full justify-start rounded-none bg-transparent p-0 gap-2 sm:gap-6 overflow-x-auto">
              <TabsTrigger
                value="inference_simulator"
                className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-3 sm:px-4 pb-3 pt-2 text-xs font-semibold text-slate-500 transition-all hover:text-slate-900 data-[state=active]:border-[#0B0909] data-[state=active]:text-slate-900 data-[state=active]:shadow-none"
              >
                <Play className="mr-2 h-4 w-4 text-[#F2B941]" />
                Operating Condition Assessment
              </TabsTrigger>
              <TabsTrigger
                value="benchmark_eval"
                className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-3 sm:px-4 pb-3 pt-2 text-xs font-semibold text-slate-500 transition-all hover:text-slate-900 data-[state=active]:border-[#0B0909] data-[state=active]:text-slate-900 data-[state=active]:shadow-none"
              >
                <Cpu className="mr-2 h-4 w-4 text-emerald-600" />
                AI4I 2020 Benchmark
              </TabsTrigger>
              <TabsTrigger
                value="solar_readiness"
                className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-3 sm:px-4 pb-3 pt-2 text-xs font-semibold text-slate-500 transition-all hover:text-slate-900 data-[state=active]:border-[#0B0909] data-[state=active]:text-slate-900 data-[state=active]:shadow-none"
              >
                <Factory className="mr-2 h-4 w-4 text-rose-600" />
                Solar Equipment Readiness Gate
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-3 sm:px-4 pb-3 pt-2 text-xs font-semibold text-slate-500 transition-all hover:text-slate-900 data-[state=active]:border-[#0B0909] data-[state=active]:text-slate-900 data-[state=active]:shadow-none"
              >
                <History className="mr-2 h-4 w-4 text-slate-600" />
                Assessment History ({history.length})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Inference Simulator */}
          <TabsContent value="inference_simulator" className="mt-6 space-y-6">
            {/* Equipment Selection Panel */}
            <EquipmentSelector
              selectedEquipmentId={selectedEquipmentId}
              onSelectEquipment={handleSelectEquipment}
            />

            {/* Error States Banner */}
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
                      <Badge className="bg-rose-200 text-rose-900 border-rose-300 text-[10px]">
                        Execution Halted
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

            {/* If Solar Equipment is selected, show explicit blocker guidance */}
            {isSolarSelected ? (
              <div className="rounded-3xl border border-rose-300 bg-rose-50/60 p-8 text-center space-y-4">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-950 text-rose-300">
                  <Factory className="h-8 w-8" />
                </div>
                <div className="max-w-lg mx-auto">
                  <h3 className="text-lg font-bold text-slate-900">
                    Solar Equipment ({selectedEquipmentId}) Model Blocked
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    Zero synthetic maintenance forecasts are served for physical solar cell lines. 
                    To evaluate the algorithmic classifier, select an <strong>AI4I Benchmark Apparatus</strong> above.
                  </p>
                </div>
                <div>
                  <Button
                    onClick={() => handleSelectEquipment("AI4I-BENCHMARK-MILL-01", false)}
                    className="rounded-xl bg-[#0B0909] text-white text-xs px-5 hover:bg-slate-800"
                  >
                    Switch to Benchmark Apparatus
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Maintenance Input Panel */}
                <MaintenanceInputPanel
                  measurements={measurements}
                  onChangeMeasurements={(updated) => {
                    setMeasurements(updated);
                    setSelectedPresetId(null);
                  }}
                  onExecuteAssessment={handleExecuteAssessment}
                  loading={loading}
                  selectedPresetId={selectedPresetId}
                  onSelectPreset={handleSelectPreset}
                />

                {/* Prediction Result Display */}
                {prediction && !error && (
                  <FailureResultCard prediction={prediction} />
                )}
              </>
            )}
          </TabsContent>

          {/* Tab 2: Benchmark Evaluation */}
          <TabsContent value="benchmark_eval" className="mt-6">
            <BenchmarkEvaluationCard />
          </TabsContent>

          {/* Tab 3: Solar Readiness */}
          <TabsContent value="solar_readiness" className="mt-6">
            <SolarFactoryReadinessPanel />
          </TabsContent>

          {/* Tab 4: History */}
          <TabsContent value="history" className="mt-6">
            <AssessmentHistoryTable
              history={history}
              onReloadAssessment={handleReloadAssessment}
              onClearHistory={() => setHistory([])}
              onRefreshHistory={refreshHistory}
              loadingHistory={historyLoading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AuthGuard>
  );
}
