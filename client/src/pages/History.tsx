import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileClock,
  Filter,
  RefreshCw,
  ScanLine,
  Search,
  ShieldAlert,
  Target,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAppMode } from "@/contexts/ModeContext";
import { toast } from "sonner";

// Shared SolarVision UI Components
import PageHeader from "@/components/solarvision/PageHeader";
import StatCard from "@/components/solarvision/StatCard";
import StatusBadge from "@/components/solarvision/StatusBadge";
import AuthGuard from "@/components/solarvision/AuthGuard";
import { EmptyState, ErrorState, Skeleton } from "@/components/solarvision/StateComponents";

export default function History() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { isDev } = useAppMode();

  const { data, isLoading, isError, error, refetch, isFetching } = trpc.inspection.history.useQuery(
    { limit: 100 },
    { enabled: Boolean(isAuthenticated) }
  );
  const rows = data ?? [];

  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "defects" | "clean">("all");

  const filteredRows = useMemo(() => {
    return rows.filter(item => {
      const matchesSearch =
        item.sourceFilename.toLowerCase().includes(search.toLowerCase()) ||
        item.inspectionId.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;

      if (filterMode === "defects") return item.detectionsCount > 0;
      if (filterMode === "clean") return item.detectionsCount === 0;
      return true;
    });
  }, [rows, search, filterMode]);

  // Derived metrics from real data
  const metrics = useMemo(() => {
    if (!rows.length) return null;
    const totalRuns = rows.length;
    const totalDetections = rows.reduce((sum, r) => sum + r.detectionsCount, 0);
    const runsWithDefects = rows.filter(r => r.detectionsCount > 0).length;
    const defectRate = ((runsWithDefects / totalRuns) * 100).toFixed(1);
    const avgLatency = Math.round(
      rows.reduce((sum, r) => sum + r.processingTimeMs, 0) / totalRuns
    );
    return { totalRuns, totalDetections, runsWithDefects, defectRate, avgLatency };
  }, [rows]);

  const handleExportCsv = () => {
    if (filteredRows.length === 0) {
      toast.info("No records to export.");
      return;
    }

    const headers = "InspectionId,Filename,Status,DefectsCount,LatencyMs,Persistence,Timestamp\n";
    const csvRows = filteredRows
      .map(
        r =>
          `"${r.inspectionId}","${r.sourceFilename}","${r.status}",${r.detectionsCount},${Math.round(r.processingTimeMs)},"${r.persistenceStatus}","${new Date(r.createdAt).toISOString()}"`
      )
      .join("\n");

    const blob = new Blob([headers + csvRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `solarvision_inspection_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Inspection history CSV exported");
  };

  return (
    <AuthGuard
      title="Authentication Required to View Inspection History"
      description="Historical solar cell electroluminescence (EL) records, defect logs, and runtime measurements are restricted to authenticated operators."
    >
      <div className="space-y-6">
        {/* Page Top Header */}
        <PageHeader
          title="Inspection History"
          description="Every completed EL/NIR cell run is permanently recorded with its source image, detected defect count, measured YOLO latency, and database persistence status."
          badge={<span className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs font-semibold text-text border border-border">{rows.length} Persisted Records</span>}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportCsv}
                disabled={filteredRows.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-2 hover:bg-surface-subtle hover:text-text transition-colors shadow-xs disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 text-text-3" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-2 hover:bg-surface-subtle hover:text-text transition-colors shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-brand-text" : "text-text-3"}`} />
                <span>Refresh</span>
              </button>
              <Link
                href="/inspection"
                className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-ink/90 transition-colors shadow-xs"
              >
                <ScanLine className="h-3.5 w-3.5 text-brand" />
                <span>New Inspection</span>
              </Link>
            </div>
          }
        />

        {/* Derived KPI Strip */}
        {metrics && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Historical Runs"
              value={metrics.totalRuns}
              caption="Logged inspection sessions"
              icon={FileClock}
            />
            <StatCard
              label="Flagged Defects"
              value={metrics.totalDetections}
              caption="Total detected anomalies"
              icon={Target}
            />
            <StatCard
              label="Defect Excursion Rate"
              value={`${metrics.defectRate}%`}
              caption="Cells containing ≥1 defect"
              icon={CheckCircle2}
            />
            <StatCard
              label="Average Pipeline Latency"
              value={metrics.avgLatency}
              unit="ms"
              caption="End-to-end model execution"
              icon={Clock3}
            />
          </div>
        )}

        {/* Search, Filter & Table Container */}
        <div className="rounded-2xl border border-border bg-surface shadow-xs overflow-hidden">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border p-4 bg-surface-subtle">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-3" />
              <input
                type="text"
                placeholder="Search by filename or inspection ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-1.5 text-xs text-text placeholder:text-text-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface p-1 text-xs">
              <button
                onClick={() => setFilterMode("all")}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  filterMode === "all"
                    ? "bg-ink text-white font-semibold"
                    : "text-text-3 hover:text-text"
                }`}
              >
                All ({rows.length})
              </button>
              <button
                onClick={() => setFilterMode("defects")}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  filterMode === "defects"
                    ? "bg-warning-tint text-brand-text font-semibold border border-warning/30"
                    : "text-text-3 hover:text-text"
                }`}
              >
                Defects ({rows.filter(r => r.detectionsCount > 0).length})
              </button>
              <button
                onClick={() => setFilterMode("clean")}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  filterMode === "clean"
                    ? "bg-success-tint text-success font-semibold border border-success/30"
                    : "text-text-3 hover:text-text"
                }`}
              >
                Clean ({rows.filter(r => r.detectionsCount === 0).length})
              </button>
            </div>
          </div>

          {/* Table Content */}
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-8">
              <ErrorState
                title="Error Loading Inspection Records"
                message={error instanceof Error ? error.message : "Could not retrieve records from the persistence layer."}
                onRetry={() => refetch()}
              />
            </div>
          ) : filteredRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-border bg-surface-subtle text-xs text-text-3 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Source Image Frame</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Detections</th>
                    <th className="py-3 px-3">Latency</th>
                    {isDev && <th className="py-3 px-3">Persistence Target</th>}
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredRows.map(item => {
                    const hasDefects = item.detectionsCount > 0;
                    return (
                      <tr
                        key={item.inspectionId}
                        onClick={() => setLocation(`/inspection/${item.inspectionId}`)}
                        className="group hover:bg-surface-subtle transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4">
                          <p className="font-semibold text-text group-hover:text-brand-text transition-colors truncate max-w-[240px]">
                            {item.sourceFilename}
                          </p>
                          <p className="font-mono text-xs text-text-3">
                            {item.inspectionId.slice(0, 8)}…
                          </p>
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge tone={item.status === "completed" ? "success" : "danger"}>
                            {item.status}
                          </StatusBadge>
                        </td>
                        <td className="py-3 px-3">
                          {hasDefects ? (
                            <span className="inline-flex rounded-full bg-warning-tint px-2.5 py-0.5 text-xs font-semibold text-brand-text border border-warning/20">
                              {item.detectionsCount} defect{item.detectionsCount === 1 ? "" : "s"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-text-3 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              0 defects
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-text-2 tabular-nums">
                          {Math.round(item.processingTimeMs)} ms
                        </td>
                        {isDev && (
                          <td className="py-3 px-3 text-xs text-text-3 font-mono truncate max-w-[160px]">
                            {item.persistenceStatus.split(",")[0]}
                          </td>
                        )}
                        <td className="py-3 px-3 text-text-3 font-mono text-xs">
                          {new Date(item.createdAt).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-2 group-hover:border-brand group-hover:text-text transition-colors">
                            <span>Open Report</span>
                            <ArrowRight className="h-3 w-3 text-text-3" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8">
              <EmptyState
                title="No Matching Inspection Records"
                description={
                  search || filterMode !== "all"
                    ? "Try adjusting your search query or reset filter settings to view all inspection records."
                    : "Run your first EL/NIR cell inspection to populate this persistent traceability log."
                }
              />
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
