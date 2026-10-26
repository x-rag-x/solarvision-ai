import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileClock,
  Filter,
  LogIn,
  RefreshCw,
  ScanLine,
  Search,
  ShieldAlert,
  Target,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { DataSourceNote, EmptyData, PageIntro, StatusBadge } from "@/components/solarvision/Primitives";
import { AuthGuard, SessionExpiredBanner } from "@/components/solarvision/AuthGuard";
import { isUnauthorizedError } from "@/lib/auth-helpers";
import { useAuth } from "@/_core/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { openOperatorLoginModal, startLogin } from "@/const";

export default function History() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
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

  const isAuthError = isUnauthorizedError(error);

  return (
    <AuthGuard
      title="Authentication required to view inspection history"
      description="Historical solar cell electroluminescence (EL) and near-infrared (NIR) records, defect counts, and runtime measurements are restricted to authenticated operators."
    >
      <div>
        <PageIntro
          eyebrow="Traceability & Audit"
          title="Inspection history."
          description="Every completed EL/NIR run is permanently recorded with its source image, detected defect count, measured YOLO latency, and database persistence status."
          action={
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-10 gap-2 rounded-xl border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin text-[#F2B941]" : ""}`} />
                Refresh
              </Button>
              <Link
                href="/inspection"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0B0909] px-4 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(7,27,41,0.14)] transition-transform hover:-translate-y-0.5"
              >
                <ScanLine className="h-4 w-4 text-[#F2B941]" />
                New inspection
              </Link>
            </div>
          }
        />

        {isError && isAuthError && (
          <SessionExpiredBanner onRetry={() => refetch()} />
        )}

        {isError && !isAuthError && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50/70 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
                <div>
                  <h4 className="text-sm font-semibold text-rose-950">Failed to load inspection history</h4>
                  <p className="mt-0.5 text-xs text-rose-700">
                    {error instanceof Error ? error.message : "Database connection or network error"}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                className="h-9 gap-1.5 border-rose-300 bg-white text-xs font-medium text-rose-900 hover:bg-rose-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          </div>
        )}

        <DataSourceNote configured={rows.length > 0 && !isError} />

        {/* Summary KPI Cards from Real Persisted Data */}
        {metrics && !isError && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(7,27,41,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Stored Inspections</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#0B0909]">
                    {metrics.totalRuns}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">Total database records</p>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#F2B941]/10 text-[#F2B941]">
                  <FileClock className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(7,27,41,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Total Defect BBoxes</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#0B0909]">
                    {metrics.totalDetections}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">Sum of detected features</p>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#087e6d]/10 text-[#087e6d]">
                  <Target className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(7,27,41,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Cells with Anomalies</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#0B0909]">
                    {metrics.runsWithDefects}{" "}
                    <span className="text-xs font-normal text-slate-400">({metrics.defectRate}%)</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">Flagged for review</p>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
                  <ShieldAlert className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(7,27,41,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Average Latency</p>
                  <p className="mt-2 font-mono text-3xl font-semibold tracking-[-0.05em] text-[#0B0909]">
                    {metrics.avgLatency}{" "}
                    <span className="text-xs font-normal text-slate-400">ms</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">Ultralytics YOLO runtime</p>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
                  <Clock3 className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Records Table Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(7,27,41,0.04)]">
          {/* Table Header with Filters & Search */}
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF3C4] text-[#F2B941]">
                <FileClock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Inspection Traceability Log</h2>
                <p className="text-xs text-slate-400">
                  {filteredRows.length} of {rows.length} total runs displayed
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search Bar */}
              <div className="relative min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search file or UUID…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-[#F4F0D7] pl-8 pr-3 text-xs outline-none focus:border-[#F2B941]"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center rounded-xl border border-slate-200 bg-[#f8fafb] p-1">
                <button
                  onClick={() => setFilterMode("all")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    filterMode === "all" ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  All ({rows.length})
                </button>
                <button
                  onClick={() => setFilterMode("defects")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    filterMode === "defects" ? "bg-white font-semibold text-amber-700 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Anomalies ({rows.filter(r => r.detectionsCount > 0).length})
                </button>
                <button
                  onClick={() => setFilterMode("clean")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    filterMode === "clean" ? "bg-white font-semibold text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Clean ({rows.filter(r => r.detectionsCount === 0).length})
                </button>
              </div>
            </div>
          </div>

          {/* Table Content */}
          {isLoading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : isError ? (
            <div className="p-8 text-center">
              <ShieldAlert className="mx-auto h-8 w-8 text-rose-500" />
              <p className="mt-3 text-sm font-semibold text-slate-800">
                {isAuthError ? "Authentication Session Required" : "Error Loading Inspection Records"}
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                {isAuthError
                  ? "Your session has expired. Sign in again to view your inspection history."
                  : (error instanceof Error ? error.message : "Could not retrieve records from the database.")}
              </p>
              <div className="mt-5">
                {isAuthError ? (
                  <Button
                    size="sm"
                    onClick={() => openOperatorLoginModal()}
                    className="gap-1.5 rounded-xl bg-[#0B0909] text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <LogIn className="h-3.5 w-3.5 text-[#F2B941]" />
                    Sign In
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refetch()}
                    className="gap-1.5 text-xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </Button>
                )}
              </div>
            </div>
          ) : filteredRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                    <th className="px-6 py-4 font-semibold">Source Image</th>
                    <th className="py-4 font-semibold">Status</th>
                    <th className="py-4 font-semibold">Detections</th>
                    <th className="py-4 font-semibold">Inference Latency</th>
                    <th className="py-4 font-semibold">Storage Persistence</th>
                    <th className="py-4 font-semibold">Timestamp</th>
                    <th className="py-4 pr-6 text-right font-semibold">Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map(item => (
                    <tr
                      key={item.inspectionId}
                      className="group transition-colors hover:bg-[#f8fafb]"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/inspection/${item.inspectionId}`}
                          className="font-semibold text-slate-800 hover:text-[#F2B941] flex items-center gap-1.5"
                        >
                          <span className="truncate max-w-[220px]">{item.sourceFilename}</span>
                        </Link>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                          {item.inspectionId}
                        </p>
                      </td>
                      <td className="py-4">
                        <StatusBadge tone={item.status === "completed" ? "success" : "danger"}>
                          {item.status}
                        </StatusBadge>
                      </td>
                      <td className="py-4">
                        {item.detectionsCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                            {item.detectionsCount} defect{item.detectionsCount === 1 ? "" : "s"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            0 defects
                          </span>
                        )}
                      </td>
                      <td className="py-4 font-mono text-slate-600">
                        {Math.round(item.processingTimeMs)} ms
                      </td>
                      <td
                        className="max-w-[180px] truncate py-4 text-[11px] text-slate-500"
                        title={item.persistenceStatus}
                      >
                        {item.persistenceStatus.replaceAll(",", " · ")}
                      </td>
                      <td className="py-4 text-[11px] text-slate-400">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="py-4 pr-6 text-right">
                        <Link
                          href={`/inspection/${item.inspectionId}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:border-[#F2B941] hover:text-[#0B0909]"
                        >
                          View <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8">
              <EmptyData
                title="No matching inspection records"
                description={
                  search || filterMode !== "all"
                    ? "Try adjusting your search query or switching filters to see all inspection records."
                    : "Run a new EL/NIR cell inspection to begin logging production audit records."
                }
              />
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
