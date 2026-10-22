import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FileImage,
  Info,
  Loader2,
  LogIn,
  Maximize2,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  Sliders,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { PageIntro, StatusBadge } from "@/components/solarvision/Primitives";
import { createInspectionNotification } from "@/components/solarvision/notification-model";
import { DefectBadge } from "@/components/solarvision/DefectBadge";
import { DetectionTable } from "@/components/solarvision/DetectionTable";
import { ConfidenceDisclaimer } from "@/components/solarvision/ConfidenceDisclaimer";
import { ImageViewerModal } from "@/components/solarvision/ImageViewerModal";
import { AuthGuard, SessionExpiredBanner } from "@/components/solarvision/AuthGuard";
import { isUnauthorizedError, validateUploadFileSize, BACKEND_TRANSPORT_MAX_MB } from "@/lib/auth-helpers";
import { useInspectionSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { toast } from "sonner";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [settings] = useInspectionSettings();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [activeThreshold, setActiveThreshold] = useState<number>(settings.confidenceThreshold || 0.25);
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [executionError, setExecutionError] = useState<{ message: string; isAuth: boolean } | null>(null);
  const [viewMode, setViewMode] = useState<"annotated" | "original">("annotated");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const runMutation = trpc.inspection.run.useMutation();

  const chooseFile = (candidate?: File) => {
    if (!candidate) return;
    
    // Check file type
    const isImage = candidate.type.startsWith("image/") || /\.(jpe?g|png|webp|tiff?|bmp)$/i.test(candidate.name);
    if (!isImage) {
      toast.error("Unsupported file type. Please upload a valid EL/NIR image (.jpg, .png, .webp, .tif).");
      return;
    }

    // Check size limit reconciled with backend transport ceiling
    const validation = validateUploadFileSize(candidate, settings.maxUploadMb);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setFile(candidate);
    setPreview(URL.createObjectURL(candidate));
    setResult(null);
    setExecutionError(null);
    setViewMode("annotated");
  };

  const handleRunInspection = async (overrideThreshold?: number) => {
    if (!file) {
      toast.error("Please select an EL/NIR image before starting inspection.");
      return;
    }

    const confToUse = overrideThreshold ?? activeThreshold;
    if (overrideThreshold !== undefined) {
      setActiveThreshold(overrideThreshold);
    }

    setResult(null);
    setExecutionError(null);

    try {
      const base64Data = await fileToBase64(file);
      
      const payload: {
        filename: string;
        mimeType: string;
        base64Data: string;
        confidence?: number;
      } = {
        filename: file.name,
        mimeType: file.type || "image/jpeg",
        base64Data,
        confidence: confToUse,
      };

      const response = await (runMutation.mutateAsync as any)(payload) as InspectionResult;
      setResult(response);
      setViewMode("annotated");

      if (response.detections.length > 0) {
        toast.success(`Inspection complete — ${response.detections.length} defect(s) detected.`);
      } else {
        toast.info(`Inspection complete — 0 detections above threshold (${confToUse.toFixed(2)}).`);
      }

      window.dispatchEvent(
        new CustomEvent("solarvision:notification", {
          detail: createInspectionNotification(file.name, response.detections.length),
        })
      );
    } catch (error) {
      // CRITICAL: NEVER display authorization failure as a successful zero-defect inspection!
      const isAuth = isUnauthorizedError(error);
      const message = isAuth
        ? "Session expired or authentication required. Please sign in to run AI inspections."
        : error instanceof Error
        ? error.message
        : "Inspection execution failed";

      setResult(null);
      setExecutionError({ message, isAuth });
      toast.error(message);

      if (isAuth) {
        window.dispatchEvent(
          new CustomEvent("solarvision:notification", {
            detail: {
              title: "Authentication Required",
              message: "Your session has expired. Sign in to run AI inspections.",
              tone: "warning",
              href: "/inspection",
            },
          })
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("solarvision:notification", {
            detail: createInspectionNotification(file.name, 0, message),
          })
        );
      }
    }
  };

  const copyInspectionId = () => {
    if (!result?.inspectionId) return;
    navigator.clipboard.writeText(result.inspectionId);
    setCopiedId(true);
    toast.success("Inspection ID copied to clipboard");
    setTimeout(() => setCopiedId(false), 2000);
  };

  const effectiveThreshold = result?.inferenceConfiguration?.confidence_threshold ?? activeThreshold;
  const currentDisplayImage =
    viewMode === "annotated" && (result?.annotatedImageDataUrl || result?.annotatedImageUrl)
      ? result.annotatedImageDataUrl || result.annotatedImageUrl
      : preview;

  return (
    <AuthGuard
      title="Authentication required to run inspections"
      description="The YOLO26n AI computer vision pipeline is restricted to authenticated operators and quality engineers. Sign in to inspect cells, generate bounding box evidence, and persist results to the factory database."
    >
      <div>
        <PageIntro
          eyebrow="Computer Vision Pipeline"
          title="Run a new inspection."
          description="Upload an electroluminescence (EL) or near-infrared (NIR) solar cell frame to run the verified YOLO26n inference model. Results display authentic bounding boxes, confidence scores, and persist to history."
          action={
            <Link
              href="/history"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#F2B941] hover:text-[#0B0909]"
            >
              Open history <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />

        {executionError?.isAuth && (
          <SessionExpiredBanner onRetry={() => handleRunInspection()} />
        )}

        <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          {/* Left Column: Image Selection & Operator Controls */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(7,27,41,0.04)]">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F2B941]">Input Frame</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">Choose a solar-cell image</h2>
                </div>
                <FileImage className="h-5 w-5 text-slate-300" />
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/tiff,image/bmp"
                className="hidden"
                onChange={event => chooseFile(event.currentTarget.files?.[0])}
              />

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  event.preventDefault();
                  chooseFile(event.dataTransfer.files?.[0]);
                }}
                className="group flex min-h-[220px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-[#f8fafb] px-6 text-center transition-colors hover:border-[#F2B941] hover:bg-[#effcf9]"
              >
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#F2B941] shadow-sm transition-transform group-hover:-translate-y-1">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Drop an EL/NIR cell image here</p>
                <p className="mt-1 text-xs text-slate-400">or click to browse · PNG, JPG, WEBP, TIFF (Max {BACKEND_TRANSPORT_MAX_MB} MB)</p>
                {file && (
                  <div className="mt-4 flex items-center gap-2 rounded-full bg-[#FFF3C4] px-3 py-1 text-xs font-medium text-[#087e6d]">
                    <span className="max-w-[200px] truncate">{file.name}</span>
                    <span className="text-[10px] opacity-75">
                      ({(file.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                )}
              </button>

              {file && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#F4F0D7] px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileImage className="h-4 w-4 shrink-0 text-[#F2B941]" />
                    <span className="truncate text-xs font-medium text-slate-700">{file.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                      setResult(null);
                      setExecutionError(null);
                      if (inputRef.current) inputRef.current.value = "";
                    }}
                    className="rounded-lg p-1 text-slate-400 hover:text-slate-800 transition-colors"
                    aria-label="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Threshold / Sensitivity Settings Selector */}
              <div className="mt-5 rounded-xl border border-slate-200/80 bg-[#fcfcfd] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-[#F2B941]" />
                    <span className="text-xs font-semibold text-slate-700">Inference Sensitivity</span>
                  </div>
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                    Threshold: {activeThreshold.toFixed(2)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveThreshold(0.25)}
                    className={`rounded-xl border p-2.5 text-left text-xs transition-all ${
                      activeThreshold === 0.25
                        ? "border-[#F2B941] bg-[#FFF3C4] text-[#0B0909] font-medium shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <div className="font-semibold">Standard (0.25)</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Balanced Precision (Recommended)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveThreshold(0.10)}
                    className={`rounded-xl border p-2.5 text-left text-xs transition-all ${
                      activeThreshold === 0.10
                        ? "border-[#F2B941] bg-[#FFF3C4] text-[#0B0909] font-medium shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <div className="font-semibold">High Sensitivity (0.10)</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Catch faint cracks (+FP risk)</div>
                  </button>
                </div>
              </div>

              {/* Run Button */}
              <button
                disabled={!file || runMutation.isPending}
                onClick={() => handleRunInspection()}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B0909] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(7,27,41,0.14)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {runMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[#F2B941]" />
                    Running YOLO26n Inspection Pipeline…
                  </>
                ) : (
                  <>
                    <ScanLine className="h-4 w-4 text-[#F2B941]" />
                    Run AI inspection
                  </>
                )}
              </button>

              {runMutation.isPending && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-[11px] text-slate-500 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F2B941] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F2B941]"></span>
                  </span>
                  <span>Normalizing image & running Ultralytics YOLO26n anchor-free detection…</span>
                </div>
              )}
            </div>

            {/* Operational Guidance Card */}
            <div className="rounded-2xl border border-[#bceee4] bg-[#edfcf9] p-5">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#F2B941]" />
                <div>
                  <p className="text-xs font-semibold text-[#087e6d]">Authentic Model Inference</p>
                  <p className="mt-1 text-xs leading-5 text-[#247d70]">
                    Bounding boxes and labels are returned directly from the Python inference engine (`best.pt`).
                    No mock or synthetic detections are ever shown.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Evidence & Results */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(7,27,41,0.04)] flex flex-col">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F2B941]">Inspection Result</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">Visual Evidence</h2>
              </div>
              
              {result && !executionError && (
                <div className="flex items-center gap-2">
                  <StatusBadge tone={result.detections.length > 0 ? "warning" : "success"}>
                    {result.detections.length > 0
                      ? `${result.detections.length} Defect${result.detections.length === 1 ? "" : "s"} Found`
                      : "No Detections Above Cutoff"}
                  </StatusBadge>
                </div>
              )}
            </div>

            {/* Error State: Critical Guardrail so backend authorization error is NEVER shown as zero-defect result */}
            {executionError ? (
              <div className="flex flex-1 min-h-[380px] flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center">
                <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-rose-100 text-rose-600">
                  <ShieldAlert className="h-7 w-7" />
                </div>
                <h3 className="text-base font-semibold text-rose-950">
                  {executionError.isAuth ? "Authorization Required" : "Inspection Execution Failed"}
                </h3>
                <p className="mt-2 max-w-md text-xs leading-5 text-rose-700">
                  {executionError.message}
                </p>
                <div className="mt-6 flex items-center gap-3">
                  {executionError.isAuth ? (
                    <Button
                      onClick={() => startLogin()}
                      className="gap-2 rounded-xl bg-[#0B0909] px-5 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      <LogIn className="h-4 w-4 text-[#F2B941]" />
                      Sign In to Run Inspections
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleRunInspection()}
                      className="gap-2 rounded-xl bg-[#0B0909] px-5 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      <RefreshCw className="h-4 w-4 text-[#F2B941]" />
                      Retry Inspection
                    </Button>
                  )}
                </div>
              </div>
            ) : currentDisplayImage ? (
              <div className="relative overflow-hidden rounded-2xl bg-[#0B0909] flex flex-col items-center justify-center min-h-[380px]">
                {/* Image View Controls Toolbar */}
                <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
                  {result && (result.annotatedImageDataUrl || result.annotatedImageUrl) && preview && (
                    <div className="flex items-center rounded-xl bg-black/70 p-1 backdrop-blur-sm">
                      <button
                        onClick={() => setViewMode("annotated")}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                          viewMode === "annotated"
                            ? "bg-[#F2B941] text-[#0B0909]"
                            : "text-slate-300 hover:text-white"
                        }`}
                      >
                        Annotated YOLO
                      </button>
                      <button
                        onClick={() => setViewMode("original")}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                          viewMode === "original"
                            ? "bg-[#F2B941] text-[#0B0909]"
                            : "text-slate-300 hover:text-white"
                        }`}
                      >
                        Raw Input
                      </button>
                    </div>
                  )}

                  <div className="ml-auto">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsModalOpen(true)}
                      className="h-8 gap-1.5 rounded-xl bg-black/70 px-2.5 text-xs text-slate-200 backdrop-blur-sm hover:bg-black/90 hover:text-white"
                    >
                      <Maximize2 className="h-3.5 w-3.5 text-[#F2B941]" />
                      Zoom & Inspect
                    </Button>
                  </div>
                </div>

                <img
                  src={currentDisplayImage}
                  alt={result ? "Annotated solar-cell inspection" : "Selected solar-cell input"}
                  className="max-h-[500px] w-full object-contain p-2"
                />
              </div>
            ) : (
              <div className="flex flex-1 min-h-[380px] flex-col items-center justify-center rounded-2xl bg-[#F4F0D7] text-center p-6">
                <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white text-slate-300">
                  <ScanLine className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-600">Your annotated image will appear here</p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">
                  Select an EL/NIR cell image and run the AI inspection to view real model bounding boxes.
                </p>
              </div>
            )}

            {/* Result Metrics Strip */}
            {result && !executionError && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-[#F4F0D7] p-3.5">
                    <p className="text-[11px] text-slate-500 font-medium">Detections</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{result.detections.length}</p>
                  </div>
                  <div className="rounded-xl bg-[#F4F0D7] p-3.5">
                    <p className="text-[11px] text-slate-500 font-medium">Inference Latency</p>
                    <p className="mt-1 font-mono text-xl font-semibold text-slate-900">
                      {Math.round(result.processingTimeMs)}{" "}
                      <span className="text-xs font-normal text-slate-500">ms</span>
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#F4F0D7] p-3.5">
                    <p className="text-[11px] text-slate-500 font-medium">Confidence Cutoff</p>
                    <p className="mt-1 font-mono text-xl font-semibold text-slate-900">
                      {effectiveThreshold.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#F4F0D7] p-3.5">
                    <p className="text-[11px] text-slate-500 font-medium">Storage Sync</p>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-700" title={result.persistence}>
                      {result.persistence.replaceAll(",", " · ")}
                    </p>
                  </div>
                </div>

                {/* Action Buttons: Open Stored Inspection & Copy ID */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyInspectionId}
                      className="h-9 gap-1.5 text-xs text-slate-600 hover:text-slate-900"
                    >
                      <Copy className="h-3.5 w-3.5 text-[#F2B941]" />
                      {copiedId ? "Copied ID!" : `ID: ${result.inspectionId.slice(0, 8)}…`}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setLocation(`/inspection/${result.inspectionId}`)}
                      className="h-9 gap-1.5 rounded-xl bg-[#0B0909] px-4 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-[#F2B941]" />
                      Open Stored Inspection Record
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Detections & Confidence Disclaimer Section */}
        {result && !executionError && (
          <div className="mt-6 space-y-5">
            <ConfidenceDisclaimer
              threshold={effectiveThreshold}
              detectionsCount={result.detections.length}
              onRetryWithHighSensitivity={() => handleRunInspection(0.10)}
            />

            {result.detections.length > 0 && (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(7,27,41,0.04)]">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#FFF3C4] text-[#0B0909]">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">Detected Defects ({result.detections.length})</h2>
                      <p className="text-xs text-slate-400">
                        Real YOLO26n coordinates, class labels, and model confidence scores
                      </p>
                    </div>
                  </div>

                  <span className="text-xs text-slate-500 font-mono">
                    Engine: YOLO26n · Conf ≥ {effectiveThreshold.toFixed(2)}
                  </span>
                </div>

                <DetectionTable detections={result.detections} />
              </div>
            )}
          </div>
        )}

        {/* Zoom / Fullscreen Modal */}
        {file && (
          <ImageViewerModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            originalUrl={preview}
            annotatedUrl={result?.annotatedImageDataUrl || result?.annotatedImageUrl}
            filename={file.name}
            detectionsCount={result?.detections.length ?? 0}
          />
        )}
      </div>
    </AuthGuard>
  );
}
