import React from "react";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  Calendar,
  ChartNoAxesCombined,
  CheckCircle2,
  Database,
  Download,
  Gauge,
  Layers3,
  RefreshCw,
  ShieldAlert,
  Target,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAppMode } from "@/contexts/ModeContext";
import { DEFECT_CLASSES, getDefectMeta } from "@/lib/defects";
import { toast } from "sonner";

// Shared SolarVision UI Components
import PageHeader from "@/components/solarvision/PageHeader";
import StatCard from "@/components/solarvision/StatCard";
import NoticeBar from "@/components/solarvision/NoticeBar";
import AuthGuard from "@/components/solarvision/AuthGuard";
import { DefectBadge } from "@/components/solarvision/DefectBadge";
import { EmptyState, ErrorState, Skeleton } from "@/components/solarvision/StateComponents";

export default function Analytics() {
  const { isAuthenticated } = useAuth();
  const { isDev } = useAppMode();

  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    isError: isAnalyticsError,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = trpc.analytics.defects.useQuery(undefined, {
    enabled: Boolean(isAuthenticated),
  });

  const {
    data: statsData,
    isLoading: statsLoading,
    isError: isStatsError,
    refetch: refetchStats,
  } = trpc.dashboard.stats.useQuery(undefined, {
    enabled: Boolean(isAuthenticated),
  });

  const byType = analyticsData?.byType ?? [];
  const recentTrend = analyticsData?.recentTrend ?? [];
  const isLoading = analyticsLoading || statsLoading;
  const isError = isAnalyticsError || isStatsError;

  const totalObservedDefects = byType.reduce((acc, curr) => acc + curr.count, 0);
  const chronologicalTrend = [...recentTrend].reverse();

  const handleExportCsv = () => {
    if (byType.length === 0) {
      toast.info("No analytics data to export.");
      return;
    }

    const headers = "DefectType,Count,AvgConfidencePct\n";
    const rows = byType
      .map(t => `"${t.defectType}",${t.count},${(t.avgConfidence * 100).toFixed(1)}%`)
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `solarvision_defect_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Analytics CSV exported");
  };

  return (
    <AuthGuard
      title="Authentication Required for Defect Analytics"
      description="Aggregated manufacturing quality metrics, historical defect trends, and classification distributions are restricted to authenticated factory personnel."
    >
      <div className="space-y-6">
        {/* Page Top Header */}
        <PageHeader
          title="Defect Analytics & Process Intelligence"
          description="Aggregated process distribution derived directly from persisted inspection records. In accordance with zero-fabrication guarantees, no synthetic metrics are computed."
          badge={<span className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs font-semibold text-text border border-border">9 YOLO Classes</span>}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                disabled={byType.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-2 hover:bg-surface-subtle hover:text-text transition-colors shadow-xs disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 text-text-3" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => {
                  refetchAnalytics();
                  refetchStats();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-2 hover:bg-surface-subtle hover:text-text transition-colors shadow-xs"
              >
                <RefreshCw className="h-3.5 w-3.5 text-text-3" />
                <span>Refresh</span>
              </button>
            </div>
          }
        />

        {/* Provenance Notice */}
        <NoticeBar
          tone="info"
          message="Quality Operations Audit: Defect frequencies and daily trend volumes calculated exclusively from verified database records."
          details={
            <p>
              Metrics are aggregated from immutable inspection runs. When new inspections are committed,
              class frequencies, confidence averages, and daily trend curves update automatically.
            </p>
          }
        />

        {/* Primary Statistics KPIs */}
        {!isError && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Detected Defects"
              value={isLoading ? "…" : totalObservedDefects}
              caption="Aggregated across all runs"
              icon={Target}
            />
            <StatCard
              label="Processed Inspections"
              value={isLoading ? "…" : statsData?.inspections ?? 0}
              caption="Total historical frames"
              icon={CheckCircle2}
            />
            <StatCard
              label="Active Defect Classes"
              value={isLoading ? "…" : `${byType.length} / 9`}
              caption="Distinct classes identified in factory"
              icon={Layers3}
            />
            <StatCard
              label="Average Pipeline Latency"
              value={
                isLoading
                  ? "…"
                  : statsData?.avgProcessingTimeMs != null
                  ? Math.round(statsData.avgProcessingTimeMs)
                  : "—"
              }
              unit="ms"
              caption="Ultralytics YOLO26n speed"
              icon={Gauge}
            />
          </div>
        )}

        {/* Charts & Breakdown */}
        {!isError && (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Defect Frequency Bar Chart (7 cols) */}
            <div className="lg:col-span-7 rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                    Class Distribution
                  </span>
                  <h3 className="text-sm font-semibold text-text">Defect Class Frequency</h3>
                </div>
                <BarChart3 className="h-4 w-4 text-text-3" />
              </div>

              {isLoading ? (
                <div className="h-[280px] w-full flex items-center justify-center">
                  <Skeleton className="h-[260px] w-full rounded-xl" />
                </div>
              ) : byType.length > 0 ? (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byType} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E3E1DA" />
                      <XAxis
                        dataKey="defectType"
                        tick={{ fontSize: 11, fill: "#6A665E" }}
                        angle={-25}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#6A665E" }} allowDecimals={false} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            const meta = getDefectMeta(d.defectType);
                            return (
                              <div className="rounded-xl border border-border bg-surface p-3 shadow-lg text-xs space-y-1">
                                <p className="font-semibold text-text">{meta.label}</p>
                                <p className="text-text-2">
                                  Occurrences: <span className="font-mono font-bold text-text">{d.count}</span>
                                </p>
                                <p className="text-text-3 font-mono text-xs">
                                  Avg Confidence: {(d.avgConfidence * 100).toFixed(1)}%
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {byType.map((entry, index) => {
                          const meta = getDefectMeta(entry.defectType);
                          return <Cell key={`cell-${index}`} fill={meta.color || "#F2B941"} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[280px] grid place-items-center">
                  <EmptyState
                    title="No Defect Frequency Data"
                    description="Run inspections to populate Pareto frequency charts."
                  />
                </div>
              )}
            </div>

            {/* Daily Detection Volume Timeline (5 cols) */}
            <div className="lg:col-span-5 rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                    Daily Volume Trend
                  </span>
                  <h3 className="text-sm font-semibold text-text">14-Day Defect Timeline</h3>
                </div>
                <ChartNoAxesCombined className="h-4 w-4 text-text-3" />
              </div>

              {isLoading ? (
                <div className="h-[280px] w-full flex items-center justify-center">
                  <Skeleton className="h-[260px] w-full rounded-xl" />
                </div>
              ) : chronologicalTrend.length > 0 ? (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chronologicalTrend}
                      margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E3E1DA" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 10, fill: "#6A665E" }}
                        angle={-25}
                        textAnchor="end"
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#6A665E" }} allowDecimals={false} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            return (
                              <div className="rounded-xl border border-border bg-surface p-3 shadow-lg text-xs space-y-1">
                                <p className="font-semibold text-text">{d.day}</p>
                                <p className="text-text-2">
                                  Inspections: <span className="font-mono font-bold text-text">{d.inspections}</span>
                                </p>
                                <p className="text-text-2">
                                  Defects: <span className="font-mono font-bold text-brand-text">{d.defects}</span>
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="defects"
                        stroke="#8A5A00"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#F2B941" }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="inspections"
                        stroke="#16130F"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={{ r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[280px] grid place-items-center">
                  <EmptyState
                    title="No Daily Trend Data"
                    description="Timeline will populate as daily inspection batches are run."
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Detailed Defect Class Breakdown Table */}
        {!isError && byType.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-4 shadow-xs">
            <h3 className="text-sm font-semibold text-text">Itemized Defect Distribution</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[560px]">
                <thead className="border-b border-border bg-surface-subtle text-xs text-text-3 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Class Label</th>
                    <th className="py-2.5 px-3">Severity Category</th>
                    <th className="py-2.5 px-3">Recorded Occurrences</th>
                    <th className="py-2.5 px-3">Average Model Confidence</th>
                    <th className="py-2.5 px-3 text-right">Relative Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {byType.map(row => {
                    const meta = getDefectMeta(row.defectType);
                    const sharePct = totalObservedDefects > 0
                      ? ((row.count / totalObservedDefects) * 100).toFixed(1)
                      : "0.0";

                    return (
                      <tr key={row.defectType} className="hover:bg-surface-subtle transition-colors">
                        <td className="py-2.5 px-3">
                          <DefectBadge defectType={row.defectType} size="sm" />
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="capitalize text-text-2 font-medium">{meta.category}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-text tabular-nums">
                          {row.count}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-text-2 tabular-nums">
                          {(row.avgConfidence * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-text-3 tabular-nums">
                          {sharePct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
