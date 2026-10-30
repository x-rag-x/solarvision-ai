import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  Database,
  ExternalLink,
  Layers,
  LogIn,
  Maximize2,
  RefreshCw,
  ScanLine,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { Link, useRoute } from "wouter";
import { EmptyData, PageIntro, StatusBadge } from "@/components/solarvision/Primitives";
import { DetectionTable } from "@/components/solarvision/DetectionTable";
import { ConfidenceDisclaimer } from "@/components/solarvision/ConfidenceDisclaimer";
import { ImageViewerModal } from "@/components/solarvision/ImageViewerModal";
import { AuthGuard, SessionExpiredBanner } from "@/components/solarvision/AuthGuard";
import { isUnauthorizedError } from "@/lib/auth-helpers";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { startLogin } from "@/const";
import { toast } from "sonner";

export default function InspectionDetail() {
  const [, params] = useRoute("/inspection/:inspectionId");
  const inspectionId = params?.inspectionId || "";
  const { isAuthenticated } = useAuth();

  const { data: systemSettings } = trpc.system.getSettings.useQuery();
  const enableRootCause = Boolean(systemSettings?.enableRootCause);

  const { data, isLoading, isError, error, refetch } = trpc.inspection.detail.useQuery(
    { inspectionId: inspectionId || "00000000-0000-0000-0000-000000000000" },
    { enabled: Boolean(isAuthenticated && inspectionId) }
  );

  const [viewMode, setViewMode] = useState<"annotated" | "original">("annotated");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const copyId = () => {
    if (!inspectionId) return;
    navigator.clipboard.writeText(inspectionId);
    setCopiedId(true);
    toast.success("Inspection ID copied");
    setTimeout(() => setCopiedId(false), 2000);
  };

  const isAuthError = isUnauthorizedError(error);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <Skeleton className="h-[460px] rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-[180px] rounded-2xl" />
            <Skeleton className="h-[260px] rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthGuard
      title="Authentication required to view inspection evidence"
      description="Annotated solar cell imagery, bounding box coordinates, and defect classification records are restricted to authenticated operators and quality engineers."
    >
      <div>
        {isError && isAuthError ? (
          <div>
            <PageIntro
              eyebrow="Access Control"
              title="Authorization required for this record."
              description="Your session has expired or does not have authorization to view this inspection record. Please sign in to verify operator identity."
              action={
                <Link
                  href="/history"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B0909] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to history
                </Link>
              }
            />
            <SessionExpiredBanner onRetry={() => refetch()} />
          </div>
        ) : isError || !data || !data.inspection ? (
          <div>
            <PageIntro
              eyebrow="Inspection Traceability"
              title="Stored inspection record unavailable."
              description={`Could not retrieve record for inspection ID ${inspectionId}. It may still be syncing, the identifier may be invalid, or the record does not exist in the database.`}
              action={
                <Link
                  href="/history"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B0909] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to history
                </Link>
              }
            />
            <EmptyData
              title="No inspection found"
              description="Verify the inspection UUID or return to the history table to select an existing persisted record."
            />
          </div>
        ) : (
          (() => {
            const inspection = data.inspection as any;
            const detections = (data.detections || []) as any[];
            const createdAtDate = new Date(inspection.createdAt);

            const activeImage =
              viewMode === "annotated"
                ? inspection.annotatedImageUrl || inspection.inputImageUrl
                : inspection.inputImageUrl || inspection.annotatedImageUrl;

            return (
              <div>
                <PageIntro
                  eyebrow="Stored Inspection Record"
                  title={inspection.sourceFilename || "Inspection Detail"}
                  description={`Persisted on ${createdAtDate.toLocaleDateString()} at ${createdAtDate.toLocaleTimeString()} · Engine: ${inspection.modelName}`}
                  action={
                    <div className="flex items-center gap-2">
                      {enableRootCause && (
                        <Link
                          href={`/root-cause/${inspection.inspectionId}`}
                          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#F2B941]/40 bg-[#FFF3C4] px-3.5 text-xs font-semibold text-[#0B0909] shadow-sm hover:bg-[#ffe899] transition-colors"
                        >
                          <Compass className="h-4 w-4 text-[#0B0909]" />
                          Root Cause
                        </Link>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyId}
                        className="h-10 gap-1.5 rounded-xl border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300"
                      >
                        <Copy className="h-3.5 w-3.5 text-[#F2B941]" />
                        {copiedId ? "Copied!" : "Copy UUID"}
                      </Button>
                      <Link
                        href="/history"
                        className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0B0909] px-4 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(7,27,41,0.14)] transition-transform hover:-translate-y-0.5"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back to history
                      </Link>
                    </div>
                  }
                />

                <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
                  {/* Left Column: Visual Evidence Card */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(7,27,41,0.04)] flex flex-col">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF3C4] text-[#0B0909]">
                          <ScanLine className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F2B941]">
                            Visual Evidence
                          </p>
                          <h2 className="text-xl font-semibold tracking-[-0.03em]">Detection Imagery</h2>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <StatusBadge tone={inspection.status === "completed" ? "success" : "danger"}>
                          {inspection.status}
                        </StatusBadge>
                      </div>
                    </div>

                    {/* Image Viewport Container */}
                    {activeImage ? (
                      <div className="relative overflow-hidden rounded-2xl bg-[#0B0909] flex flex-col items-center justify-center min-h-[420px]">
                        {/* Switcher & Maximize Header */}
                        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
                          {inspection.annotatedImageUrl && inspection.inputImageUrl && (
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
                          src={activeImage}
                          alt="Inspection evidence"
                          className="max-h-[560px] w-full object-contain p-2"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-1 min-h-[400px] flex-col items-center justify-center rounded-2xl bg-[#F4F0D7] p-8 text-center">
                        <ScanLine className="h-10 w-10 text-slate-300" />
                        <p className="mt-3 text-sm font-semibold text-slate-600">Image evidence unavailable</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Storage path or bucket synchronization for this run was not recorded.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Execution Metrics & Defect List */}
                  <div className="space-y-5">
                    {/* Dark Metrics Card */}
                    <div className="rounded-2xl bg-[#0B0909] p-6 text-white shadow-[0_12px_32px_rgba(7,27,41,0.15)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F2B941]">
                        Model Execution Metrics
                      </p>

                      <div className="mt-5 grid grid-cols-2 gap-4">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <p className="text-xs text-slate-400">Detections</p>
                          <p className="mt-1 text-3xl font-semibold text-white">
                            {inspection.detectionsCount}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">Above cutoff</p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <p className="text-xs text-slate-400">YOLO Runtime</p>
                          <p className="mt-1 font-mono text-3xl font-semibold text-white">
                            {Math.round(inspection.processingTimeMs)}{" "}
                            <span className="text-sm font-normal text-slate-400">ms</span>
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">Inference latency</p>
                        </div>
                      </div>

                      <div className="mt-5 space-y-2.5 border-t border-white/10 pt-4 text-xs">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Database className="h-3.5 w-3.5 text-[#F2B941]" />
                            Persistence Tier
                          </span>
                          <span className="font-mono text-[11px] truncate max-w-[180px]" title={inspection.persistenceStatus}>
                            {inspection.persistenceStatus.replaceAll(",", " · ")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Clock className="h-3.5 w-3.5 text-[#F2B941]" />
                            Timestamp
                          </span>
                          <span className="text-[11px]">{createdAtDate.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Defect Coordinates Card */}
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(7,27,41,0.04)]">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-[#F2B941]" />
                          <h3 className="text-sm font-semibold">Persisted Defect Annotations</h3>
                        </div>
                        <span className="text-xs text-slate-400 font-medium">
                          {detections.length} recorded
                        </span>
                      </div>

                      {detections.length > 0 ? (
                        <DetectionTable detections={detections} />
                      ) : (
                        <div className="rounded-xl bg-[#F4F0D7] p-5 text-center">
                          <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600" />
                          <p className="mt-2 text-xs font-semibold text-slate-700">
                            Zero defects stored for this cell
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            No defect candidates exceeded the inference threshold during this inspection run.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Disclaimer */}
                <div className="mt-6">
                  <ConfidenceDisclaimer
                    threshold={0.25}
                    detectionsCount={detections.length}
                  />
                </div>

                {/* Fullscreen Image Zoom Modal */}
                {activeImage && (
                  <ImageViewerModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    originalUrl={inspection.inputImageUrl || activeImage}
                    annotatedUrl={inspection.annotatedImageUrl || activeImage}
                    filename={inspection.sourceFilename}
                    detectionsCount={detections.length}
                  />
                )}
              </div>
            );
          })()
        )}
      </div>
    </AuthGuard>
  );
}
