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

interface ScreeningResult {
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

export function CellScreeningView() {
  const { user, isAuthenticated } = useAuth();
  const { isDev, isProd } = useAppMode();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<ScreeningResult | null>(null);
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
      toast.success("Cell screening completed — Operator review required.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Cell screening failed");
    },
  });

  // 'I' key shortcut in Dev mode
  useEffect(() => {
    if (!isDev) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "i" || e.key === "I") && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setInspectorOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDev]);

  const handleFileSelect = (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image exceeds 8 MiB limit for cell defectiveness screening.");
      return;
    }

    setSelectedFile(file);
    setResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setResult(null);
  };

  const handleRunScreening = async () => {
    if (!isAuthenticated) {
      openOperatorLoginModal();
      return;
    }

    if (!selectedFile || !imagePreview) {
      toast.error("Please select a single-cell EL image before running screening.");
      return;
    }

    const base64Data = imagePreview.includes(",")
      ? imagePreview.split(",")[1]
      : imagePreview;

    predictMutation.mutate({
      filename: selectedFile.name,
      mimeType: selectedFile.type || "image/png",
      base64Data,
    });
  };

  const benchmark = statusQuery.data?.benchmark;

  // If in Prod mode and screening result is ready: render the full printable ReportLayout!
  if (isProd && result) {
    const isDefective = result.predictedClass === "defective";

    return (
      <div className="space-y-6">
        <ReportLayout
          title="Cell Defectiveness Screening Report"
          reportId={result.screeningId}
          timestamp={result.createdAt}
          operatorName={user?.name || "Authorized Operator"}
          modelBadge={<ModelBadge model="M2" readiness="Screening only" />}
          statusBadge={
            <StatusBadge tone={isDefective ? "warning" : "success"}>
              {isDefective ? "Flagged: Defective Cell" : "Screened: Healthy Cell"}
            </StatusBadge>
          }
          verdictHeadline={
            isDefective
              ? `Model predicts potential cell defectiveness (${result.defectiveScorePct}% score vs 55% threshold)`
              : `Cell classified as healthy (${result.defectiveScorePct}% score vs 55% threshold)`
          }
          verdictTone={isDefective ? "warning" : "success"}
          verdictStats={[
            { label: "Predicted State", value: isDefective ? "Defective" : "Healthy" },
            { label: "Anomaly Score", value: `${result.defectiveScorePct}%` },
            { label: "Review Status", value: "Pending Review" },
          ]}
          mandatoryNoticeNode={
            <NoticeBar
              tone="warning"
              message="Screening only: Mandatory operator review required. No automatic PASS/REJECT decision."
              details={
                <p>
                  Trained on academic ELPV dataset (2,624 images). Evaluated at threshold τ = 0.55.
                  Every classification output serves exclusively as diagnostic triage and requires confirmation by a human operator.
                </p>
              }
            />
          }
          evidenceNode={
            <div className="rounded-xl border border-border bg-ink p-4 flex flex-col items-center justify-center">
              <img
                src={result.imageUrl || imagePreview || ""}
                alt="Single Cell EL Evidence"
                className="max-h-[360px] w-auto object-contain rounded-lg border border-white/10"
              />
            </div>
          }
          findingsNode={
            <div className="rounded-xl border border-border bg-surface-subtle p-5 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-text">Anomaly Probability vs Cutoff Gauge</span>
                <span className="font-mono text-text-3">Threshold: 55.0%</span>
              </div>

              {/* Progress gauge */}
              <div className="space-y-1.5">
                <div className="relative h-4 w-full rounded-full bg-border overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isDefective ? "bg-warning" : "bg-success"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, result.defectiveScorePct))}%` }}
                  />
                  {/* Threshold marker line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-ink z-10"
                    style={{ left: "55%" }}
                    title="Threshold: 55%"
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-text-3">
                  <span>0% (Healthy)</span>
                  <span className="font-semibold text-text">Threshold (55%)</span>
                  <span>100% (Defective)</span>
                </div>
              </div>

              <div className="text-xs text-text-2 space-y-1 pt-1">
                <p><strong>Operational Summary:</strong> {result.summary}</p>
                <p><strong>Input Scope:</strong> Complete single-cell EL image.</p>
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-2 hover:bg-surface-subtle hover:text-text transition-colors shadow-xs"
            >
              <Terminal className="h-3.5 w-3.5 text-brand-text" />
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
        message="Mandatory operator review required on every prediction. No automatic PASS/REJECT decision."
        details={
          <p>
            Trained on academic ELPV dataset (2,624 images, threshold 0.55). This model operates on cropped single cells
            and is designed for operational screening and anomaly prioritization, not autonomous cell rejection.
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
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                Single-Cell Image Input
              </span>
              <Scan className="h-4 w-4 text-text-3" />
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 text-xs font-semibold text-white hover:bg-ink/90 transition-all shadow-xs disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99]"
            >
              {predictMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-brand" />
                  <span>Evaluating Cell Anomaly Likelihood…</span>
                </>
              ) : (
                <>
                  <Scan className="h-4 w-4 text-brand" />
                  <span>Run Cell Defect Screening</span>
                </>
              )}
            </button>
          </div>

          {/* Benchmark Provenance Card (Dev Mode) */}
          {isDev && benchmark && (
            <div className="rounded-xl border border-border bg-surface-subtle p-4 space-y-2 text-xs">
              <span className="font-semibold text-text block">ELPV Benchmark Provenance</span>
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
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                  Screening Assessment
                </span>
                <h3 className="text-sm font-semibold text-text">
                  {selectedFile ? selectedFile.name : "Awaiting Input Cell"}
                </h3>
              </div>

              {result && (
                <StatusBadge tone={result.predictedClass === "defective" ? "warning" : "success"}>
                  {result.predictedClass === "defective" ? "Defective Predicted" : "Healthy Predicted"}
                </StatusBadge>
              )}
            </div>

            {/* Image Canvas */}
            {imagePreview ? (
              <div className="rounded-xl border border-border bg-ink p-4 flex flex-col items-center justify-center min-h-[300px]">
                <img
                  src={imagePreview}
                  alt="Cell preview"
                  className="max-h-[320px] w-auto object-contain rounded-lg border border-white/10"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-subtle p-8 text-center min-h-[300px]">
                <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-surface text-text-3 border border-border">
                  <Scan className="h-5 w-5 text-text-2" />
                </div>
                <h4 className="text-xs font-semibold text-text">No Cell Loaded</h4>
                <p className="mt-1 text-xs text-text-3 max-w-xs leading-relaxed">
                  Upload an EL cell frame or click a sample thumbnail on the left to run binary screening.
                </p>
              </div>
            )}

            {/* Result Findings Strip */}
            {result && (
              <div className="space-y-4 pt-2">
                <div className="rounded-xl border border-border bg-surface-subtle p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-text">Anomaly Probability Gauge</span>
                    <span className="font-mono text-text-3">Cutoff: 55.0%</span>
                  </div>

                  <div className="space-y-1">
                    <div className="relative h-3 w-full rounded-full bg-border overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          result.predictedClass === "defective" ? "bg-warning" : "bg-success"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, result.defectiveScorePct))}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-ink z-10"
                        style={{ left: "55%" }}
                      />
                    </div>
                    <div className="flex justify-between text-xs font-mono text-text-3">
                      <span>0%</span>
                      <span className="font-semibold text-text">55%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border/60 text-xs">
                    <div>
                      <span className="text-text-3 block text-xs">Verdict</span>
                      <span className="font-semibold text-text capitalize">{result.predictedClass}</span>
                    </div>
                    <div>
                      <span className="text-text-3 block text-xs">Anomaly Score</span>
                      <span className="font-mono font-semibold text-text">
                        {isDev ? `${result.rawDefectiveScore.toFixed(4)} (${result.defectiveScorePct}%)` : `${result.defectiveScorePct}%`}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-3 block text-xs">Review Required</span>
                      <span className="font-semibold text-warning">Mandatory</span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-text-2 bg-warning-tint/30 border border-warning/20 p-3 rounded-xl">
                  <strong>Operator Directive:</strong> {result.summary}
                </div>
              </div>
            )}
          </div>

          {/* Recent Cell Screening History */}
          {historyQuery.data && historyQuery.data.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-text">Recent Cell Screening History</h4>
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
                  const isDefective = item.predictedClass === "defective";
                  const statusLabel = isDefective ? "Defective" : "Healthy";
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
                        <p className="font-mono text-xs text-text-3">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge tone={isDefective ? "warning" : "success"}>
                          <span className="font-medium capitalize">
                            {statusLabel} ({scoreFormatted})
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
                  predictedClass: result.predictedClass,
                  defectiveScorePct: result.defectiveScorePct,
                  rawDefectiveScore: result.rawDefectiveScore,
                  threshold: result.thresholdPct,
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
              cutoff: "τ = 0.55",
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
