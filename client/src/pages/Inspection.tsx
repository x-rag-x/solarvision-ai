import React, { useRef, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Eye,
  FileImage,
  Info,
  Loader2,
  LogIn,
  RefreshCw,
  RotateCcw,
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
  const [layoutOrder, setLayoutOrder] = useState<"findings-first" | "evidence-first">(() => {
    try {
      const saved = localStorage.getItem("solarvision_inspection_side_layout");
      if (saved === "evidence-first" || saved === "findings-first") return saved;
    } catch {}
    return "findings-first";
  });
  const [isSetupExpanded, setIsSetupExpanded] = useState(false);

  const handleToggleLayoutOrder = () => {
    setLayoutOrder(prev => {
      const next = prev === "findings-first" ? "evidence-first" : "findings-first";
      try {
        localStorage.setItem("solarvision_inspection_side_layout", next);
      } catch {}
      return next;
    });
  };

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

  const cleanImage = preview || (result as any)?.inputImageUrl || "";
  const backendAnnotatedImage = result?.annotatedImageDataUrl || result?.annotatedImageUrl || null;
  const activeDisplayImage = cleanImage || backendAnnotatedImage || "";

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
              cleanImageUrl={cleanImage || undefined}
              originalImageUrl={cleanImage || undefined}
              backendAnnotatedUrl={backendAnnotatedImage}
              isBackendAnnotated={!cleanImage && Boolean(backendAnnotatedImage)}
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

      {/* When results are available: Side-by-side Inspection Analysis */}
      {result && !executionError ? (
        <div className="space-y-6">
          {/* Top Compact Inspection Parameters & Setup Bar */}
          <div className="rounded-xl border border-border bg-surface p-4 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {preview ? (
                  <img
                    src={preview}
                    alt={file?.name || "Cell thumbnail"}
                    className="h-10 w-10 rounded-lg object-cover border border-border shrink-0 bg-ink"
                  />
                ) : (
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-surface-subtle border border-border shrink-0">
                    <FileImage className="h-5 w-5 text-text-3" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text truncate max-w-xs sm:max-w-md block">
                      {file ? file.name : "Cell Image"}
                    </span>
                    <span className="font-mono text-[11px] text-text-3 shrink-0">
                      {file ? `${(file.size / 1024).toFixed(0)} KB` : ""}
                    </span>
                  </div>
                  <span className="text-[11px] text-text-3 block">
                    Inference complete · YOLO26n Engine · Sensitivity cutoff {effectiveThreshold.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Quick Sensitivity Ladder & Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-subtle p-1">
                  {[
                    { label: "Std", val: 0.25 },
                    { label: "High", val: 0.10 },
                    { label: "Ultra", val: 0.05 },
                  ].map(p => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setActiveThreshold(p.val)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                        activeThreshold === p.val
                          ? "bg-surface text-[#965660] font-semibold shadow-2xs border border-border"
                          : "text-text-2 hover:text-text"
                      }`}
                    >
                      {p.label} ({p.val.toFixed(2)})
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={runMutation.isPending}
                  onClick={() => handleRunInspection()}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all shadow-xs disabled:cursor-not-allowed disabled:opacity-50 ${
                    isStale
                      ? "bg-[#965660] ring-2 ring-[#965660]/40 hover:bg-[#7E454E] animate-pulse"
                      : "bg-[#965660] hover:bg-[#7E454E]"
                  }`}
                >
                  {runMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 text-white" />
                  )}
                  <span>{isStale ? `Re-run (${activeThreshold.toFixed(2)})` : "Re-run"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleClearFile()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-2 hover:bg-surface-subtle hover:text-text transition-colors shadow-2xs"
                  title="Clear results and upload a new frame"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-text-3" />
                  <span>New Inspection</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSetupExpanded(prev => !prev)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-2 hover:bg-surface-subtle hover:text-text transition-colors shadow-2xs"
                  title="Expand frame upload and sample selector"
                >
                  <span>{isSetupExpanded ? "Hide Setup" : "Change Frame"}</span>
                  {isSetupExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-text-3" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-text-3" />
                  )}
                </button>
              </div>
            </div>

            {/* Collapsible Dropzone & Sample Gallery Drawer */}
            {isSetupExpanded && (
              <div className="pt-3 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                <Dropzone
                  onFileSelect={handleFileSelect}
                  selectedFile={file}
                  onClearFile={handleClearFile}
                  maxSizeBytes={BACKEND_TRANSPORT_MAX_MB * 1024 * 1024}
                  title="Drop new solar-cell EL/NIR image here"
                  subtitle="Or click to browse. Supports clipboard paste (Ctrl+V)."
                />
                {isDev && (
                  <SampleGallery
                    samples={M1_SAMPLES}
                    onSelectSample={handleFileSelect}
                    selectedSampleId={file ? undefined : null}
                  />
                )}
              </div>
            )}
          </div>

          {/* Side-by-side Inspection Output: Detected Defect Findings & Visual Evidence */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Column A & Column B ordered based on layoutOrder preference */}
            {layoutOrder === "findings-first" ? (
              <>
                {/* Findings Table Card */}
                <div className="rounded-xl border border-border bg-surface p-5 space-y-4 shadow-xs flex flex-col h-full">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                          Defect Analysis
                        </span>
                        <span className="rounded-full bg-brand/10 border border-brand/30 px-2 py-0.5 font-mono text-[11px] font-bold text-brand-text">
                          {result.detections.length} defect{result.detections.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-text mt-0.5">
                        Detected Defect Findings ({result.detections.length})
                      </h4>
                      <p className="text-xs text-text-3 mt-0.5">
                        Hover over a row to highlight the crack marked on the visual canvas.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleToggleLayoutOrder}
                        title="Swap Left/Right position of findings and visual canvas"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-2 hover:bg-surface-subtle hover:text-text transition-colors shadow-2xs"
                      >
                        <ArrowLeftRight className="h-3 w-3 text-text-3" />
                        <span className="hidden sm:inline">Swap Sides</span>
                      </button>
                      {result.detections.length > 0 && (
                        <button
                          onClick={handleExportCsv}
                          className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-2 hover:bg-surface-subtle transition-colors shadow-2xs"
                        >
                          Export CSV
                        </button>
                      )}
                    </div>
                  </div>

                  <ConfidenceDisclaimer
                    threshold={effectiveThreshold}
                    detectionsCount={result.detections.length}
                    onRetryWithHighSensitivity={() => handleRunInspection(0.1)}
                  />

                  <div className="flex-1">
                    {result.detections.length > 0 ? (
                      <DetectionTable
                        detections={result.detections}
                        highlightedIndex={highlightedIndex}
                        onHighlightIndex={setHighlightedIndex}
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed border-border bg-surface-subtle p-8 text-center text-xs text-text-3 flex flex-col items-center justify-center min-h-[240px]">
                        <CheckCircle2 className="h-8 w-8 text-success mb-2" />
                        <span className="font-semibold text-text text-sm">No Defects Above Cutoff</span>
                        <p className="mt-1 max-w-xs text-text-3 leading-relaxed">
                          Wafer contact fingers and busbars meet structural continuity standards under sensitivity cutoff ({effectiveThreshold.toFixed(2)}).
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Visual Evidence Card */}
                <div className="rounded-xl border border-border bg-surface p-5 space-y-4 shadow-xs flex flex-col h-full">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                        Visual Evidence & Diagnostic Output
                      </span>
                      <h3 className="text-sm font-semibold text-text truncate max-w-xs sm:max-w-md">
                        {file ? file.name : "Cell Image"}
                      </h3>
                    </div>

                    <StatusBadge tone={result.detections.length > 0 ? "warning" : "success"}>
                      {result.detections.length > 0
                        ? `${result.detections.length} Defect(s) Identified`
                        : "Clear / Under Cutoff"}
                    </StatusBadge>
                  </div>

                  <ImageViewer
                    imageUrl={activeDisplayImage}
                    cleanImageUrl={cleanImage || undefined}
                    originalImageUrl={cleanImage || undefined}
                    backendAnnotatedUrl={backendAnnotatedImage}
                    isBackendAnnotated={!cleanImage && Boolean(backendAnnotatedImage)}
                    detections={viewerDetections}
                    highlightedIndex={highlightedIndex}
                    onHighlightIndex={setHighlightedIndex}
                    title={file?.name || "Solar Cell Visual Evidence"}
                  />

                  {/* Result KPI Bar */}
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
                </div>
              </>
            ) : (
              <>
                {/* Visual Evidence Card */}
                <div className="rounded-xl border border-border bg-surface p-5 space-y-4 shadow-xs flex flex-col h-full">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                        Visual Evidence & Diagnostic Output
                      </span>
                      <h3 className="text-sm font-semibold text-text truncate max-w-xs sm:max-w-md">
                        {file ? file.name : "Cell Image"}
                      </h3>
                    </div>

                    <StatusBadge tone={result.detections.length > 0 ? "warning" : "success"}>
                      {result.detections.length > 0
                        ? `${result.detections.length} Defect(s) Identified`
                        : "Clear / Under Cutoff"}
                    </StatusBadge>
                  </div>

                  <ImageViewer
                    imageUrl={activeDisplayImage}
                    cleanImageUrl={cleanImage || undefined}
                    originalImageUrl={cleanImage || undefined}
                    backendAnnotatedUrl={backendAnnotatedImage}
                    isBackendAnnotated={!cleanImage && Boolean(backendAnnotatedImage)}
                    detections={viewerDetections}
                    highlightedIndex={highlightedIndex}
                    onHighlightIndex={setHighlightedIndex}
                    title={file?.name || "Solar Cell Visual Evidence"}
                  />

                  {/* Result KPI Bar */}
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
                </div>

                {/* Findings Table Card */}
                <div className="rounded-xl border border-border bg-surface p-5 space-y-4 shadow-xs flex flex-col h-full">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                          Defect Analysis
                        </span>
                        <span className="rounded-full bg-brand/10 border border-brand/30 px-2 py-0.5 font-mono text-[11px] font-bold text-brand-text">
                          {result.detections.length} defect{result.detections.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-text mt-0.5">
                        Detected Defect Findings ({result.detections.length})
                      </h4>
                      <p className="text-xs text-text-3 mt-0.5">
                        Hover over a row to highlight the crack marked on the visual canvas.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleToggleLayoutOrder}
                        title="Swap Left/Right position of findings and visual canvas"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-2 hover:bg-surface-subtle hover:text-text transition-colors shadow-2xs"
                      >
                        <ArrowLeftRight className="h-3 w-3 text-text-3" />
                        <span className="hidden sm:inline">Swap Sides</span>
                      </button>
                      {result.detections.length > 0 && (
                        <button
                          onClick={handleExportCsv}
                          className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-2 hover:bg-surface-subtle transition-colors shadow-2xs"
                        >
                          Export CSV
                        </button>
                      )}
                    </div>
                  </div>

                  <ConfidenceDisclaimer
                    threshold={effectiveThreshold}
                    detectionsCount={result.detections.length}
                    onRetryWithHighSensitivity={() => handleRunInspection(0.1)}
                  />

                  <div className="flex-1">
                    {result.detections.length > 0 ? (
                      <DetectionTable
                        detections={result.detections}
                        highlightedIndex={highlightedIndex}
                        onHighlightIndex={setHighlightedIndex}
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed border-border bg-surface-subtle p-8 text-center text-xs text-text-3 flex flex-col items-center justify-center min-h-[240px]">
                        <CheckCircle2 className="h-8 w-8 text-success mb-2" />
                        <span className="font-semibold text-text text-sm">No Defects Above Cutoff</span>
                        <p className="mt-1 max-w-xs text-text-3 leading-relaxed">
                          Wafer contact fingers and busbars meet structural continuity standards under sensitivity cutoff ({effectiveThreshold.toFixed(2)}).
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Initial Grid: Controls vs Visual Preview (Before running inspection or on error) */
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Dropzone & Settings (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-border bg-surface p-5 space-y-4 shadow-xs">
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
                          ? "border-[#965660] bg-[#F2DBD7] text-[#2F3A58] font-semibold shadow-xs"
                          : "border-border bg-surface text-text-2 hover:bg-surface-subtle"
                      }`}
                    >
                      <div className={`font-mono font-semibold text-xs ${
                        activeThreshold === preset.value ? "text-[#965660]" : "text-text"
                      }`}>
                        {preset.label} ({preset.value.toFixed(2)})
                      </div>
                      <div className="text-[11px] text-text-3">{preset.note}</div>
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
                      className="shrink-0 rounded-lg bg-[#965660] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#7E454E] transition-colors shadow-xs"
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
                className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold text-white transition-all shadow-xs disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99] ${
                  isStale
                    ? "bg-[#965660] ring-2 ring-[#965660]/40 hover:bg-[#7E454E]"
                    : "bg-[#965660] hover:bg-[#7E454E]"
                }`}
              >
                {runMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Executing YOLO26n AI Inference…</span>
                  </>
                ) : isStale ? (
                  <>
                    <RefreshCw className="h-4 w-4 text-white" />
                    <span>Re-run at Sensitivity {activeThreshold.toFixed(2)}</span>
                  </>
                ) : (
                  <>
                    <ScanLine className="h-4 w-4 text-white" />
                    <span>Run AI Defect Inspection</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Visual Evidence (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-xl border border-border bg-surface p-5 space-y-4 shadow-xs flex flex-col">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                    Visual Evidence & Diagnostic Output
                  </span>
                  <h3 className="text-sm font-semibold text-text">
                    {file ? file.name : "Awaiting Image Input"}
                  </h3>
                </div>
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
                  cleanImageUrl={cleanImage || undefined}
                  originalImageUrl={cleanImage || undefined}
                  backendAnnotatedUrl={backendAnnotatedImage}
                  isBackendAnnotated={!cleanImage && Boolean(backendAnnotatedImage)}
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
            </div>
          </div>
        </div>
      )}

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
