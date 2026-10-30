import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAppMode } from "@/contexts/ModeContext";
import { openOperatorLoginModal } from "@/const";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCheck,
  FileWarning,
  HelpCircle,
  Info,
  Loader2,
  LogIn,
  RotateCcw,
  Scan,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";

// Shared SolarVision UI Components
import PageHeader from "@/components/solarvision/PageHeader";
import ModelBadge from "@/components/solarvision/ModelBadge";
import StatusBadge from "@/components/solarvision/StatusBadge";
import NoticeBar from "@/components/solarvision/NoticeBar";
import Dropzone from "@/components/solarvision/Dropzone";
import SampleGallery, { M2_SAMPLES } from "@/components/solarvision/SampleGallery";
import ReportLayout from "@/components/solarvision/ReportLayout";
import Inspector from "@/components/solarvision/Inspector";
import AuthPrompt from "@/components/solarvision/AuthPrompt";
import { EmptyState, ErrorState, Skeleton } from "@/components/solarvision/StateComponents";

export interface ScreeningResult {
  screeningId: string;
  imageUrl: string;
  sourceFilename: string;
  modelId: string;
  predictedClass: "healthy" | "defective";
  defectiveScorePct: number;
  rawDefectiveScore: number;
  thresholdPct: number;
  rawThreshold: number;
  requiresManualReview: true;
  decision: "screening_only";
  reviewStatus: "pending";
  inputScope: "complete_single_cell_EL_image";
  warning: string;
  summary: string;
  dataProvenance: "ELPV";
  createdAt: string;
}

export interface CellScreeningViewProps {
  initialResult?: ScreeningResult | null;
  initialFile?: File | null;
  initialPreview?: string | null;
}

export function CellScreeningView({
  initialResult = null,
  initialFile = null,
  initialPreview = null,
}: CellScreeningViewProps = {}) {
  const { user, isAuthenticated } = useAuth();
  const { isDev, isProd } = useAppMode();

  const [selectedFile, setSelectedFile] = useState<File | null>(initialFile);
  const [imagePreview, setImagePreview] = useState<string | null>(initialPreview);
  const [result, setResult] = useState<ScreeningResult | null>(initialResult);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const statusQuery = trpc.model2Elpv.status.useQuery();
  const historyQuery = trpc.model2Elpv.history.useQuery(
    { limit: 15 },
    { enabled: Boolean(isAuthenticated) }
  );

  const predictMutation = trpc.model2Elpv.predict.useMutation({
    onSuccess: (data: any) => {
      setResult(data);
      historyQuery.refetch();
      toast.success("Cell screening completed — Operator verification required.");
    },
    onError: (err: any) => {
      toast.error("Screening inference failed", {
        description: err.message,
      });
    },
  });

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setResult(null);

    // Create browser local preview URL
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setResult(null);
  };

  const handleRunScreening = async () => {
    if (!selectedFile) return;

    if (!isAuthenticated) {
      openOperatorLoginModal();
      return;
    }

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async e => {
        const raw = e.target?.result as string;
        const base64Data = raw.includes(",") ? raw.split(",")[1] : raw;
        await predictMutation.mutateAsync({
          filename: selectedFile.name,
          mimeType: selectedFile.type || "image/png",
          base64Data,
        });
      };
      reader.readAsDataURL(selectedFile);
    } catch (err: any) {
      toast.error(err.message || "Failed to process cell image.");
    }
  };

  const benchmark = statusQuery.data?.benchmark;
  const configuredThreshold =
    result?.rawThreshold ??
    statusQuery.data?.threshold ??
    0.55;
  const thresholdPct =
    result?.thresholdPct ??
    Math.round(configuredThreshold * 100);
  const isDefective = result
    ? (result.rawDefectiveScore >= configuredThreshold || result.predictedClass === "defective")
    : false;

  // Prod Mode: Printable Inspection Report Layout
  if (isProd && result) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Cell Screening Report"
          description="Official crystalline PV single-cell screening report for operational records and compliance audit."
          badge={<ModelBadge model="M2" readiness="Screening Only" />}
          actions={
            <button
              onClick={() => {
                setResult(null);
                setSelectedFile(null);
                setImagePreview(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-subtle transition-colors shadow-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 text-text-3" />
              <span>New Screening</span>
            </button>
          }
        />

        <NoticeBar
          tone="warning"
          message="Operator Verification Required: Human verification is required before a quality decision, regardless of the AI prediction."
          details={
            <p>
              Research screening result only. Human review is required before a final quality decision.
              Under zero-fabrication standards, Model 2 (EfficientNet-B0) operates as an anomaly triage filter.
              It does not generate automated factory reject signals.
            </p>
          }
        />

        <ReportLayout
          title="Photovoltaic Cell Anomaly Screening Certificate"
          reportId={result.screeningId}
          timestamp={result.createdAt}
          operatorName={user?.name || "Authorized Operator"}
          modelBadge={<ModelBadge model="M2" readiness="Screening Only" />}
          statusBadge={
            <StatusBadge tone={isDefective ? "warning" : "success"}>
              {isDefective ? "Predicted Defective" : "Predicted Healthy"}
            </StatusBadge>
          }
          verdictHeadline={
            isDefective
              ? "Predicted Defective — Verification Required"
              : "Predicted Healthy — Verification Required"
          }
          verdictTone={isDefective ? "warning" : "success"}
          verdictStats={[
            { label: "Screening ID", value: result.screeningId.slice(0, 10) },
            { label: "Prediction", value: isDefective ? "Predicted Defective" : "Predicted Healthy" },
            { label: "Defectiveness Score", value: `${result.defectiveScorePct}%` },
            { label: "Decision Threshold", value: `${thresholdPct}%` },
            { label: "Operator Verification", value: "Required" },
          ]}
          mandatoryNoticeNode={
            <div className="rounded-xl border border-warning/30 bg-warning-tint/30 p-4 text-xs text-text space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Operator Verification Required</span>
              </div>
              <p className="text-text-2 pl-6">
                Human verification is required before a quality decision, regardless of the AI prediction.
              </p>
              <p className="text-text-3 pl-6 text-[11px] italic">
                Research screening result only. Human review is required before a final quality decision.
              </p>
            </div>
          }
          evidenceNode={
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-surface-subtle p-3 text-center">
                <img
                  src={result.imageUrl || imagePreview || undefined}
                  alt={result.sourceFilename}
                  className="mx-auto max-h-72 object-contain rounded-lg"
                />
                <p className="mt-2 text-xs text-text-3 font-mono">
                  {result.sourceFilename} • Single-cell electroluminescence (EL)
                </p>
              </div>
            </div>
          }
          findingsNode={
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-[#F0F1F9]/50 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text">Defectiveness Score</span>
                  <span className="font-mono text-text-3">Decision Threshold: {thresholdPct}%</span>
                </div>

                {/* Progress gauge */}
                <div className="space-y-1.5">
                  <div className="relative h-4 w-full rounded-full bg-border overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        isDefective ? "bg-[#B45309]" : "bg-[#166534]"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, result.defectiveScorePct))}%` }}
                    />
                    {/* Threshold marker line */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-[#2F3A58] z-10"
                      style={{ left: `${thresholdPct}%` }}
                      title={`Decision Threshold: ${thresholdPct}%`}
                    />
                  </div>
                  <div className="flex justify-between text-xs font-mono text-text-3">
                    <span className="text-[#166534] font-medium">{`Predicted Healthy (< ${thresholdPct}%)`}</span>
                    <span className="font-semibold text-text">{`Threshold (${thresholdPct}%)`}</span>
                    <span className="text-[#B45309] font-medium">{`Predicted Defective (≥ ${thresholdPct}%)`}</span>
                  </div>
                </div>

                <p className="text-[11px] text-text-3 italic pt-1 border-t border-border/50">
                  This score is a model-estimated defectiveness probability based on single-cell EL patterns, not a certified quality measurement.
                </p>
              </div>

              {/* Contextual Operator Directive */}
              <div
                className={`rounded-xl border p-4 space-y-1.5 ${
                  isDefective
                    ? "bg-[#FEF3C7]/60 border-[#FCD34D] text-[#2F3A58]"
                    : "bg-[#DCFCE7]/60 border-[#86EFAC] text-[#2F3A58]"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isDefective ? (
                    <AlertTriangle className="h-4 w-4 text-[#B45309] shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-[#166534] shrink-0" />
                  )}
                  <h4 className="text-xs font-bold text-[#2F3A58]">
                    {isDefective
                      ? "Predicted Defective — Verification Required"
                      : "Predicted Healthy — Verification Required"}
                  </h4>
                </div>
                <p className="text-xs text-[#59647D] pl-6 leading-relaxed">
                  {isDefective
                    ? "The model estimates a higher likelihood of defects. An operator must inspect the cell and confirm the findings before making a quality decision."
                    : "The model estimates a low likelihood of defects. An operator must verify the cell before approving its quality."}
                </p>
              </div>

              <div className="text-xs text-text-2 space-y-1 pt-1">
                <p><strong>Input Scope:</strong> Complete single-cell EL image.</p>
                <p className="text-text-3 italic">
                  Research screening result only. Human review is required before a final quality decision.
                </p>
              </div>
            </div>
          }
          onRunAnother={() => {
            setResult(null);
            setSelectedFile(null);
            setImagePreview(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Cell Screening"
        description="Electroluminescence (EL) single-cell binary anomaly screening using EfficientNet-B0 trained on the ELPV benchmark."
        badge={<ModelBadge model="M2" />}
        actions={
          isDev && result && (
            <button
              onClick={() => setInspectorOpen(prev => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-2 hover:bg-[#F2DBD7]/50 hover:text-[#965660] transition-colors shadow-xs"
            >
              <Terminal className="h-3.5 w-3.5 text-[#965660]" />
              <span>Inspector</span>
              <kbd className="font-mono text-xs bg-surface-subtle px-1 rounded border border-border">
                I
              </kbd>
            </button>
          )
        }
      />

      {/* Mandatory Invariant Notice */}
      <NoticeBar
        tone="warning"
        message="Operator Verification Required: Human verification is required before a quality decision, regardless of the AI prediction."
        details={
          <p>
            Research screening result only. Human review is required before a final quality decision.
            Trained on academic ELPV dataset (2,624 images, threshold {configuredThreshold.toFixed(2)}). This model operates on cropped single cells
            and is designed for operational screening and defect prioritization, not autonomous cell rejection.
          </p>
        }
      />

      {/* Scope Restriction Notice */}
      <NoticeBar
        tone="info"
        message="Input Scope: Complete Single-Cell EL Images Only (resampled to 224×224). Do not upload multi-cell modules."
        details={
          <p>
            Model 1 (Defect Detection) and Model 2 (Cell Screening) operate on separate physical scopes.
            Model 2 expects a complete cropped cell frame. Max transport limit: 8 MiB.
          </p>
        }
      />

      {/* Auth Banner */}
      {!isAuthenticated && (
        <AuthPrompt
          variant="banner"
          description="Sign in as an authorized operator to execute the EfficientNet-B0 screening model."
          actionText="Sign In as Operator"
        />
      )}

      {/* Main Grid: Upload & Controls vs Output */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                Single-Cell Image Input
              </span>
              <Scan className="h-4 w-4 text-sapphire" />
            </div>

            {/* Dropzone with 8 MiB limit */}
            <Dropzone
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
              onClearFile={handleClearFile}
              maxSizeBytes={8 * 1024 * 1024}
              title="Drop single-cell EL image here"
              subtitle="PNG, JPG, WEBP format up to 8 MiB. Clipboard paste supported."
            />

            {/* Benchmark Sample Gallery */}
            {isDev && (
              <SampleGallery
                samples={M2_SAMPLES}
                onSelectSample={handleFileSelect}
                selectedSampleId={selectedFile ? undefined : null}
              />
            )}

            {/* Execute Button */}
            <button
              disabled={!selectedFile || predictMutation.isPending}
              onClick={handleRunScreening}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#965660] py-2.5 text-xs font-semibold text-white hover:bg-[#7E454E] transition-all shadow-xs disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99]"
            >
              {predictMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Evaluating Cell Defectiveness Likelihood…</span>
                </>
              ) : (
                <>
                  <Scan className="h-4 w-4 text-white" />
                  <span>Run Cell Defect Screening</span>
                </>
              )}
            </button>
          </div>

          {/* Benchmark Provenance Card (Dev Mode) */}
          {isDev && benchmark && (
            <div className="rounded-xl border border-border bg-surface-subtle p-4 space-y-2 text-xs">
              <span className="font-semibold text-sapphire block">ELPV Benchmark Provenance</span>
              <div className="space-y-1 font-mono text-xs text-text-2">
                <div className="flex justify-between">
                  <span className="text-text-3">Dataset:</span>
                  <span>{benchmark.dataset} ({benchmark.testSetSize} test images)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-3">Accuracy / Recall:</span>
                  <span className="text-success font-semibold">
                    {(benchmark.accuracy * 100).toFixed(1)}% / {(benchmark.defectiveRecall * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-3">Precision / F1:</span>
                  <span>{(benchmark.defectivePrecision * 100).toFixed(1)}% / {(benchmark.f1Defective * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-3">Decision Cutoff:</span>
                  <span>τ = {benchmark.threshold.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Visual Preview & Diagnostic Result (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                  Screening Assessment
                </span>
                <h3 className="text-sm font-semibold text-sapphire">
                  {selectedFile ? selectedFile.name : "Awaiting Input Cell"}
                </h3>
              </div>

              {result && (
                <StatusBadge tone={isDefective ? "warning" : "success"}>
                  {isDefective ? "Predicted Defective" : "Predicted Healthy"}
                </StatusBadge>
              )}
            </div>

            {/* Image Canvas */}
            {imagePreview ? (
              <div className="rounded-xl border border-white/10 bg-zinc-950 p-4 flex flex-col items-center justify-center min-h-[300px]">
                <img
                  src={imagePreview}
                  alt="Cell preview"
                  className="max-h-[320px] w-auto object-contain rounded-lg border border-white/10"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-subtle p-8 text-center min-h-[300px]">
                <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-surface text-text-3 border border-border">
                  <Scan className="h-5 w-5 text-sapphire" />
                </div>
                <h4 className="text-xs font-semibold text-text">No Cell Loaded</h4>
                <p className="mt-1 text-xs text-text-3 max-w-xs leading-relaxed">
                  Upload an EL cell frame or click a sample thumbnail on the left to run binary screening.
                </p>
              </div>
            )}

            {/* Cell Screening Result Panel */}
            {result && (
              <div className="space-y-4 pt-2">
                <div className="rounded-2xl border border-border bg-[#FFFFFF] p-5 space-y-5 shadow-xs">
                  {/* Panel Header */}
                  <div className="flex items-center justify-between border-b border-border/80 pb-3">
                    <div className="flex items-center gap-2">
                      {isDefective ? (
                        <ShieldAlert className="h-5 w-5 text-warning" />
                      ) : (
                        <ShieldCheck className="h-5 w-5 text-success" />
                      )}
                      <h4 className="text-sm font-bold text-[#2F3A58]">Cell Screening Result</h4>
                    </div>
                    <StatusBadge tone={isDefective ? "warning" : "success"}>
                      {isDefective ? "Predicted Defective" : "Predicted Healthy"}
                    </StatusBadge>
                  </div>

                  {/* Primary Result Hierarchy Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Prediction */}
                    <div className="rounded-xl border border-border/70 bg-[#F0F1F9]/40 p-3.5 space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#59647D] block">
                        Prediction
                      </span>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        {isDefective ? (
                          <>
                            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                            <span className="font-bold text-sm text-warning">Predicted Defective</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                            <span className="font-bold text-sm text-success">Predicted Healthy</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Defectiveness Score */}
                    <div className="rounded-xl border border-border/70 bg-[#F0F1F9]/40 p-3.5 space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#59647D] block">
                        Defectiveness Score
                      </span>
                      <div className="flex items-baseline gap-2 pt-0.5">
                        <span className="text-xl font-bold font-mono text-[#2F3A58]">
                          {result.defectiveScorePct}%
                        </span>
                        {isDev && (
                          <span className="text-[11px] font-mono text-[#59647D]">
                            (raw: {result.rawDefectiveScore.toFixed(4)})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Decision Threshold */}
                    <div className="rounded-xl border border-border/70 bg-[#F0F1F9]/40 p-3.5 space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#59647D] block">
                        Decision Threshold
                      </span>
                      <div className="flex items-baseline gap-1.5 pt-0.5">
                        <span className="text-base font-bold font-mono text-[#2F3A58]">
                          {thresholdPct}%
                        </span>
                        <span className="text-xs text-[#59647D]">
                          (cutoff τ = {configuredThreshold.toFixed(2)})
                        </span>
                      </div>
                    </div>

                    {/* Operator Verification */}
                    <div className="rounded-xl border border-border/70 bg-[#F0F1F9]/40 p-3.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#59647D] block">
                          Operator Verification
                        </span>
                        <span className="inline-flex items-center rounded-md bg-[#F2DBD7] px-2 py-0.5 text-xs font-semibold text-[#965660] border border-[#965660]/20">
                          Required
                        </span>
                      </div>
                      <p className="text-[11px] leading-snug text-[#59647D] pt-0.5">
                        Human verification is required before a quality decision, regardless of the AI prediction.
                      </p>
                    </div>
                  </div>

                  {/* Improved Probability Gauge */}
                  <div className="rounded-xl border border-border bg-[#F0F1F9]/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-[#2F3A58]">Defectiveness Score</span>
                        <p className="text-[11px] text-[#59647D]">
                          Model-estimated defect likelihood compared against 55% decision threshold
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold font-mono text-[#2F3A58]">
                          {result.defectiveScorePct}%
                        </span>
                      </div>
                    </div>

                    {/* Visual Track */}
                    <div className="space-y-1.5 pt-1">
                      <div className="relative h-4 w-full rounded-full bg-[#D9DDEB] overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            isDefective ? "bg-[#B45309]" : "bg-[#166534]"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, result.defectiveScorePct))}%` }}
                        />
                        {/* 55% Decision Threshold Marker Line */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-[#2F3A58] z-10"
                          style={{ left: `${thresholdPct}%` }}
                          title={`Decision Threshold: ${thresholdPct}%`}
                        />
                      </div>

                      {/* Region and Threshold Labels */}
                      <div className="flex items-center justify-between text-xs font-medium pt-0.5">
                        <div className="flex items-center gap-1.5 text-[#166534]">
                          <span className="h-2 w-2 rounded-full bg-[#166534]" />
                          <span>{`Predicted Healthy (< ${thresholdPct}%)`}</span>
                        </div>
                        <div className="font-mono text-[11px] font-semibold text-[#2F3A58] bg-[#FFFFFF] px-2 py-0.5 rounded border border-border shadow-2xs">
                          {`Threshold: ${thresholdPct}%`}
                        </div>
                        <div className="flex items-center gap-1.5 text-[#B45309]">
                          <span className="h-2 w-2 rounded-full bg-[#B45309]" />
                          <span>{`Predicted Defective (≥ ${thresholdPct}%)`}</span>
                        </div>
                      </div>
                    </div>

                    {/* Disclaimer Note */}
                    <p className="text-[11px] text-[#59647D] italic pt-1 border-t border-border/50">
                      This score is a model-estimated defectiveness probability, not a certified quality measurement.
                    </p>
                  </div>

                  {/* Contextual Operator Directive */}
                  <div
                    className={`rounded-xl border p-4 space-y-1.5 transition-colors ${
                      isDefective
                        ? "bg-[#FEF3C7]/60 border-[#FCD34D] text-[#2F3A58]"
                        : "bg-[#DCFCE7]/60 border-[#86EFAC] text-[#2F3A58]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isDefective ? (
                        <AlertTriangle className="h-4 w-4 text-[#B45309] shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-[#166534] shrink-0" />
                      )}
                      <h4 className="text-xs font-bold text-[#2F3A58]">
                        {isDefective
                          ? "Predicted Defective — Verification Required"
                          : "Predicted Healthy — Verification Required"}
                      </h4>
                    </div>
                    <p className="text-xs text-[#59647D] pl-6 leading-relaxed">
                      {isDefective
                        ? "The model estimates a higher likelihood of defects. An operator must inspect the cell and confirm the findings before making a quality decision."
                        : "The model estimates a low likelihood of defects. An operator must verify the cell before approving its quality."}
                    </p>
                  </div>

                  {/* Bottom Mandatory Human Review Disclaimer */}
                  <div className="flex items-center justify-center gap-1.5 text-center text-xs text-[#59647D] pt-1 border-t border-border/60">
                    <Info className="h-3.5 w-3.5 text-[#965660] shrink-0" />
                    <span>Research screening result only. Human review is required before a final quality decision.</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recent Cell Screening History */}
          {historyQuery.data && historyQuery.data.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-sapphire">Recent Cell Screening History</h4>
                <span className="font-mono text-[11px] text-text-3">
                  {historyQuery.data.length} recorded
                </span>
              </div>
              <div className="divide-y divide-border/60 text-xs">
                {historyQuery.data.slice(0, 5).map((item: any) => {
                  const scorePct =
                    item.defectiveScorePct != null
                      ? item.defectiveScorePct
                      : item.metadata?.defectiveScorePct != null
                      ? item.metadata.defectiveScorePct
                      : typeof item.defectiveProbability === "number"
                      ? Math.round(item.defectiveProbability * 10000) / 100
                      : null;
                  const scoreFormatted =
                    scorePct != null ? `${Number(scorePct).toFixed(2)}%` : "—";
                  const itemThreshold =
                    item.metadata?.thresholdPct != null
                      ? item.metadata.thresholdPct
                      : typeof item.threshold === "number"
                      ? Math.round(item.threshold * 100)
                      : 55;
                  const isDefectiveItem =
                    item.predictedClass === "defective" || (scorePct != null && scorePct >= itemThreshold);
                  const statusLabel = isDefectiveItem ? "Predicted Defective" : "Predicted Healthy";
                  const filename =
                    item.sourceFilename ||
                    item.filename ||
                    (item.id ? `Screening ${item.id.slice(0, 8)}` : `${statusLabel} Cell Scan`);

                  return (
                    <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text truncate" title={filename}>
                          {filename}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs text-text-3">
                            {new Date(item.createdAt).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-[#965660] font-medium bg-[#F2DBD7]/70 px-1.5 py-0.2 rounded border border-[#965660]/20">
                            Verification Required
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge tone={isDefectiveItem ? "warning" : "success"}>
                          <span className="font-medium">
                            {`${statusLabel} (${scoreFormatted})`}
                          </span>
                        </StatusBadge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dev Mode Inspector Drawer */}
      {isDev && (
        <Inspector
          open={inspectorOpen}
          onClose={() => setInspectorOpen(false)}
          data={{
            resultSummary: result
              ? {
                  screeningId: result.screeningId,
                  prediction: isDefective ? "Predicted Defective" : "Predicted Healthy",
                  predictedClass: result.predictedClass,
                  defectivenessScorePct: `${result.defectiveScorePct}%`,
                  rawDefectiveScore: result.rawDefectiveScore,
                  decisionThreshold: `${thresholdPct}%`,
                  operatorVerification: "Required",
                  decision: result.decision,
                }
              : undefined,
            requestInfo: selectedFile
              ? {
                  filename: selectedFile.name,
                  mimeType: selectedFile.type,
                  sizeBytes: selectedFile.size,
                }
              : undefined,
            rawResponse: result,
            modelInfo: {
              model: "EfficientNet-B0 Binary Defect Classifier",
              dataset: "ELPV (2,624 single cell images)",
              cutoff: `τ = ${configuredThreshold.toFixed(2)} (${thresholdPct}%)`,
            },
            storageInfo: {
              target: "SQLite (model2_screening_history)",
              recordId: result?.screeningId,
              persisted: true,
            },
          }}
        />
      )}
    </div>
  );
}

export default CellScreeningView;
