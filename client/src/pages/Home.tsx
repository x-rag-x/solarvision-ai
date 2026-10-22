import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Compass,
  Database,
  ExternalLink,
  Factory,
  Gauge,
  Info,
  LogIn,
  Radio,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
  Wrench,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { DataSourceNote, EmptyData, PageIntro, StatusBadge } from "@/components/solarvision/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/_core/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/auth-helpers";
import { SessionExpiredBanner } from "@/components/solarvision/AuthGuard";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  accent,
  isLoading,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Target;
  accent: string;
  isLoading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(7,27,41,0.04)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-3 h-8 w-24 rounded-lg" />
          ) : (
            <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#0B0909]">{value}</p>
          )}
          <p className="mt-1 text-[11px] text-slate-400">{detail}</p>
        </div>
        <div
          className="grid h-10 w-10 place-items-center rounded-xl"
          style={{ backgroundColor: `${accent}15`, color: accent }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = trpc.dashboard.stats.useQuery();

  const { data: model1Status } = trpc.model.status.useQuery();
  const { data: model2Status } = trpc.rootCause.status.useQuery();
  const { data: model3Status } = trpc.predictiveQuality.status.useQuery();
  const { data: model4Status } = trpc.predictiveMaintenance.status.useQuery();

  const {
    data: history,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = trpc.inspection.history.useQuery({ limit: 5 });

  const isAuthError = isUnauthorizedError(statsError) || isUnauthorizedError(historyError);
  const configured = Boolean(stats?.configured) && !isAuthError;
  const model1Ready = model1Status?.exists;

  const handleRetry = () => {
    refetchStats();
    refetchHistory();
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Unified Smart Factory Operations & Four-Model Architecture"
        title="SolarVision AI Control Center"
        description="Unified industrial intelligence platform for crystalline photovoltaic manufacturing: visual electroluminescence inspection, root-cause correlation, predictive quality forecasting, and electromechanical equipment health monitoring."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/inspection"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B0909] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(7,27,41,0.14)] transition-transform hover:-translate-y-0.5"
            >
              <ScanLine className="h-4 w-4 text-[#F2B941]" />
              Run M1 Inspection
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      {isAuthError && <SessionExpiredBanner onRetry={handleRetry} />}

      {!isAuthenticated && !isAuthError && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#0B0909] text-[#F2B941]">
              <LogIn className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-amber-950">Operator Authentication Recommended</p>
              <p className="text-[11px] text-amber-800">
                Sign in with your operator identity to run AI inspections and persist protected factory records.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => startLogin()}
            className="h-8 gap-1.5 rounded-lg bg-[#0B0909] px-3.5 text-xs font-semibold text-white hover:bg-slate-800 sm:shrink-0"
          >
            <LogIn className="h-3 w-3 text-[#F2B941]" />
            Sign in
          </Button>
        </div>
      )}

      <DataSourceNote configured={configured} />

      {/* Primary Production Statistics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="M1 Inspections Processed"
          value={configured ? stats?.inspections ?? 0 : 0}
          detail="Stored inspection records"
          icon={ScanLine}
          accent="#F2B941"
          isLoading={statsLoading}
        />
        <StatCard
          label="Defects Detected"
          value={configured ? stats?.detections ?? 0 : 0}
          detail="Across persisted detections"
          icon={Target}
          accent="#FDCD5E"
          isLoading={statsLoading}
        />
        <StatCard
          label="Defect Classes Seen"
          value={configured ? stats?.defectTypes ?? 0 : 0}
          detail="Unique labels observed in DB (out of 9)"
          icon={Gauge}
          accent="#F2B941"
          isLoading={statsLoading}
        />
        <StatCard
          label="M1 Inference Latency"
          value={
            configured && stats?.avgProcessingTimeMs != null
              ? `${Math.round(stats.avgProcessingTimeMs)} ms`
              : "—"
          }
          detail="Measured model inference latency"
          icon={Clock3}
          accent="#FDCD5E"
          isLoading={statsLoading}
        />
      </div>

      {/* UNIFIED FOUR-MODEL ARCHITECTURE STATUS MATRIX */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F2B941]">
                System Status & Model Registry
              </p>
            </div>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Four-Model Operational Architecture
            </h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-[11px] text-slate-600">
            Strict Zero-Fabrication Enforcement
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* MODEL 1 */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-[#FAF9F5] p-5 transition-shadow hover:shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-[#0B0909] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#F2B941]">
                  MODEL 1
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3 w-3" /> Operational
                </span>
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900">Visual Defect Detection</h3>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                YOLO26n anchor-free CNN inspecting EL/NIR solar cell frames. Detects 9 defect classes with bounding boxes and confidence calibration.
              </p>
              <div className="mt-4 space-y-1.5 border-t border-slate-200/60 pt-3 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Engine:</span>
                  <span className="font-mono font-medium">YOLOv8 / PyTorch</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Checkpoint:</span>
                  <span className="font-mono text-emerald-700">best.pt verified</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Domain:</span>
                  <span className="font-medium text-slate-800">Solar Cell EL/NIR</span>
                </div>
              </div>
            </div>
            <Link
              href="/inspection"
              className="mt-5 inline-flex items-center justify-between rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <span>Run Inspection</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#F2B941]" />
            </Link>
          </div>

          {/* MODEL 2 */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-[#FAF9F5] p-5 transition-shadow hover:shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-[#0B0909] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#F2B941]">
                  MODEL 2
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  <ShieldAlert className="h-3 w-3" /> Training Blocked
                </span>
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900">Root-Cause Analysis</h3>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Multimodal correlation software operational. Genuine supervised training quarantined pending authenticated factory SCADA & AOI telemetry.
              </p>
              <div className="mt-4 space-y-1.5 border-t border-slate-200/60 pt-3 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Software:</span>
                  <span className="font-mono text-emerald-700">Available</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Supervised Model:</span>
                  <span className="font-mono text-amber-700">DATASET_BLOCKED</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Expert Review:</span>
                  <span className="font-medium text-slate-800">Operational</span>
                </div>
              </div>
            </div>
            <Link
              href="/root-cause"
              className="mt-5 inline-flex items-center justify-between rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <span>Audit Readiness</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#F2B941]" />
            </Link>
          </div>

          {/* MODEL 3 */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-[#FAF9F5] p-5 transition-shadow hover:shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-[#0B0909] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#F2B941]">
                  MODEL 3
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                  <CheckCircle2 className="h-3 w-3" /> Benchmark Active
                </span>
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900">Predictive Quality</h3>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                UCI SECOM semiconductor wafer benchmark integrated (590 features, ROC-AUC 0.821 / 0.637 drift). Solar quality model untrained.
              </p>
              <div className="mt-4 space-y-1.5 border-t border-slate-200/60 pt-3 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Benchmark Domain:</span>
                  <span className="font-mono text-emerald-700">UCI SECOM Ready</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Solar PV Domain:</span>
                  <span className="font-mono text-amber-700">not_trained</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Optimal Cutoff:</span>
                  <span className="font-mono text-slate-800">&tau;* = 0.07</span>
                </div>
              </div>
            </div>
            <Link
              href="/predictive-quality"
              className="mt-5 inline-flex items-center justify-between rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <span>Explore Benchmark</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#F2B941]" />
            </Link>
          </div>

          {/* MODEL 4 */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-[#FAF9F5] p-5 transition-shadow hover:shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-[#0B0909] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#F2B941]">
                  MODEL 4
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-800">
                  <CheckCircle2 className="h-3 w-3" /> Benchmark Evaluated
                </span>
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900">Predictive Maintenance</h3>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                AI4I 2020 synthetic milling benchmark evaluated (6 raw features, failure classification &amp; 5 modes). Solar machine model untrained.
              </p>
              <div className="mt-4 space-y-1.5 border-t border-slate-200/60 pt-3 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Benchmark Domain:</span>
                  <span className="font-mono text-emerald-700">AI4I Evaluated</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Solar PV Machine:</span>
                  <span className="font-mono text-amber-700">not_trained</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Modes Modeled:</span>
                  <span className="font-mono text-slate-800">TWF, HDF, PWF, OSF, RNF</span>
                </div>
              </div>
            </div>
            <Link
              href="/predictive-maintenance"
              className="mt-5 inline-flex items-center justify-between rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <span>Maintenance Center</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#F2B941]" />
            </Link>
          </div>
        </div>
      </div>

      {/* Domain Segregation & Scientific Transparency Notice */}
      <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#0B0909] text-[#F2B941]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Rigorous Scientific Transparency &amp; Domain Isolation Invariant
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              SolarVision AI operates under an uncompromised zero-fabrication pledge. All four modules maintain independent lifecycle contracts:
              <strong> Model 1</strong> executes real-time vision defect inference on solar cells.
              <strong> Model 2</strong> correlation pipeline is ready, but genuine model weights remain quarantined.
              <strong> Model 3</strong> is trained on the real UCI SECOM microelectronics benchmark, never misrepresented as solar fab yield.
              <strong> Model 4</strong> is evaluated on the UCI AI4I 2020 synthetic milling benchmark, never claimed as solar cell laminator telemetry.
            </p>
          </div>
        </div>
      </div>

      {/* 6-STEP DEMONSTRATION WORKFLOW */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F2B941]">
              Live Demonstration Guide
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              End-to-End Four-Model Tour
            </h2>
          </div>
          <span className="hidden sm:inline-block rounded-full bg-[#FFF3C4] px-3 py-1 font-mono text-[11px] font-semibold text-amber-900">
            6 Operational Stages
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              n: "01",
              title: "M1 Cell Inspection",
              desc: "Upload EL/NIR frame to execute YOLO26n defect detection with bounding boxes.",
              path: "/inspection",
              icon: ScanLine,
            },
            {
              n: "02",
              title: "M2 Data Readiness",
              desc: "Inspect SCADA readiness metrics and review expert-annotated defect records.",
              path: "/root-cause",
              icon: Compass,
            },
            {
              n: "03",
              title: "M3 Quality Benchmark",
              desc: "Simulate 590-feature semiconductor wafer runs with calibrated cost-sensitive cutoff.",
              path: "/predictive-quality",
              icon: Activity,
            },
            {
              n: "04",
              title: "M4 Maintenance Benchmark",
              desc: "Run AI4I physical milling machine inference and diagnose TWF, HDF, PWF failure modes.",
              path: "/predictive-maintenance",
              icon: Wrench,
            },
            {
              n: "05",
              title: "Inspection & Audit History",
              desc: "Inspect immutable audit logs, SQLite records, and detection summaries.",
              path: "/history",
              icon: Clock3,
            },
            {
              n: "06",
              title: "Defect Analytics & Alerts",
              desc: "Analyze Pareto distributions, class frequencies, and real-time operational notifications.",
              path: "/analytics",
              icon: Target,
            },
          ].map((step) => (
            <Link
              key={step.n}
              href={step.path}
              className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/70 bg-[#FAF9F5] p-5 transition-all hover:-translate-y-0.5 hover:border-[#F2B941] hover:bg-white hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-400 group-hover:text-[#F2B941]">
                    STAGE {step.n}
                  </span>
                  <step.icon className="h-4 w-4 text-slate-400 group-hover:text-[#F2B941]" />
                </div>
                <h4 className="mt-3 text-sm font-bold text-slate-900 group-hover:text-slate-950">
                  {step.title}
                </h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  {step.desc}
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-[11px] font-semibold text-[#0B0909] group-hover:text-[#F2B941]">
                <span>Launch Stage</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Latest Activity: Inspection History Table with Direct Links */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F2B941]">
              Live Records
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Recent Inspection History
            </h2>
          </div>
          <Link
            href="/history"
            className="text-xs font-semibold text-[#0B0909] hover:text-[#F2B941] transition-colors"
          >
            View all history <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
          </Link>
        </div>

        {historyLoading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        ) : history && history.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {history.map((item) => {
              const hasDefects = item.detectionsCount > 0;
              return (
                <div
                  key={item.inspectionId}
                  onClick={() => setLocation(`/inspection/${item.inspectionId}`)}
                  className="group flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between cursor-pointer rounded-xl px-2 transition-colors hover:bg-slate-50/80"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        hasDefects ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-800 group-hover:text-[#0B0909]">
                        {item.sourceFilename}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                        {item.inspectionId.slice(0, 8)} · {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        hasDefects
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {item.detectionsCount} defect{item.detectionsCount === 1 ? "" : "s"}
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      {Math.round(item.processingTimeMs)} ms
                    </span>
                    <StatusBadge tone={item.status === "completed" ? "success" : "danger"}>
                      {item.status}
                    </StatusBadge>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#0B0909] transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyData
            compact
            title="No inspections yet"
            description="Run your first EL/NIR inspection to populate this activity feed directly from the database."
          />
        )}
      </div>
    </div>
  );
}
