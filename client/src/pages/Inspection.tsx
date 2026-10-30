import React, { useRef, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileImage,
  Info,
  Loader2,
  LogIn,
  RefreshCw,
  ScanLine,
  Sliders,
  Sparkles,
  Terminal,
  Printer,
  Share2,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAppMode } from "@/contexts/ModeContext";
import { useInspectionSettings } from "@/lib/settings";
import { isUnauthorizedError, validateUploadFileSize, BACKEND_TRANSPORT_MAX_MB } from "@/lib/auth-helpers";
import { openOperatorLoginModal } from "@/const";
import { createInspectionNotification } from "@/components/solarvision/notification-model";
import { toast } from "sonner";

// Shared SolarVision Components
import PageHeader from "@/components/solarvision/PageHeader";
import StatusBadge from "@/components/solarvision/StatusBadge";
import ModelBadge from "@/components/solarvision/ModelBadge";
import NoticeBar from "@/components/solarvision/NoticeBar";
import Dropzone from "@/components/solarvision/Dropzone";
import SampleGallery, { M1_SAMPLES } from "@/components/solarvision/SampleGallery";
import ImageViewer from "@/components/solarvision/ImageViewer";
import DetectionTable from "@/components/solarvision/DetectionTable";
import ConfidenceDisclaimer from "@/components/solarvision/ConfidenceDisclaimer";
import ReportLayout from "@/components/solarvision/ReportLayout";
import Inspector from "@/components/solarvision/Inspector";
import AuthPrompt from "@/components/solarvision/AuthPrompt";
import { ErrorState } from "@/components/solarvision/StateComponents";

interface DetectionResult {
  defect_type: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface InspectionResult {
  inspectionId: string;
  sourceFilename: string;
  modelName: string;
  processingTimeMs: number;
  detections: DetectionResult[];
  annotatedImageDataUrl?: string | null;
  annotatedImageUrl?: string | null;
  persistence: string;
  inferenceConfiguration?: {
    confidence_threshold: number;
    iou_threshold?: number;
    image_size?: number;
  } | null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      resolve(value.includes(",") ? value.slice(value.indexOf(",") + 1) : value);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function Inspection() {
  const [, setLocation] = useLocation();
  const [settings] = useInspectionSettings();
  const { user } = useAuth();
  const { isDev, isProd } = useAppMode();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [activeThreshold, setActiveThreshold] = useState<number>(settings.confidenceThreshold || 0.25);
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [executionError, setExecutionError] = useState<{ message: string; isAuth: boolean } | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [startTimeMs, setStartTimeMs] = useState<number | null>(null);
  const [roundTripMs, setRoundTripMs] = useState<number | null>(null);

  const runMutation = trpc.inspection.run.useMutation();

  // Listen to 'I' keyboard shortcut in Dev mode to toggle inspector
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

  const handleFileSelect = (candidate: File) => {
    const validation = validateUploadFileSize(candidate, settings.maxUploadMb);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setFile(candidate);
    setPreview(URL.createObjectURL(candidate));
    setResult(null);
    setExecutionError(null);
  };

  const handleClearFile = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setExecutionError(null);
  };

  const handleRunInspection = async (overrideThreshold?: number) => {
    if (!file) {
      toast.error("Please upload or select an EL/NIR cell image first.");
      return;
    }

    if (!user) {
      toast.info("Operator authorization required to run YOLO26n AI inspection.");
      openOperatorLoginModal();
      return;
    }

    const confToUse = overrideThreshold ?? activeThreshold;
    if (overrideThreshold !== undefined) {
      setActiveThreshold(overrideThreshold);
    }

    setResult(null);
    setExecutionError(null);
    const start = performance.now();
    setStartTimeMs(start);

    try {
      const base64Data = await fileToBase64(file);

      const payload = {
        filename: file.name,
        mimeType: file.type || "image/jpeg",
        base64Data,
        confidence: confToUse,
        imageSize: settings.imageSize,
      };

      const response = (await (runMutation.mutateAsync as any)(payload)) as InspectionResult;
      const end = performance.now();
      setRoundTripMs(end - start);
      setResult(response);

      if (response.detections.length > 0) {
        toast.success(`Inspection complete — ${response.detections.length} defect(s) detected.`);
      } else {
        toast.info(`Inspection complete — 0 detections above cutoff (${confToUse.toFixed(2)}).`);
      }

      window.dispatchEvent(
        new CustomEvent("solarvision:notification", {
          detail: createInspectionNotification(file.name, response.detections.length),
        })
      );
    } catch (error) {
      const isAuth = isUnauthorizedError(error);
      const message = isAuth
        ? "Session expired or authentication required. Please sign in to run AI inspections."
        : error instanceof Error
        ? error.message
        : "Inspection execution failed";

      setResult(null);
      setExecutionError({ message, isAuth });
      toast.error(message);

      window.dispatchEvent(
        new CustomEvent("solarvision:notification", {
          detail: createInspectionNotification(file.name, 0, message),
        })
      );
    }
  };

  const resultThreshold = result?.inferenceConfiguration?.confidence_threshold;
  const isStale = Boolean(
    result &&
      !executionError &&
      resultThreshold !== undefined &&
      Math.abs(resultThreshold - activeThreshold) > 0.001
  );
  const effectiveThreshold = resultThreshold ?? activeThreshold;

  // Convert detections to viewer boxes
  const viewerDetections = (result?.detections || []).map((d, i) => ({
    id: i,
    class: d.defect_type,
    label: d.defect_type,
    confidence: d.confidence,
    bbox: [d.x1, d.y1, d.x2, d.y2] as [number, number, number, number],
  }));

  const activeDisplayImage = result?.annotatedImageDataUrl || result?.annotatedImageUrl || preview || "";

  // Export CSV handler
  const handleExportCsv = () => {
    if (!result || result.detections.length === 0) {
      toast.info("No defect records to export.");
      return;
    }

    const headers = "Class,Severity,Confidence,X1,Y1,X2,Y2\n";
    const rows = result.detections
      .map(d => `${d.defect_type},high,${(d.confidence * 100).toFixed(1)}%,${d.x1},${d.y1},${d.x2},${d.y2}`)
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `solarvision_inspection_${result.inspectionId.slice(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export downloaded");
  };

  // If in Prod mode and result is available: render the complete, clean ReportLayout!
  if (isProd && result && !executionError) {
    const defectCount = result.detections.length;
    const maxConfidence =
      defectCount > 0 ? Math.max(...result.detections.map(d => d.confidence)) : 0;

    return (
      <div className="space-y-6">
        <ReportLayout
          title="Electroluminescence Defect Inspection Report"
          reportId={result.inspectionId}
          timestamp={Date.now()}
          operatorName={user?.name || "Authorized Operator"}
          modelBadge={<ModelBadge model="M1" />}
          statusBadge={
            <StatusBadge tone={defectCount > 0 ? "warning" : "success"}>
              {defectCount > 0 ? `${defectCount} Defect(s) Flagged` : "Clear / Under Cutoff"}
            </StatusBadge>
          }
          verdictHeadline={
            defectCount > 0
              ? `${defectCount} structural defect${defectCount === 1 ? "" : "s"} identified across wafer contact grid`
              : `No defect patterns detected above sensitivity cutoff (${effectiveThreshold.toFixed(2)})`
          }
          verdictTone={defectCount > 0 ? "warning" : "success"}
          verdictStats={[
            { label: "Total Defects", value: defectCount },
            {
              label: "Peak Confidence",
              value: defectCount > 0 ? `${(maxConfidence * 100).toFixed(1)}%` : "—",
            },
            {
              label: "Inference Time",
              value: `${Math.round(result.processingTimeMs)} ms`,
            },
          ]}
          mandatoryNoticeNode={
            <NoticeBar
              tone="warning"
              message="Academic prototype: not factory-certified. Zero detections does not certify a defect-free solar cell."
              details={
                <>
                  <p>
                    <strong>PVELAD Benchmark:</strong> Evaluated on 792 held-out electroluminescence images.
                    Bounding boxes reflect statistical pattern similarity above cutoff.
                  </p>
                  <p>
                    Faint micro-cracks or shallow hairline fractures with optical contrast below the detection
                    threshold ({effectiveThreshold.toFixed(2)}) require high-sensitivity manual review.
                  </p>
                </>
              }
            />
          }
          evidenceNode={
            <ImageViewer
              imageUrl={activeDisplayImage}
              originalImageUrl={preview || undefined}
              detections={viewerDetections}
              highlightedIndex={highlightedIndex}
              onHighlightIndex={setHighlightedIndex}
              title={file?.name || "Solar Cell Visual Evidence"}
            />
          }
          findingsNode={
            <DetectionTable
              detections={result.detections}
              highlightedIndex={highlightedIndex}
              onHighlightIndex={setHighlightedIndex}
            />
          }
          onRunAnother={() => {
            setResult(null);
            setFile(null);
            setPreview(null);
          }}
          onExportCsv={handleExportCsv}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Defect Detection"
        description="Run real-time YOLO26n computer vision inference on photovoltaic electroluminescence (EL) and near-infrared (NIR) cell images."
        badge={<ModelBadge model="M1" />}
        actions={
          <div className="flex items-center gap-2">
            {isDev && result && (
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
            )}
            <Link
              href="/history"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-2 hover:bg-surface-subtle hover:text-text transition-colors shadow-xs"
            >
              <span>Records</span>
              <ArrowRight className="h-3.5 w-3.5 text-text-3" />
            </Link>
          </div>
        }
      />

      {/* Mandatory Invariant Notice */}
      <NoticeBar
        tone="info"
        message="Academic prototype: not factory-production-certified. Bounding boxes represent statistical pattern correlation."
        details={
          <div>
            <p className="font-semibold text-text mb-1">PVELAD Benchmark Calibration</p>
            <p>
              YOLO26n single-stage anchor-free model trained on the PVELAD dataset. In accordance with zero-fabrication standards,
              coordinates are extracted directly from the authentic Python engine checkpoint without synthetic fabrication.
            </p>
          </div>
        }
      />

      {/* Sign-in prompt if unauthenticated */}
      {!user && (
        <AuthPrompt
          variant="banner"
          description="Sign in as an authorized operator to execute the YOLO26n pipeline and commit inspection results."
          actionText="Sign in as Operator"
        />
      )}

      {/* Dev Mode Explanation Strip */}
      {isDev && (
        <div className="rounded-xl border border-border bg-surface-subtle p-3.5 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-text uppercase tracking-wider text-xs">
              How it works (Dev Pipeline)
            </span>
            <span className="font-mono text-xs text-brand-text">YOLO26n · 640×640</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs text-text-2">
            <div className="rounded-lg bg-surface p-2 border border-border/60">
              <span className="font-semibold text-text block">1. Input Frame</span>
              EL/NIR 8-bit grayscale image transport ceiling {BACKEND_TRANSPORT_MAX_MB}MB.
            </div>
            <div className="rounded-lg bg-surface p-2 border border-border/60">
              <span className="font-semibold text-text block">2. Normalization</span>
              Letterbox scaling to 640px, contrast histogram balancing.
            </div>
            <div className="rounded-lg bg-surface p-2 border border-border/60">
              <span className="font-semibold text-text block">3. Inference</span>
              Anchor-free convolutional head computes box priors and class logits.
            </div>
            <div className="rounded-lg bg-surface p-2 border border-border/60">
              <span className="font-semibold text-text block">4. NMS & Persistence</span>
              IoU cutoff filter, bounding box rendering, database commit.
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Controls vs Visual Output */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Dropzone & Settings (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                Input Image Frame
              </span>
              <FileImage className="h-4 w-4 text-text-3" />
            </div>

            {/* Unified Dropzone */}
            <Dropzone
              onFileSelect={handleFileSelect}
              selectedFile={file}
              onClearFile={handleClearFile}
              maxSizeBytes={BACKEND_TRANSPORT_MAX_MB * 1024 * 1024}
              title="Drop solar-cell EL/NIR image here"
              subtitle="Or click to browse machine files. Supports clipboard paste (Ctrl+V)."
            />

            {/* Dev Mode Benchmark Samples Gallery */}
            {isDev && (
              <SampleGallery
                samples={M1_SAMPLES}
                onSelectSample={handleFileSelect}
                selectedSampleId={file ? undefined : null}
              />
            )}

            {/* Sensitivity Threshold Ladder (Dev always, Prod collapsed) */}
            <div
              className={`rounded-xl border p-3.5 space-y-2.5 transition-colors ${
                isStale ? "border-warning/50 bg-warning-tint/30" : "border-border bg-surface-subtle"
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-text flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-text-3" />
                  Sensitivity Threshold
                </span>
                <span className="font-mono font-semibold text-text bg-surface px-2 py-0.5 rounded border border-border">
                  Cutoff: {activeThreshold.toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { label: "Standard", value: 0.25, note: "Balanced" },
                  { label: "High", value: 0.1, note: "Faint cracks" },
                  { label: "Ultra", value: 0.05, note: "Deep search" },
                ].map(preset => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setActiveThreshold(preset.value)}
                    className={`rounded-lg border p-2 text-left transition-all ${
                      activeThreshold === preset.value
                        ? "border-brand bg-brand-tint text-text font-semibold shadow-xs"
                        : "border-border bg-surface text-text-2 hover:bg-surface-subtle"
                    }`}
                  >
                    <div className="font-mono font-semibold text-xs">
                      {preset.label} ({preset.value.toFixed(2)})
                    </div>
                    <div className="text-xs text-text-3">{preset.note}</div>
                  </button>
                ))}
              </div>

              {/* Stale sensitivity banner */}
              {isStale && (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-warning-tint p-2 text-xs text-text border border-warning/30">
                  <span className="text-xs truncate">
                    Threshold updated to <strong>{activeThreshold.toFixed(2)}</strong>.
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRunInspection()}
                    disabled={runMutation.isPending}
                    className="shrink-0 rounded bg-ink px-2 py-1 text-xs font-semibold text-white hover:bg-ink/90 transition-colors"
                  >
                    Re-run
                  </button>
                </div>
              )}
            </div>

            {/* Run Inference Action Button */}
            <button
              disabled={!file || runMutation.isPending}
              onClick={() => handleRunInspection()}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold text-white transition-all shadow-xs disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99] ${
                isStale
                  ? "bg-ink ring-2 ring-brand hover:bg-ink/90"
                  : "bg-ink hover:bg-ink/90"
              }`}
            >
              {runMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-brand" />
                  <span>Executing YOLO26n AI Inference…</span>
                </>
              ) : isStale ? (
                <>
                  <RefreshCw className="h-4 w-4 text-brand" />
                  <span>Re-run at Sensitivity {activeThreshold.toFixed(2)}</span>
                </>
              ) : (
                <>
                  <ScanLine className="h-4 w-4 text-brand" />
                  <span>Run AI Defect Inspection</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Visual Evidence & Findings (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-xs flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                  Visual Evidence & Diagnostic Output
                </span>
                <h3 className="text-sm font-semibold text-text">
                  {file ? file.name : "Awaiting Image Input"}
                </h3>
              </div>

              {result && !executionError && (
                <StatusBadge tone={result.detections.length > 0 ? "warning" : "success"}>
                  {result.detections.length > 0
                    ? `${result.detections.length} Defect(s) Identified`
                    : "Clear / Under Cutoff"}
                </StatusBadge>
              )}
            </div>

            {/* Execution Error state */}
            {executionError ? (
              <ErrorState
                title={executionError.isAuth ? "Authorization Required" : "Pipeline Execution Failed"}
                message={executionError.message}
                onRetry={() => handleRunInspection()}
              />
            ) : preview ? (
              <ImageViewer
                imageUrl={activeDisplayImage}
                originalImageUrl={preview || undefined}
                detections={viewerDetections}
                highlightedIndex={highlightedIndex}
                onHighlightIndex={setHighlightedIndex}
                title={file?.name || "Solar Cell Visual Evidence"}
              />
            ) : (
              <div className="flex flex-1 min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-subtle p-8 text-center">
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-surface text-text-3 border border-border">
                  <ScanLine className="h-6 w-6 text-text-2" />
                </div>
                <h4 className="text-xs sm:text-sm font-semibold text-text">
                  Inspection Canvas Idle
                </h4>
                <p className="mt-1 max-w-xs text-xs text-text-3 leading-relaxed">
                  Select an EL/NIR cell frame to view authentic bounding boxes, confidence overlays, and classification metrics.
                </p>
              </div>
            )}

            {/* Result KPI Bar */}
            {result && !executionError && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="rounded-xl border border-border bg-surface-subtle p-3">
                  <span className="text-xs text-text-3 block">Detections</span>
                  <span className="font-mono text-lg font-bold text-text tabular-nums">
                    {result.detections.length}
                  </span>
                </div>
                <div className="rounded-xl border border-border bg-surface-subtle p-3">
                  <span className="text-xs text-text-3 block">Latency</span>
                  <span className="font-mono text-lg font-bold text-text tabular-nums">
                    {Math.round(result.processingTimeMs)} ms
                  </span>
                </div>
                <div className="rounded-xl border border-border bg-surface-subtle p-3">
                  <span className="text-xs text-text-3 block">Cutoff</span>
                  <span className="font-mono text-lg font-bold text-text tabular-nums">
                    {effectiveThreshold.toFixed(2)}
                  </span>
                </div>
                <div className="rounded-xl border border-border bg-surface-subtle p-3">
                  <span className="text-xs text-text-3 block">Storage</span>
                  <span className="font-mono text-xs font-semibold text-success truncate block">
                    {result.persistence.split(",")[0] || "SQLite"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Detections Detail Table & Confidence Disclaimer */}
          {result && !executionError && (
            <div className="space-y-4">
              <ConfidenceDisclaimer
                threshold={effectiveThreshold}
                detectionsCount={result.detections.length}
                onRetryWithHighSensitivity={() => handleRunInspection(0.1)}
              />

              {result.detections.length > 0 && (
                <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-text">
                        Detected Defect Findings ({result.detections.length})
                      </h4>
                      <p className="text-xs text-text-3">
                        Hover over a row to highlight bounding box coordinates on the canvas.
                      </p>
                    </div>
                    <button
                      onClick={handleExportCsv}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-2 hover:bg-surface-subtle transition-colors"
                    >
                      Export CSV
                    </button>
                  </div>

                  <DetectionTable
                    detections={result.detections}
                    highlightedIndex={highlightedIndex}
                    onHighlightIndex={setHighlightedIndex}
                  />
                </div>
              )}
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
                  inspectionId: result.inspectionId,
                  defectCount: result.detections.length,
                  processingTimeMs: result.processingTimeMs,
                  persistence: result.persistence,
                }
              : undefined,
            requestInfo: file
              ? {
                  filename: file.name,
                  mimeType: file.type,
                  sizeBytes: file.size,
                  activeThreshold,
                  imageSize: settings.imageSize,
                }
              : undefined,
            rawResponse: result,
            modelInfo: {
              model: "YOLO26n Single-Stage Anchor-Free",
              checkpoint: "backend/models/best.pt",
              trainingDataset: "PVELAD (9 defect classes)",
              benchmarkEvaluation: "Held-out test set 792 images",
            },
            timingMs: {
              inference: result?.processingTimeMs,
              roundTrip: roundTripMs ?? undefined,
            },
            storageInfo: {
              target: result?.persistence,
              recordId: result?.inspectionId,
              persisted: Boolean(result?.inspectionId),
            },
            errorInfo: executionError,
          }}
        />
      )}
    </div>
  );
}
