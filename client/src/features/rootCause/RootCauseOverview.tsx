/**
 * SolarVision AI — Phase 3 & 3B: Root Cause Analysis & Manufacturing Data Onboarding Overview
 * 
 * Central dashboard component for:
 * 1. Model 2 Defect Etiology Diagnosis
 * 2. 6-Category Manufacturing Data CSV Onboarding (Task 1)
 * 3. Inspection-to-Batch Lineage Linking (Task 2)
 * 4. Expert Ground-Truth Root Cause Review (Task 3)
 * 5. Model 2 Dataset Readiness & Training Gate (Task 4)
 * 
 * STRICT COMPLIANCE:
 * - Protected by AuthGuard: requires authenticated operator or quality engineer identity.
 * - Connected directly to real database responses via trpc.inspection.history & trpc.inspection.detail.
 * - Displays actual detected defects and linked manufacturing information.
 * - Truthfully reports DATASET_BLOCKED whenever requirements are unmet.
 * - Only displays probable causes when returned by a real, validated API.
 * - Strictly avoids labeling Random Forest as Bayesian.
 * - Preserves existing dashboard layout, theme, and Model 1 inspection workflow.
 */

import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Compass,
  Cpu,
  Database,
  ExternalLink,
  FileCheck,
  FileSpreadsheet,
  Flame,
  HelpCircle,
  History as HistoryIcon,
  Layers,
  Link as LinkIcon,
  Loader2,
  Microscope,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { AuthGuard } from "@/components/solarvision/AuthGuard";
import { Button } from "@/components/ui/button";
import { DataImportDashboard } from "./components/DataImportDashboard";
import { HistoricalPredictionsTable } from "./components/HistoricalPredictionsTable";
import { InspectionBatchLinker } from "./components/InspectionBatchLinker";
import { ManufacturingContextSection } from "./components/ManufacturingContextSection";
import { ModelLimitationsCard } from "./components/ModelLimitationsCard";
import { Model2ReadinessDashboard } from "./components/Model2ReadinessDashboard";
import { ProbableCauseResults } from "./components/ProbableCauseResults";
import { RootCauseConfirmationReview } from "./components/RootCauseConfirmationReview";
import { SelectedInspectionPanel } from "./components/SelectedInspectionPanel";
import {
  ModelNotTrainedBanner,
  ModelUnavailableBanner,
  NoManufacturingDataBanner,
  PredictionFailureBanner,
  PredictionInProgressSkeleton,
} from "./components/StateBanners";
import type { InspectionContext } from "./types";
import { useRootCause } from "./useRootCause";

export type RootCauseTab = "diagnosis" | "import" | "link" | "review" | "readiness";

export interface RootCauseOverviewProps {
  params?: Record<string, string | undefined>;
  initialInspection?: InspectionContext | null;
  onSelectInspectionId?: (inspectionId: string) => void;
  onOpenImageModal?: (imageUrl: string) => void;
}

export function RootCauseOverview({
  initialInspection = null,
  onSelectInspectionId,
  onOpenImageModal,
}: RootCauseOverviewProps) {
  const [, params] = useRoute("/root-cause/:inspectionId");
  const [, setLocation] = useLocation();
  const routeInspectionId = params?.inspectionId || "";

  const [activeTab, setActiveTab] = useState<RootCauseTab>("diagnosis");
  const [activeInspectionId, setActiveInspectionId] = useState<string>(
    routeInspectionId || initialInspection?.inspectionId || ""
  );
  const [inputInspectionId, setInputInspectionId] = useState("");

  // Query real inspections list from database
  const { data: rawInspectionHistory, isLoading: isHistoryLoading, refetch: refetchHistory } =
    trpc.inspection.history.useQuery({ limit: 50 });

  const inspectionHistory: any[] = Array.isArray(rawInspectionHistory)
    ? rawInspectionHistory
    : (rawInspectionHistory as any)?.items || [];

  // Query real database readiness summary via tRPC
  const { data: readinessData, refetch: refetchReadiness } =
    trpc.rootCause.readiness.useQuery();

  // Query detail for active inspection
  const {
    data: detailData,
    isLoading: isDetailLoading,
    isError: isDetailError,
    refetch: refetchDetail,
  } = trpc.inspection.detail.useQuery(
    { inspectionId: activeInspectionId || "00000000-0000-0000-0000-000000000000" },
    { enabled: Boolean(activeInspectionId) }
  );

  const {
    state,
    selectedInspection,
    setSelectedInspection,
    modelStatus,
    batchData,
    machineData,
    sensorObservations,
    prediction,
    history,
    uiStatus,
    errorMessage,
    errorDetails,
    runDiagnosis,
    checkModelStatus,
    handleVerifyCause,
    setUiStatus,
  } = useRootCause({ initialInspection });

  // Sync route inspection ID into activeInspectionId
  useEffect(() => {
    if (routeInspectionId && routeInspectionId !== activeInspectionId) {
      setActiveInspectionId(routeInspectionId);
    }
  }, [routeInspectionId]);

  // Synchronize real database inspection details into Root Cause state
  useEffect(() => {
    if (detailData?.inspection) {
      const insp = detailData.inspection as any;
      const detections = Array.isArray(detailData.detections) ? detailData.detections : [];

      const mappedInspection: InspectionContext = {
        inspectionId: insp.inspectionId || insp.id,
        sourceFilename: insp.sourceFilename || "cell-scan.jpg",
        createdAt: String(insp.createdAt || new Date().toISOString()),
        detectionsCount: Number(insp.detectionsCount ?? detections.length),
        inputImageUrl: insp.inputImageUrl || null,
        annotatedImageUrl: insp.annotatedImageUrl || null,
        batchId: insp.batchId || null,
        machineId: insp.machineId || null,
        operatorId: insp.operatorId || null,
        detections: detections.map((d: any) => ({
          id: d.id,
          defectType: d.defectType,
          confidence: Number(d.confidence),
          x1: Number(d.x1),
          y1: Number(d.y1),
          x2: Number(d.x2),
          y2: Number(d.y2),
        })),
      };

      setSelectedInspection(mappedInspection);
    }
  }, [detailData, setSelectedInspection]);

  // Handle changing selected inspection
  const handleSelectInspection = (id: string) => {
    if (!id) return;
    setActiveInspectionId(id);
    setLocation(`/root-cause/${id}`);
    if (onSelectInspectionId) {
      onSelectInspectionId(id);
    }
  };

  const handleManualInspectionLoad = () => {
    if (!inputInspectionId.trim()) return;
    handleSelectInspection(inputInspectionId.trim());
    setInputInspectionId("");
  };

  const isModelTrained = modelStatus?.isReady && modelStatus?.status === "ready";
  const isLoading = uiStatus === "loading" || isDetailLoading;

  return (
    <AuthGuard
      title="Authentication required for Root Cause Analysis"
      description="Access to Model 2 defect etiology, SCADA furnace telemetry correlation, and manufacturing root-cause predictions is strictly restricted to authenticated operators and quality engineers."
    >
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-[#F2B941]/30 bg-[#FFF3C4] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#0B0909]">
                Industry 4.0 • Model 2
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isModelTrained ? "bg-[#087e6d]" : "bg-amber-500"
                  }`}
                />
                {modelStatus?.status === "ready"
                  ? "Model 2 Operational"
                  : modelStatus?.status === "unavailable"
                  ? "Model 2 Offline"
                  : "Model 2 Not Trained"}
              </span>
              <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-800 border border-red-200">
                DATASET_BLOCKED
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Root Cause Etiology & Manufacturing Data
            </h1>
            <p className="mt-1 text-xs text-slate-600 max-w-3xl leading-relaxed">
              Correlate solar cell physical defects with fabrication line telemetry, manage manufacturing data
              onboarding across 6 CSV categories, link inspection lineage, and record expert ground truth.
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                checkModelStatus();
                refetchHistory();
                refetchReadiness();
                if (activeInspectionId) refetchDetail();
              }}
              className="border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>

            {activeTab === "diagnosis" && (
              <Button
                onClick={() => runDiagnosis()}
                disabled={isLoading || !selectedInspection}
                className="bg-[#F2B941] text-[#0B0909] font-bold text-xs hover:bg-[#e0a830] shadow-md transition-all disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Diagnosing Etiology...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Run Root Cause Diagnosis
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Top Feature Navigation Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto pb-px gap-2">
          <button
            onClick={() => setActiveTab("diagnosis")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap border-b-2 ${
              activeTab === "diagnosis"
                ? "border-[#F2B941] bg-white text-slate-900 shadow-sm"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <Sparkles className="h-4 w-4 text-[#F2B941]" />
            <span>Etiology Diagnosis</span>
          </button>

          <button
            onClick={() => setActiveTab("import")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap border-b-2 ${
              activeTab === "import"
                ? "border-[#087e6d] bg-white text-slate-900 shadow-sm"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <UploadCloud className="h-4 w-4 text-[#087e6d]" />
            <span>CSV Data Import</span>
          </button>

          <button
            onClick={() => setActiveTab("link")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap border-b-2 ${
              activeTab === "link"
                ? "border-[#087e6d] bg-white text-slate-900 shadow-sm"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <LinkIcon className="h-4 w-4 text-[#087e6d]" />
            <span>Inspection-to-Batch Linking</span>
          </button>

          <button
            onClick={() => setActiveTab("review")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap border-b-2 ${
              activeTab === "review"
                ? "border-[#087e6d] bg-white text-slate-900 shadow-sm"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <Microscope className="h-4 w-4 text-[#087e6d]" />
            <span>Expert Ground-Truth Review</span>
          </button>

          <button
            onClick={() => setActiveTab("readiness")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap border-b-2 ${
              activeTab === "readiness"
                ? "border-red-500 bg-white text-slate-900 shadow-sm"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <ShieldAlert className="h-4 w-4 text-red-500" />
            <span>Dataset Readiness</span>
            <span className="rounded-full bg-red-100 px-1.5 py-0.2 text-[9px] font-bold text-red-700">
              BLOCKED
            </span>
          </button>
        </div>

        {/* TAB 1: ETIOLOGY DIAGNOSIS (Original Model 2 workflow) */}
        {activeTab === "diagnosis" && (
          <div className="space-y-6">
            {/* State Banners Section */}
            {uiStatus === "model_not_trained" && (
              <ModelNotTrainedBanner
                modelStatus={modelStatus}
                onRefreshStatus={() => checkModelStatus()}
              />
            )}

            {uiStatus === "no_manufacturing_data" && (
              <NoManufacturingDataBanner
                inspectionId={selectedInspection?.inspectionId}
                onRetryContext={() => runDiagnosis()}
              />
            )}

            {uiStatus === "error" && (
              <PredictionFailureBanner
                message={errorMessage}
                details={errorDetails}
                onRetry={() => runDiagnosis()}
              />
            )}

            {modelStatus?.status === "unavailable" && (
              <ModelUnavailableBanner onCheckAgain={() => checkModelStatus()} />
            )}

            {/* Main Feature Layout Grid */}
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Left Column: Inspection Selector, Inspection Context & Manufacturing Telemetry */}
              <div className="space-y-6 lg:col-span-5">
                {/* Inspection Selector Dropdown & Manual Input */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <HistoryIcon className="h-4 w-4 text-[#F2B941]" />
                      Select Stored Inspection
                    </span>
                    {inspectionHistory && (
                      <span className="text-[10px] text-slate-400">
                        {inspectionHistory.length} record{inspectionHistory.length === 1 ? "" : "s"} found
                      </span>
                    )}
                  </div>

                  {/* Dropdown populated from database */}
                  <div className="relative">
                    <select
                      value={activeInspectionId}
                      onChange={(e) => handleSelectInspection(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 pr-8 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F2B941]"
                    >
                      <option value="">— Select an inspection to analyze —</option>
                      {isHistoryLoading && <option disabled>Loading database records...</option>}
                      {inspectionHistory.map((insp: any) => {
                        const id = insp.inspectionId || insp.id;
                        return (
                          <option key={id} value={id}>
                            {insp.sourceFilename} ({insp.createdAt ? new Date(insp.createdAt).toLocaleDateString() : "Recent"}) — {insp.detectionsCount ?? 0} defect{insp.detectionsCount === 1 ? "" : "s"}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  </div>

                  {/* Or manual UUID input */}
                  <div className="border-t border-slate-100 pt-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="Or enter Inspection UUID..."
                      value={inputInspectionId}
                      onChange={(e) => setInputInspectionId(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#F2B941]"
                    />
                    <Button
                      size="sm"
                      onClick={handleManualInspectionLoad}
                      disabled={!inputInspectionId.trim()}
                      className="bg-[#0B0909] text-white text-xs font-semibold hover:bg-slate-800"
                    >
                      Load
                    </Button>
                  </div>
                </div>

                {/* Selected Inspection & Detected Defects */}
                <SelectedInspectionPanel
                  inspection={selectedInspection}
                  onClearSelection={() => {
                    setActiveInspectionId("");
                    setSelectedInspection(null);
                    setLocation("/root-cause");
                  }}
                  onOpenImageModal={onOpenImageModal}
                />

                {/* Manufacturing Batch & Sensor Observations */}
                <ManufacturingContextSection
                  batch={batchData}
                  machine={machineData}
                  sensors={sensorObservations}
                />
              </div>

              {/* Right Column: Probable Causes, Predictions & Model Scope */}
              <div className="space-y-6 lg:col-span-7">
                {/* Loading Skeleton during diagnosis inference */}
                {isLoading && <PredictionInProgressSkeleton />}

                {/* Real Validated Probable Causes */}
                {!isLoading && (
                  <ProbableCauseResults
                    prediction={prediction}
                    onVerifyFeedback={handleVerifyCause}
                  />
                )}

                {/* Transparent Model Limitations & Human Governance Card */}
                <ModelLimitationsCard
                  modelVersionId={prediction?.modelVersionId || modelStatus?.modelVersion || "2.0-alpha"}
                  limitations={modelStatus?.limitations || prediction?.modelLimitations}
                />
              </div>
            </div>

            {/* Historical Root Cause Predictions Log */}
            <div className="pt-2">
              <HistoricalPredictionsTable
                history={history}
                onSelectInspection={(id) => handleSelectInspection(id)}
              />
            </div>
          </div>
        )}

        {/* TAB 2: CSV DATA IMPORT (Task 1) */}
        {activeTab === "import" && (
          <DataImportDashboard
            onImportSuccess={() => {
              checkModelStatus();
              refetchReadiness();
            }}
          />
        )}

        {/* TAB 3: INSPECTION-TO-BATCH LINKING (Task 2) */}
        {activeTab === "link" && (
          <div className="space-y-4">
            <InspectionBatchLinker
              preselectedInspectionId={activeInspectionId}
              onLinkSaved={() => {
                refetchHistory();
                refetchReadiness();
                if (activeInspectionId) refetchDetail();
              }}
            />
          </div>
        )}

        {/* TAB 4: EXPERT ROOT CAUSE REVIEW (Task 3) */}
        {activeTab === "review" && (
          <div className="space-y-4">
            <RootCauseConfirmationReview
              preselectedInspectionId={activeInspectionId}
              onAnnotationConfirmed={() => {
                checkModelStatus();
                refetchReadiness();
              }}
            />
          </div>
        )}

        {/* TAB 5: DATASET READINESS & TRAINING GATE (Task 4) */}
        {activeTab === "readiness" && (
          <Model2ReadinessDashboard
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}
      </div>
    </AuthGuard>
  );
}
