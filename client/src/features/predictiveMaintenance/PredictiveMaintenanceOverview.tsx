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
  FileText,
} from "lucide-react";
import { useAppMode } from "@/contexts/ModeContext";
import { AuthGuard } from "@/components/solarvision/AuthGuard";
import { Badge } from "@/components/ui/badge";
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

// Shared SolarVision UI Components
import PageHeader from "@/components/solarvision/PageHeader";
import ModelBadge from "@/components/solarvision/ModelBadge";
import StatusBadge from "@/components/solarvision/StatusBadge";
import NoticeBar from "@/components/solarvision/NoticeBar";
import ReportLayout from "@/components/solarvision/ReportLayout";

export function PredictiveMaintenanceOverview() {
  const { isDev, isProd } = useAppMode();
  const [activeTab, setActiveTab] = useState<ActiveMaintenanceTab>("inference_simulator");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("AI4I-BENCHMARK-MILL-01");

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

  const handleSelectEquipment = (id: string) => {
    setSelectedEquipmentId(id);
    setError(null);
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
    setLoading(true);
    setError(null);

    try {
      const result = await runMaintenancePrediction({
        ...measurements,
        machineId: selectedEquipmentId,
      });

      setPrediction(result);
      setHistory(prev => [result, ...prev.slice(0, 49)]);
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
    setActiveTab("inference_simulator");
    setError(null);
  };

  // If in Prod mode and prediction is available: show clean ReportLayout!
  if (isProd && prediction && !error) {
    const isCritical = prediction.riskLevel === "CRITICAL" || prediction.riskLevel === "HIGH";
    const failureProb = prediction.failureProbability ?? 0;
    const isFailure = prediction.classification === "FAILURE";
    const flaggedModes = prediction.ruleBasedFailureModes.filter((m) => m.thresholdExceeded);
    const equipId = prediction.inputMeasurements.machineId || selectedEquipmentId || "EQ-AI4I-01";

    return (
      <div className="space-y-6">
        <ReportLayout
          title={`Equipment Health Assessment: ${equipId}`}
          reportId={`M4-${prediction.timestamp.replace(/[^0-9]/g, "").slice(0, 14)}`}
          timestamp={prediction.timestamp}
          operatorName="Maintenance Quality Team"
          modelBadge={<ModelBadge model="M4" />}
          statusBadge={
            <StatusBadge tone={isCritical ? "danger" : "success"}>
              {prediction.riskLevel} RISK · {isFailure ? "Failure Imminent" : "Normal"}
            </StatusBadge>
          }
          verdictHeadline={
            isFailure
              ? `Operational condition exceeds failure boundary (Calibrated risk: ${(failureProb * 100).toFixed(1)}%)`
              : `Operating within nominal physical tolerance (Calibrated risk: ${(failureProb * 100).toFixed(1)}%)`
          }
          verdictTone={isCritical ? "danger" : "success"}
          verdictStats={[
            { label: "Failure Risk", value: `${(failureProb * 100).toFixed(1)}%` },
            { label: "Active Modes", value: flaggedModes.length },
            { label: "Tool Wear", value: `${prediction.inputMeasurements.toolWearMin} min` },
          ]}
          mandatoryNoticeNode={
            <NoticeBar
              tone="warning"
              message="AI4I 2020 Physical Benchmark: Synthetic milling apparatus data; not factory-certified for solar machinery."
              details={
                <p>
                  Predictions compute calibrated failure probability using Platt scaling over gradient boosted trees.
                  Failure mode attribution (TWF, HDF, PWF, OSF, RNF) follows the verified AI4I benchmark definitions.
                </p>
              }
            />
          }
          evidenceNode={
            <div className="rounded-xl border border-border bg-surface-subtle p-5">
              <FailureResultCard prediction={prediction} />
            </div>
          }
          findingsNode={
            <div className="rounded-xl border border-border bg-surface p-4 text-xs space-y-2">
              <span className="font-semibold text-text block">Input Telemetry Summary:</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs text-text-2">
                <div>Air Temp: {prediction.inputMeasurements.airTemperatureK} K</div>
                <div>Process Temp: {prediction.inputMeasurements.processTemperatureK} K</div>
                <div>Rotational Speed: {prediction.inputMeasurements.rotationalSpeedRpm} RPM</div>
                <div>Torque: {prediction.inputMeasurements.torqueNm} Nm</div>
                <div>Tool Wear: {prediction.inputMeasurements.toolWearMin} min</div>
                <div>Product Type: {prediction.inputMeasurements.productType}</div>
              </div>
            </div>
          }
          onRunAnother={() => setPrediction(null)}
        />
      </div>
    );
  }

  return (
    <AuthGuard
      title="Authentication Required for Predictive Maintenance Operations"
      description="Access to Model 4 predictive maintenance forecasting, station telemetry, and equipment failure classification is restricted to authenticated operators."
    >
      <div className="space-y-6">
        {/* Page Top Header */}
        <PageHeader
          title="Equipment Health & Maintenance"
          description="Operating-condition failure risk assessment, physical failure mode attribution (TWF, HDF, PWF, OSF, RNF), and condition-based maintenance."
          badge={<ModelBadge model="M4" />}
          actions={
            <StatusBadge tone="neutral">AI4I Benchmark Calibrated</StatusBadge>
          }
        />

        {/* Mandatory Domain Separation Notice */}
        <NoticeBar
          tone="warning"
          message="AI4I 2020 Benchmark: Physical milling machine dataset; simulated scenarios for predictive maintenance."
          details={
            <p>
              Model 4 is trained and evaluated using the AI4I 2020 manufacturing benchmark. These are simulated equipment scenarios, not connected physical machines. Solar factory deployment requires real telemetry and independent validation.
            </p>
          }
        />

        {/* Tabs: In Prod mode, show only Assess & History; In Dev mode, show all 4 */}
        <Tabs value={activeTab} onValueChange={val => setActiveTab(val as ActiveMaintenanceTab)}>
          <div className="border-b border-border">
            <TabsList className="h-10 w-full justify-start rounded-none bg-transparent p-0 gap-4">
              <TabsTrigger
                value="inference_simulator"
                className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 text-xs font-semibold text-text-3 data-[state=active]:border-ink data-[state=active]:text-text"
              >
                <Play className="mr-2 h-3.5 w-3.5 text-brand-text" />
                Operating Assessment
              </TabsTrigger>

              {isDev && (
                <>
                  <TabsTrigger
                    value="benchmark_eval"
                    className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 text-xs font-semibold text-text-3 data-[state=active]:border-ink data-[state=active]:text-text"
                  >
                    <Cpu className="mr-2 h-3.5 w-3.5 text-text-3" />
                    AI4I 2020 Benchmark
                  </TabsTrigger>
                  <TabsTrigger
                    value="solar_readiness"
                    className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 text-xs font-semibold text-text-3 data-[state=active]:border-ink data-[state=active]:text-text"
                  >
                    <Factory className="mr-2 h-3.5 w-3.5 text-text-3" />
                    Solar Equipment Readiness
                  </TabsTrigger>
                </>
              )}

              <TabsTrigger
                value="history"
                className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 text-xs font-semibold text-text-3 data-[state=active]:border-ink data-[state=active]:text-text"
              >
                <History className="mr-2 h-3.5 w-3.5 text-text-3" />
                Assessment History ({history.length})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Inference Simulator */}
          <TabsContent value="inference_simulator" className="mt-4 space-y-4">
            <EquipmentSelector
              selectedEquipmentId={selectedEquipmentId}
              onSelectEquipment={handleSelectEquipment}
            />

            {error && (
              <div className="rounded-xl border border-danger/30 bg-danger-tint/50 p-4 text-xs text-text space-y-2">
                <div className="flex items-center gap-2 text-danger font-semibold">
                  <ShieldAlert className="h-4 w-4" />
                  <span>{error.code}: {error.message}</span>
                </div>
                {error.details && <p className="font-mono text-text-3">{error.details}</p>}
                {error.code === "UNAUTHORIZED" && (
                  <button
                    onClick={() => startLogin()}
                    className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink/90 transition-colors"
                  >
                    Re-authenticate Session
                  </button>
                )}
              </div>
            )}

            <MaintenanceInputPanel
              measurements={measurements}
              onChangeMeasurements={updated => {
                setMeasurements(updated);
                setSelectedPresetId(null);
              }}
              onExecuteAssessment={handleExecuteAssessment}
              loading={loading}
              selectedPresetId={selectedPresetId}
              onSelectPreset={handleSelectPreset}
            />

            {prediction && !error && (
              <FailureResultCard prediction={prediction} />
            )}
          </TabsContent>

          {/* Tab 2: Benchmark Evaluation (Dev Mode) */}
          {isDev && (
            <TabsContent value="benchmark_eval" className="mt-4">
              <BenchmarkEvaluationCard />
            </TabsContent>
          )}

          {/* Tab 3: Solar Readiness (Dev Mode) */}
          {isDev && (
            <TabsContent value="solar_readiness" className="mt-4">
              <SolarFactoryReadinessPanel />
            </TabsContent>
          )}

          {/* Tab 4: History */}
          <TabsContent value="history" className="mt-4">
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

export default PredictiveMaintenanceOverview;
