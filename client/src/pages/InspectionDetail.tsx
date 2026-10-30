import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAppMode } from "@/contexts/ModeContext";
import { isUnauthorizedError } from "@/lib/auth-helpers";
import { ArrowLeft, Compass, Copy, Download, Share2, Terminal } from "lucide-react";
import { toast } from "sonner";
import { formatInspectionDate } from "@/lib/date";

// Shared SolarVision UI Components
import PageHeader from "@/components/solarvision/PageHeader";
import ReportLayout from "@/components/solarvision/ReportLayout";
import ModelBadge from "@/components/solarvision/ModelBadge";
import StatusBadge from "@/components/solarvision/StatusBadge";
import NoticeBar from "@/components/solarvision/NoticeBar";
import ImageViewer from "@/components/solarvision/ImageViewer";
import DetectionTable from "@/components/solarvision/DetectionTable";
import Inspector from "@/components/solarvision/Inspector";
import AuthGuard from "@/components/solarvision/AuthGuard";
import { EmptyState, ErrorState, Skeleton } from "@/components/solarvision/StateComponents";

export default function InspectionDetail() {
  const [, params] = useRoute("/inspection/:inspectionId");
  const inspectionId = params?.inspectionId || "";
  const { isAuthenticated, user } = useAuth();
  const { isDev } = useAppMode();

  const { data: systemSettings } = trpc.system.getSettings.useQuery();
  const enableRootCause = Boolean(systemSettings?.enableRootCause);

  const { data, isLoading, isError, error, refetch } = trpc.inspection.detail.useQuery(
    { inspectionId: inspectionId || "00000000-0000-0000-0000-000000000000" },
    { enabled: Boolean(isAuthenticated && inspectionId) }
  );

  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // 'I' shortcut in Dev mode
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-8 w-32 rounded-xl" />
        </div>
        <Skeleton className="h-[520px] rounded-2xl" />
      </div>
    );
  }

  return (
    <AuthGuard
      title="Authentication Required for Stored Inspection Evidence"
      description="Historical defect bounding boxes, cell telemetry coordinates, and ISO traceability logs are restricted to authenticated operators."
    >
      <div>
        {isError || !data || !data.inspection ? (
          <div className="space-y-6">
            <PageHeader
              title="Inspection Record Not Found"
              description={`Could not retrieve persisted record for UUID ${inspectionId}.`}
              actions={
                <Link
                  href="/history"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-subtle transition-colors shadow-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Records</span>
                </Link>
              }
            />
            <EmptyState
              title="Record Unavailable"
              description="Verify the record UUID or return to the history table to select an existing persisted inspection."
            />
          </div>
        ) : (
          (() => {
            const inspection = data.inspection as any;
            const detections = (data.detections || []) as any[];
            const isFailed = inspection.status === "failed";
            const defectCount = isFailed ? 0 : detections.length;
            const maxConfidence =
              defectCount > 0 ? Math.max(...detections.map(d => Number(d.confidence || 0))) : 0;
            const executionTime = Math.round(
              Number(inspection.processingTimeMs || inspection.executionTimeMs || 0)
            );

            const failureReason = isFailed
              ? inspection.persistenceStatus?.startsWith("failed_inference:")
                ? inspection.persistenceStatus.replace(/^failed_inference:/, "")
                : inspection.persistenceStatus || "Inference pipeline execution failed."
              : null;

            const viewerDetections = isFailed
              ? []
              : detections.map((d, i) => ({
                  id: i,
                  class: d.defect_type || d.defectType || "defect",
                  label: d.defect_type || d.defectType || "defect",
                  confidence: Number(d.confidence || 0),
                  bbox: [Number(d.x1), Number(d.y1), Number(d.x2), Number(d.y2)] as [
                    number,
                    number,
                    number,
                    number,
                  ],
                }));

            const cleanDetailImage = inspection.inputImageUrl || "";
            const backendAnnotatedDetailImage = inspection.annotatedImageUrl || null;
            const isDetailBackendOnly = !cleanDetailImage && Boolean(backendAnnotatedDetailImage);

            const handleExportCsv = () => {
              if (isFailed || detections.length === 0) {
                toast.info("No detections to export.");
                return;
              }
              const headers = "DefectType,Confidence,X1,Y1,X2,Y2\n";
              const rows = detections
                .map(
                  d =>
                    `${d.defect_type || d.defectType},${(Number(d.confidence) * 100).toFixed(1)}%,${d.x1},${d.y1},${d.x2},${d.y2}`
                )
                .join("\n");
              const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.setAttribute("href", url);
              link.setAttribute("download", `solarvision_record_${(inspection.inspectionId || inspectionId).slice(0, 8)}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              toast.success("CSV export downloaded");
            };

            return (
              <div className="space-y-6">
                <ReportLayout
                  title={`Inspection Record: ${inspection.sourceFilename || "EL Cell Image"}`}
                  reportId={inspection.inspectionId || inspectionId}
                  timestamp={inspection.createdAt}
                  operatorName={user?.name || inspection.operatorId || "Authorized Operator"}
                  modelBadge={<ModelBadge model="M1" />}
                  statusBadge={
                    isFailed ? (
                      <StatusBadge tone="danger">Inference Failed</StatusBadge>
                    ) : (
                      <StatusBadge tone={defectCount > 0 ? "warning" : "success"}>
                        {defectCount > 0
                          ? `${defectCount} Defect${defectCount === 1 ? "" : "s"} Recorded`
                          : "Clear / Zero Detections"}
                      </StatusBadge>
                    )
                  }
                  verdictHeadline={
                    isFailed
                      ? "Inference execution failed without defect classification"
                      : defectCount > 0
                      ? `${defectCount} structural defect${defectCount === 1 ? "" : "s"} persisted in factory record`
                      : "Zero defect patterns detected above model cutoff"
                  }
                  verdictTone={isFailed ? "danger" : defectCount > 0 ? "warning" : "success"}
                  verdictStats={
                    isFailed
                      ? [
                          { label: "Inspection Status", value: "Failed" },
                          { label: "Defects Logged", value: "0 (Incomplete)" },
                          {
                            label: "Engine Execution",
                            value: `${executionTime} ms`,
                          },
                        ]
                      : [
                          { label: "Detected Defects", value: defectCount },
                          {
                            label: "Max Confidence",
                            value: defectCount > 0 ? `${(maxConfidence * 100).toFixed(1)}%` : "—",
                          },
                          {
                            label: "Engine Execution",
                            value: `${executionTime} ms`,
                          },
                        ]
                  }
                  mandatoryNoticeNode={
                    isFailed ? (
                      <NoticeBar
                        tone="danger"
                        message="Inspection failed during inference execution. No defect detections or quality certifications were recorded."
                        details={
                          <p>
                            The automated defect detection pipeline encountered a processing error and could not complete inference.
                            {failureReason && (
                              <span className="block mt-1 font-mono text-xs opacity-90">
                                Failure Detail: {failureReason}
                              </span>
                            )}
                          </p>
                        }
                      />
                    ) : (
                      <NoticeBar
                        tone="warning"
                        message="Academic prototype: not factory-certified. Zero detections does not certify a defect-free solar cell."
                        details={
                          <p>
                            Persisted record evaluated with YOLO26n weights on PVELAD benchmark.
                            Results conform to zero-fabrication standards and are read directly from persistent storage.
                          </p>
                        }
                      />
                    )
                  }
                  evidenceNode={
                    <ImageViewer
                      cleanImageUrl={cleanDetailImage || undefined}
                      imageUrl={cleanDetailImage || backendAnnotatedDetailImage || ""}
                      backendAnnotatedUrl={backendAnnotatedDetailImage}
                      isBackendAnnotated={isDetailBackendOnly}
                      originalImageUrl={cleanDetailImage || undefined}
                      detections={isDetailBackendOnly ? [] : viewerDetections}
                      highlightedIndex={highlightedIndex}
                      onHighlightIndex={setHighlightedIndex}
                      title={inspection.sourceFilename || "Stored Visual Evidence"}
                    />
                  }
                  findingsNode={
                    isFailed ? (
                      <div className="rounded-xl border border-border bg-surface-subtle p-6 text-center text-xs text-text-3">
                        Inference execution failed — no defect findings were recorded.
                      </div>
                    ) : (
                      <DetectionTable
                        detections={detections}
                        emptyMessage="Zero defect patterns detected above model cutoff."
                        highlightedIndex={highlightedIndex}
                        onHighlightIndex={setHighlightedIndex}
                      />
                    )
                  }
                  actionsNode={
                    <>
                      {isDev && (
                        <button
                          onClick={() => setInspectorOpen(prev => !prev)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-2 hover:bg-surface-subtle hover:text-text transition-colors shadow-xs"
                        >
                          <Terminal className="h-3.5 w-3.5 text-brand-text" />
                          <span>Inspector</span>
                        </button>
                      )}
                      {enableRootCause && !isFailed && (
                        <Link
                          href={`/root-cause/${inspection.inspectionId}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand-tint px-3 py-1.5 text-xs font-semibold text-brand-text hover:bg-brand/20 transition-colors shadow-xs"
                        >
                          <Compass className="h-3.5 w-3.5 text-brand-text" />
                          <span>Analyze Root Cause</span>
                        </Link>
                      )}
                    </>
                  }
                  onExportCsv={handleExportCsv}
                />

                {/* Dev Mode Inspector Drawer */}
                {isDev && (
                  <Inspector
                    open={inspectorOpen}
                    onClose={() => setInspectorOpen(false)}
                    data={{
                      resultSummary: {
                        inspectionId: inspection.inspectionId,
                        sourceFilename: inspection.sourceFilename,
                        status: inspection.status,
                        defectCount,
                        modelName: inspection.modelName,
                        createdAt: formatInspectionDate(inspection.createdAt),
                      },
                      rawResponse: data,
                      modelInfo: {
                        model: inspection.modelName || "YOLO26n",
                        checkpoint: "backend/models/best.pt",
                        dataset: "PVELAD (9 defect classes)",
                      },
                      storageInfo: {
                        target: "SQLite (data/solarvision.db)",
                        recordId: inspection.inspectionId,
                        persisted: true,
                      },
                      errorInfo: failureReason ? { reason: failureReason } : undefined,
                    }}
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
