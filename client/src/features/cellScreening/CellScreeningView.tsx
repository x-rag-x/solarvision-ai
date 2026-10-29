import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { openOperatorLoginModal } from "@/const";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
  UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [isSampleLoaded, setIsSampleLoaded] = useState(false);

  const statusQuery = trpc.model2Elpv.status.useQuery();
  const historyQuery = trpc.model2Elpv.history.useQuery(
    { limit: 20 },
    { enabled: isAuthenticated }
  );

  const predictMutation = trpc.model2Elpv.predict.useMutation({
    onSuccess: (data: any) => {
      setResult(data);
      historyQuery.refetch();
      toast.success("Cell screening completed — Manual review required.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Screening failed");
    },
  });

  const handleFileChange = (file?: File) => {
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/tiff", "image/bmp", "image/webp"];
    const isImage = allowed.includes(file.type.toLowerCase()) || /\.(png|jpe?g|tiff?|bmp|webp)$/i.test(file.name);

    if (!isImage) {
      toast.error("Unsupported file type. Please upload a single cell EL image (.png, .jpg, .tiff, .bmp, .webp).");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image exceeds 8 MiB limit for cell defectiveness screening.");
      return;
    }

    setSelectedFile(file);
    setIsSampleLoaded(false);
    setResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleLoadSample = async () => {
    try {
      const resp = await fetch("/model2_sample_elpv_cell.png");
      if (!resp.ok) throw new Error("Sample asset not found");
      const blob = await resp.blob();
      const file = new File([blob], "model2_sample_elpv_cell.png", { type: "image/png" });
      setSelectedFile(file);
      setIsSampleLoaded(true);
      setResult(null);

      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(blob);
      toast.info("Loaded benchmark sample ELPV single cell (300x300).");
    } catch (err) {
      toast.error("Failed to load sample cell image.");
    }
  };

  const handleRunScreening = async () => {
    if (!isAuthenticated) {
      openOperatorLoginModal();
      return;
    }

    if (!selectedFile || !imagePreview) {
      toast.error("Please upload or select a single solar cell EL image first.");
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

  return (
    <div className="space-y-8 p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header & Subtitle */}
      <div className="border-b border-slate-300/70 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#F2B941]/20 px-2.5 py-0.5 text-xs font-semibold text-[#8b6508] border border-[#F2B941]/40">
                Model 2
              </span>
              <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-mono text-slate-700">
                EfficientNet-B0 (ELPV)
              </span>
              <span className="rounded-md bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 text-xs font-medium">
                Research Screening Only
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Model 2 — Cell Defectiveness Screening
            </h1>
            <p className="mt-1 text-sm text-slate-600 max-w-3xl">
              Electroluminescence (EL) full-cell binary anomaly screening. Evaluates individual cropped solar cells
              against the academic ELPV benchmark. Requires mandatory operator review on every prediction.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isAuthenticated ? (
              <Button
                onClick={() => openOperatorLoginModal()}
                className="bg-[#0B0909] text-white hover:bg-slate-800"
              >
                <LogIn className="mr-2 h-4 w-4 text-[#F2B941]" />
                Sign in to Screen Cells
              </Button>
            ) : (
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Operator Session</span>
                <span className="text-xs font-semibold text-slate-800">
                  {user?.name} ({user?.role})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Input Scope Restriction Notice */}
        <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-xs text-blue-900 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-blue-950">
              Input Scope: Complete Single-Cell EL Images Only
            </p>
            <p className="text-blue-800 leading-relaxed">
              This screening model was trained strictly on complete individual cropped solar cell EL images (re-sampled to 224×224 grayscale replicated to 3 channels).
              <strong> Do NOT upload YOLO defect bounding boxes</strong> or <strong>unsegmented full solar modules</strong>. Model 1 and Model 2 operate on separate physical scopes and do not share cell identifiers.
            </p>
          </div>
        </div>
      </div>

      {/* Main Interactive Grid: Upload & Live Inference */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Upload & Controls (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 flex items-center justify-between">
              <span>Cell Image Upload</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadSample}
                className="text-xs border-slate-300 hover:bg-slate-100 text-slate-700"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-[#8b6508]" />
                Load Sample Cell
              </Button>
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Grayscale single-cell EL crop (.png, .jpg, .tiff, .bmp, .webp), max 8 MiB.
            </p>

            {/* Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) {
                  handleFileChange(e.dataTransfer.files[0]);
                }
              }}
              className={cn(
                "mt-4 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
                imagePreview
                  ? "border-emerald-300 bg-emerald-50/30"
                  : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/tiff,image/bmp,image/webp"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
              />

              {imagePreview ? (
                <div className="space-y-3">
                  <div className="relative mx-auto w-48 h-48 rounded-lg overflow-hidden border border-slate-200 bg-black flex items-center justify-center">
                    <img
                      src={imagePreview}
                      alt="Cell preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-800 truncate">
                      {selectedFile?.name || "cell.png"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ""}
                      {isSampleLoaded && " • Official Benchmark Sample"}
                    </p>
                  </div>
                  <span className="text-[11px] text-blue-600 underline">Click to change file</span>
                </div>
              ) : (
                <div className="space-y-3 py-6">
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      Click to choose or drag & drop single cell image
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Complete single-cell EL crop only (PNG, JPG, TIFF, WEBP &lt; 8MB)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Run Button */}
            <div className="mt-6">
              <Button
                onClick={handleRunScreening}
                disabled={!selectedFile || predictMutation.isPending}
                className="w-full bg-[#0B0909] text-white hover:bg-slate-800 h-11 text-sm font-semibold shadow-md"
              >
                {predictMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#F2B941]" />
                    Evaluating Cell Defectiveness...
                  </>
                ) : (
                  <>
                    <Scan className="mr-2 h-4 w-4 text-[#F2B941]" />
                    Run Cell Defectiveness Screening
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Prediction Output & Interpretation (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {result ? (
            <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm space-y-6">
              {/* Mandatory Review Alert Banner */}
              <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-amber-950 flex items-center gap-2">
                      <span>Manual Operator Review Required</span>
                      <span className="text-xs font-normal bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                        Screening Only
                      </span>
                    </h3>
                    <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                      Zero Automatic PASS/REJECT Policy: This system provides early screening indications only.
                      Review status is <strong>pending</strong> until verified by a qualified quality inspector.
                    </p>
                  </div>
                </div>
              </div>

              {/* Prediction Classification Card */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500 block">
                    Screening Classification
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={cn(
                        "text-2xl font-black uppercase tracking-tight px-3 py-1 rounded-lg border",
                        result.predictedClass === "defective"
                          ? "bg-rose-100 text-rose-900 border-rose-300"
                          : "bg-emerald-100 text-emerald-900 border-emerald-300"
                      )}
                    >
                      {result.predictedClass}
                    </span>
                    <span className="text-xs text-slate-600">
                      (Decision threshold: {result.thresholdPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-500 block">Decision Status</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                    <Clock className="h-3 w-3 text-amber-500" />
                    Review Pending
                  </span>
                </div>
              </div>

              {/* Defectiveness Score vs Threshold Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Score */}
                <div className="rounded-xl border border-slate-200 p-4 bg-white shadow-xs">
                  <span className="text-xs font-medium text-slate-500 block">
                    Model Defectiveness Score
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {result.defectiveScorePct.toFixed(2)}%
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      ({result.rawDefectiveScore.toFixed(6)})
                    </span>
                  </div>
                  <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        result.rawDefectiveScore >= result.rawThreshold
                          ? "bg-rose-500"
                          : "bg-emerald-500"
                      )}
                      style={{ width: `${Math.min(result.defectiveScorePct, 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500 leading-tight">
                    Likelihood output of cell defectiveness. <strong>Not an accuracy rating</strong> or calibrated risk probability.
                  </p>
                </div>

                {/* Threshold */}
                <div className="rounded-xl border border-slate-200 p-4 bg-white shadow-xs">
                  <span className="text-xs font-medium text-slate-500 block">
                    Decision Threshold
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {result.thresholdPct.toFixed(2)}%
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      ({result.rawThreshold.toFixed(2)})
                    </span>
                  </div>
                  <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-slate-400 rounded-full"
                      style={{ width: `${result.thresholdPct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500 leading-tight">
                    Validation-selected cutoff. Predictions &ge; 0.55 are classified as defective; &lt; 0.55 as healthy.
                  </p>
                </div>
              </div>

              {/* Warning & Scope Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-slate-800">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  Model Limitation &amp; Disclaimers
                </div>
                <p className="leading-relaxed">
                  {result.warning}
                </p>
                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>Provenance: <strong>{result.dataProvenance}</strong></span>
                  <span>Model ID: <code className="font-mono text-slate-700">{result.modelId}</code></span>
                  <span>Inspection ID: <code className="font-mono text-slate-700">{result.screeningId.slice(0, 8)}...</code></span>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <Scan className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-800">No Screening Run Yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Upload a cropped grayscale single-cell EL image or click &quot;Load Sample Cell&quot; to test the model.
                All screenings are logged to persistent history.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Benchmark Caveats Card (Requirement 7) */}
      <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#8b6508]" />
              Research Benchmark Caveats &amp; Performance Limits
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Academically documented test set performance on the ELPV benchmark dataset (CC BY-NC-SA 4.0).
            </p>
          </div>
          <span className="rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-semibold border border-slate-200">
            Proxy Benchmark Only
          </span>
        </div>

        {/* 6 Key Benchmark Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block">
              Benchmark Accuracy
            </span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">
              {benchmark ? `${(benchmark.accuracy * 100).toFixed(2)}%` : "69.81%"}
            </span>
            <span className="text-[10px] text-slate-500">215 / 308 correct</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block">
              Defective Recall
            </span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">
              {benchmark ? `${(benchmark.defectiveRecall * 100).toFixed(2)}%` : "68.67%"}
            </span>
            <span className="text-[10px] text-slate-500">57 / 83 defective cells</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block">
              Defective Precision
            </span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">
              {benchmark ? `${(benchmark.defectivePrecision * 100).toFixed(2)}%` : "45.97%"}
            </span>
            <span className="text-[10px] text-slate-500">57 / 124 flagged</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block">
              Defective F1
            </span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">
              {benchmark ? `${(benchmark.f1Defective * 100).toFixed(2)}%` : "55.07%"}
            </span>
            <span className="text-[10px] text-slate-500">Harmonic balance</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block">
              Test Set Size
            </span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">
              {benchmark?.testSetSize || 308}
            </span>
            <span className="text-[10px] text-slate-500">225 safe, 83 defective</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block">
              Threshold Cutoff
            </span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">
              0.55
            </span>
            <span className="text-[10px] text-slate-500">Validation-selected</span>
          </div>
        </div>

        {/* Caveats Explanation & Confusion Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-2 text-xs text-slate-600">
            <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
              Essential Field Caveats
            </h4>
            <ul className="list-disc list-inside space-y-1.5 leading-relaxed">
              <li>
                <strong>No source module IDs:</strong> The ELPV corpus contains 44 solar modules without original identifiers; proxy block splitting was utilized.
              </li>
              <li>
                <strong>Held-out test errors:</strong> In 308 test images, 93 were misclassified (26 false negatives where defect was missed; 67 false positives where healthy cell was flagged).
              </li>
              <li>
                <strong>Not certified factory QC:</strong> Figures reflect research benchmark results, NOT guaranteed factory quality assurance.
              </li>
              <li>
                <strong>No physical severity:</strong> The binary score does not quantify crack depth, micro-fracture length, or electrical degradation severity.
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-2 text-xs">
            <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
              Held-Out Test Confusion Matrix (N=308)
            </h4>
            <div className="grid grid-cols-2 gap-2 text-center pt-1 font-mono text-xs">
              <div className="p-2.5 rounded-lg bg-emerald-100/80 border border-emerald-300">
                <span className="text-[10px] text-emerald-800 block uppercase font-sans font-semibold">True Negatives</span>
                <span className="text-lg font-bold text-emerald-950">158</span>
                <span className="text-[10px] text-emerald-700 block">Healthy identified</span>
              </div>
              <div className="p-2.5 rounded-lg bg-rose-100/80 border border-rose-300">
                <span className="text-[10px] text-rose-800 block uppercase font-sans font-semibold">False Positives</span>
                <span className="text-lg font-bold text-rose-950">67</span>
                <span className="text-[10px] text-rose-700 block">Healthy flagged defective</span>
              </div>
              <div className="p-2.5 rounded-lg bg-rose-100/80 border border-rose-300">
                <span className="text-[10px] text-rose-800 block uppercase font-sans font-semibold">False Negatives</span>
                <span className="text-lg font-bold text-rose-950">26</span>
                <span className="text-[10px] text-rose-700 block">Defective classified healthy</span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-100/80 border border-emerald-300">
                <span className="text-[10px] text-emerald-800 block uppercase font-sans font-semibold">True Positives</span>
                <span className="text-lg font-bold text-emerald-950">57</span>
                <span className="text-[10px] text-emerald-700 block">Defective identified</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Persistent History Log (Requirement 6) */}
      <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-slate-700" />
              Persistent Cell Screening Log
            </h2>
            <p className="text-xs text-slate-500">
              Audit trail of cell screenings with provenance tag, threshold, decision, and operator review flags.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {historyQuery.data?.length ?? 0} records
          </span>
        </div>

        {historyQuery.isLoading ? (
          <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading screening history...
          </div>
        ) : historyQuery.data && historyQuery.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">File / ID</th>
                  <th className="py-2.5 px-3">Model Version</th>
                  <th className="py-2.5 px-3">Predicted Class</th>
                  <th className="py-2.5 px-3">Defective Score</th>
                  <th className="py-2.5 px-3">Threshold</th>
                  <th className="py-2.5 px-3">Decision</th>
                  <th className="py-2.5 px-3">Review Status</th>
                  <th className="py-2.5 px-3">Provenance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyQuery.data.map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[120px]">{item.sourceFilename}</span>
                        <span className="text-[10px] font-mono text-slate-400">({item.id.slice(0, 6)})</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                      {item.modelVersionId}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[11px] font-semibold uppercase",
                          item.predictedClass === "defective"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-emerald-100 text-emerald-800"
                        )}
                      >
                        {item.predictedClass}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {(item.defectiveProbability * 100).toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {(item.threshold * 100).toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono">
                        {item.decision}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[11px] font-medium border border-amber-200">
                        <Clock className="h-2.5 w-2.5" />
                        {item.reviewStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[11px] border border-blue-200">
                        {item.dataProvenance}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-4 text-center">
            {isAuthenticated
              ? "No screening history recorded yet. Run a screening above to log records."
              : "Sign in as an operator to view persistent screening history."}
          </p>
        )}
      </div>
    </div>
  );
}
export default CellScreeningView;
