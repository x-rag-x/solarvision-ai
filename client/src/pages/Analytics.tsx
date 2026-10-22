import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  Calendar,
  ChartNoAxesCombined,
  CheckCircle2,
  Database,
  Gauge,
  Layers3,
  LogIn,
  PieChart,
  RefreshCw,
  ShieldAlert,
  Sparkles,
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
import { DataSourceNote, EmptyData, PageIntro } from "@/components/solarvision/Primitives";
import { DEFECT_CLASSES, getDefectMeta } from "@/lib/defects";
import { AuthGuard, SessionExpiredBanner } from "@/components/solarvision/AuthGuard";
import { isUnauthorizedError } from "@/lib/auth-helpers";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";

export default function Analytics() {
  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    isError: isAnalyticsError,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = trpc.analytics.defects.useQuery();

  const {
    data: statsData,
    isLoading: statsLoading,
    isError: isStatsError,
    error: statsError,
    refetch: refetchStats,
  } = trpc.dashboard.stats.useQuery();

  const byType = analyticsData?.byType ?? [];
  const recentTrend = analyticsData?.recentTrend ?? [];
  const configured = Boolean(analyticsData?.configured);
  const isLoading = analyticsLoading || statsLoading;
  const isError = isAnalyticsError || isStatsError;
  const isAuthError = isUnauthorizedError(analyticsError) || isUnauthorizedError(statsError);

  const totalObservedDefects = byType.reduce((acc, curr) => acc + curr.count, 0);
  const hasTypes = byType.length > 0;
  const hasTrend = recentTrend.length > 0;

  // Format trend data for chronological order
  const chronologicalTrend = [...recentTrend].reverse();

  const handleRetry = () => {
    refetchAnalytics();
    refetchStats();
  };

  return (
    <AuthGuard
      title="Authentication required for defect analytics"
      description="Aggregated manufacturing quality metrics, historical defect trends, and classification distributions are restricted to authenticated factory personnel."
    >
      <div>
        <PageIntro
          eyebrow="Quality Intelligence & Trends"
          title="Defect analytics."
          description="Comprehensive analysis derived exclusively from real persisted inspection records in the database. In accordance with strict engineering integrity, zero synthetic or assumed manufacturing metrics are reported."
        />

        {isError && isAuthError && (
          <SessionExpiredBanner onRetry={handleRetry} />
        )}

        {isError && !isAuthError && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50/70 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
                <div>
                  <h4 className="text-sm font-semibold text-rose-950">Error Loading Analytics</h4>
                  <p className="mt-0.5 text-xs text-rose-700">
                    Failed to retrieve defect aggregation data from the database.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                className="h-9 gap-1.5 border-rose-300 bg-white text-xs font-medium text-rose-900 hover:bg-rose-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          </div>
        )}

        <DataSourceNote configured={configured && !isError} />

        {/* KPI Stat Cards (Real Data Only - Never display 0 on auth failure) */}
        {!isError && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(7,27,41,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Persisted Inspections</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#0B0909]">
                    {isLoading ? "…" : statsData?.inspections ?? 0}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">Total stored database runs</p>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#F2B941]/15 text-[#F2B941]">
                  <Database className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(7,27,41,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Total Observed Defects</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#0B0909]">
                    {isLoading ? "…" : totalObservedDefects || (statsData?.detections ?? 0)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">Sum of all identified anomalies</p>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#FDCD5E]/15 text-[#FDCD5E]">
                  <Target className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(7,27,41,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Unique Defect Classes</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#0B0909]">
                    {isLoading ? "…" : `${byType.length} / 9`}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">Active classes seen in database</p>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600">
                  <Layers3 className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(7,27,41,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Average Inference Latency</p>
                  <p className="mt-2 font-mono text-3xl font-semibold tracking-[-0.05em] text-[#0B0909]">
                    {isLoading ? "…" : statsData?.avgProcessingTimeMs ? `${Math.round(statsData.avgProcessingTimeMs)} ms` : "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">Ultralytics model speed</p>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
                  <Gauge className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts & Categorical Breakdown */}
        {!isError && (
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            {/* Defect Frequency Bar Chart */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(7,27,41,0.04)]">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF3C4] text-[#F2B941]">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">Defect Class Frequency</h2>
                    <p className="text-xs text-slate-400">Real counts grouped by defect label</p>
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="h-[280px] w-full flex items-center justify-center">
                  <Skeleton className="h-[240px] w-full rounded-xl" />
                </div>
              ) : hasTypes ? (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byType} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="defectType"
                        tick={{ fontSize: 10, fill: "#64748b" }}
                        angle={-25}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const meta = getDefectMeta(data.defectType);
                            return (
                              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                                <p className="text-xs font-semibold text-slate-900">{meta.label}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Occurrences: <span className="font-semibold text-slate-900">{data.count}</span>
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  Avg Confidence: {(data.avgConfidence * 100).toFixed(1)}%
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {byType.map((entry, index) => {
                          const meta = getDefectMeta(entry.defectType);
                          return <Cell key={`cell-${index}`} fill={meta.color || "#087e6d"} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[280px] grid place-items-center">
                  <EmptyData
                    compact
                    title="No defect breakdown available"
                    description="Run inspections to populate defect class frequency metrics."
                  />
                </div>
              )}
            </div>

            {/* Daily Detection Volume Timeline */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(7,27,41,0.04)]">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF3C4] text-[#F2B941]">
                    <ChartNoAxesCombined className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">14-Day Inspection Timeline</h2>
                    <p className="text-xs text-slate-400">Daily inspection count and defect volume</p>
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="h-[280px] w-full flex items-center justify-center">
                  <Skeleton className="h-[240px] w-full rounded-xl" />
                </div>
              ) : hasTrend ? (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chronologicalTrend}
                      margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 10, fill: "#64748b" }}
                        angle={-25}
                        textAnchor="end"
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                                <p className="text-xs font-semibold text-slate-900">{data.day}</p>
                                <p className="mt-1 text-xs text-slate-600">
                                  Inspections: <span className="font-semibold text-slate-900">{data.inspections}</span>
                                </p>
                                <p className="text-xs text-[#8a5a00]">
                                  Defects: <span className="font-semibold text-slate-900">{data.detections}</span>
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="inspections"
                        stroke="#087e6d"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#087e6d" }}
                        name="Inspections"
                      />
                      <Line
                        type="monotone"
                        dataKey="detections"
                        stroke="#F2B941"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ r: 3, fill: "#F2B941" }}
                        name="Defects"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[280px] grid place-items-center">
                  <EmptyData
                    compact
                    title="No timeline data logged"
                    description="Daily inspection runs will be charted here over a 14-day rolling window."
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Defect Class Severity & Confidence Table */}
        {!isError && hasTypes && (
          <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(7,27,41,0.04)]">
            <h3 className="text-base font-semibold mb-4">Observed Defect Class Distribution</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="py-3 font-semibold">Defect Class</th>
                    <th className="py-3 font-semibold">Severity Rating</th>
                    <th className="py-3 font-semibold">Count</th>
                    <th className="py-3 font-semibold">Share of Defects</th>
                    <th className="py-3 font-semibold">Mean Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {byType.map(row => {
                    const meta = getDefectMeta(row.defectType);
                    const share = totalObservedDefects > 0 ? ((row.count / totalObservedDefects) * 100).toFixed(1) : "0";
                    return (
                      <tr key={row.defectType} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 font-semibold text-slate-800">{meta.label}</td>
                        <td className="py-3">
                          <span
                            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              backgroundColor: `${meta.color}15`,
                              color: meta.color,
                            }}
                          >
                            {meta.severity.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 font-semibold text-slate-900">{row.count}</td>
                        <td className="py-3 text-slate-600">{share}%</td>
                        <td className="py-3 font-mono text-slate-600">
                          {(row.avgConfidence * 100).toFixed(1)}%
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
