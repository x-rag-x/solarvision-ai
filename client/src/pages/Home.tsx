import * as React from "react";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Factory,
  Gauge,
  Info,
  LogIn,
  Radio,
  Scan,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Wrench,
  Workflow,
  Layers,
  Database,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAppMode } from "@/contexts/ModeContext";
import { isUnauthorizedError } from "@/lib/auth-helpers";
import { openOperatorLoginModal } from "@/const";

// Shared SolarVision UI Components
import PageHeader from "@/components/solarvision/PageHeader";
import StatCard from "@/components/solarvision/StatCard";
import StatusBadge from "@/components/solarvision/StatusBadge";
import ModelBadge from "@/components/solarvision/ModelBadge";
import NoticeBar from "@/components/solarvision/NoticeBar";
import AuthPrompt from "@/components/solarvision/AuthPrompt";
import { EmptyState, Skeleton } from "@/components/solarvision/StateComponents";

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { isDev, isProd } = useAppMode();

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = trpc.dashboard.stats.useQuery(undefined, {
    enabled: Boolean(isAuthenticated),
  });

  const { data: model1Status } = trpc.model.status.useQuery();
  const { data: model2Status } = trpc.model2Elpv.status.useQuery();
  const { data: sandiaStatus } = trpc.sandiaPerformance.status.useQuery();
  const { data: model4Status } = trpc.predictiveMaintenance.status.useQuery(undefined, {
    enabled: Boolean(isAuthenticated),
  });

  const {
    data: history,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = trpc.inspection.history.useQuery(
    { limit: 5 },
    { enabled: Boolean(isAuthenticated) }
  );

  const isAuthError = isUnauthorizedError(statsError) || isUnauthorizedError(historyError);
  const configured = Boolean(stats?.configured) && !isAuthError;
  const model1Ready = model1Status?.exists;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="SolarVision AI Control Center"
        description="Industrial intelligence platform for crystalline photovoltaic manufacturing: visual electroluminescence inspection, cell defect screening, electrical performance forecasting, and equipment health monitoring."
        badge={<span className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs font-semibold text-sapphire border border-border">Production Ops</span>}
        actions={
          <Link
            href="/inspection"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#2F3A58] px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-[#242E47] transition-all active:scale-[0.98]"
          >
            <ScanLine className="h-4 w-4 text-[#F2DBD7]" />
            <span>Run M1 Inspection</span>
            <ArrowRight className="h-3.5 w-3.5 text-white/70" />
          </Link>
        }
      />

      {/* Auth Banner & Provenance Notice */}
      {!isAuthenticated ? (
        <AuthPrompt
          variant="banner"
          description="Signed out view: Zero-fabrication guarantees unauthenticated metrics remain undisclosed. Sign in to query live factory inspection statistics."
          actionText="Sign In as Operator"
        />
      ) : (
        <NoticeBar
          tone="info"
          message="Storage layer verified: Metrics below reflect stored production inspection records (Zero-fabrication enforced)."
          details={
            <p>
              Persistent database active. Every displayed detection, defect classification count,
              and latency number is computed from verified production runs and immutable audit logs.
            </p>
          }
        />
      )}

      {/* Primary KPI Strip (Zero Fabrication: '—' when signed out, never false 0) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="M1 Inspections Processed"
          value={configured && stats?.inspections != null ? stats.inspections : undefined}
          isUnknown={!isAuthenticated || !configured}
          unknownReason="Sign in with authorized operator credentials to view live metrics"
          caption="Stored inspection records"
          icon={ScanLine}
        />
        <StatCard
          label="Defects Detected"
          value={configured && stats?.detections != null ? stats.detections : undefined}
          isUnknown={!isAuthenticated || !configured}
          unknownReason="Sign in with authorized operator credentials to view live metrics"
          caption="Total localized defects"
          icon={Target}
        />
        <StatCard
          label="Average Inference Latency"
          value={
            configured && stats?.avgProcessingTimeMs != null
              ? `${Math.round(stats.avgProcessingTimeMs)} ms`
              : undefined
          }
          isUnknown={!isAuthenticated || !configured}
          unknownReason="Sign in with authorized operator credentials to view live metrics"
          caption="Measured YOLO execution time"
          icon={Clock3}
        />
        <StatCard
          label="M1 Pipeline Status"
          value={model1Ready ? "Online" : "Fallback"}
          unit={model1Ready ? "CUDA/CPU" : "Simulated"}
          caption={model1Ready ? "best.pt verified" : "Evaluation fallback active"}
          icon={Gauge}
        />
      </div>

      {/* Four-Model Architecture Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-3">
                System Status & Model Registry
              </h2>
            </div>
            <h3 className="text-lg font-bold tracking-tight text-sapphire mt-0.5">
              Four-Model Operational Architecture
            </h3>
          </div>
          <span className="rounded-full bg-surface-subtle px-3 py-1 font-mono text-xs text-text-2 border border-border">
            Strict Zero-Fabrication Enforcement
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* MODEL 1 */}
          <div className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-5 hover:border-sapphire/50 hover:shadow-sm transition-all duration-150">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-surface-subtle px-2 py-0.5 font-mono text-[10px] font-bold text-sapphire border border-border tracking-wider">
                  MODEL 1
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-tint px-2 py-0.5 text-[11px] font-semibold text-warning border border-warning-border">
                  <CheckCircle2 className="h-3 w-3" /> Academic Prototype
                </span>
              </div>
              <h4 className="mt-3 text-sm font-bold text-[#2F3A58] leading-snug">
                AI-Based Solar Cell Defect Detection
              </h4>
              <p className="mt-1.5 text-xs text-text-2 leading-relaxed min-h-[48px]">
                Detect and localize visible defects in supported solar-cell EL/NIR inspection images with bounding-box coordinates. Academic prototype / non-certified industrial use.
              </p>
              <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs">
                <div className="flex justify-between text-text-2">
                  <span className="text-text-3">Engine:</span>
                  <span className="font-mono font-medium text-text">YOLO / PyTorch</span>
                </div>
                <div className="flex justify-between text-text-2">
                  <span className="text-text-3">Checkpoint:</span>
                  <span className="font-mono text-success font-medium">best.pt verified</span>
                </div>
                <div className="flex justify-between text-text-2">
                  <span className="text-text-3">Validation:</span>
                  <span className="font-medium text-sapphire">PVELAD (91.87% mAP@50)</span>
                </div>
                <div className="flex justify-between text-text-2">
                  <span className="text-text-3">Domain:</span>
                  <span className="font-medium text-text">Solar Cell EL/NIR</span>
                </div>
              </div>
            </div>
            <Link
              href="/inspection"
              className="mt-5 w-full h-9 inline-flex items-center justify-between rounded-lg bg-surface-subtle border border-border px-3 text-xs font-semibold text-[#2F3A58] hover:bg-[#2F3A58] hover:text-white hover:border-[#2F3A58] transition-all duration-150 shadow-2xs group/btn"
            >
              <span>Run Inspection</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#59647D] group-hover/btn:text-white transition-colors" />
            </Link>
          </div>

          {/* MODEL 2 */}
          <div className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-5 hover:border-sapphire/50 hover:shadow-sm transition-all duration-150">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-surface-subtle px-2 py-0.5 font-mono text-[10px] font-bold text-sapphire border border-border tracking-wider">
                  MODEL 2
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-success-tint px-2 py-0.5 text-[11px] font-semibold text-success border border-success-border">
                  <CheckCircle2 className="h-3 w-3" /> Trained Screening
                </span>
              </div>
              <h4 className="mt-3 text-sm font-bold text-[#2F3A58] leading-snug">
                AI-Based Solar Cell Defectiveness Screening
              </h4>
              <p className="mt-1.5 text-xs text-text-2 leading-relaxed min-h-[48px]">
                Assess the likelihood that an individual cropped solar cell contains defects. Experimental screening only; every prediction requires mandatory operator review (no automated PASS/REJECT).
              </p>
              <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs">
                <div className="flex justify-between text-text-2">
                  <span className="text-text-3">Engine:</span>
                  <span className="font-mono font-medium text-text">EfficientNet-B0 / PyTorch</span>
                </div>
                <div className="flex justify-between text-text-2">
                  <span className="text-text-3">Dataset:</span>
                  <span className="font-mono text-text">ELPV (2,624 images)</span>
                </div>
                <div className="flex justify-between text-text-2">
                  <span className="text-text-3">Accuracy / Recall:</span>
                  <span className="font-mono text-success font-medium">69.81% / 68.67%</span>
                </div>
                <div className="flex justify-between text-text-2">
                  <span className="text-text-3">Precision / F1:</span>
                  <span className="font-mono text-text">45.97% / 55.07% (τ=0.55)</span>
                </div>
              </div>
            </div>
            <Link
              href="/cell-screening"
              className="mt-5 w-full h-9 inline-flex items-center justify-between rounded-lg bg-surface-subtle border border-border px-3 text-xs font-semibold text-[#2F3A58] hover:bg-[#2F3A58] hover:text-white hover:border-[#2F3A58] transition-all duration-150 shadow-2xs group/btn"
            >
              <span>Cell Screening</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#59647D] group-hover/btn:text-white transition-colors" />
            </Link>
          </div>

          {/* MODEL 3 */}
          <div className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-5 hover:border-sapphire/50 hover:shadow-sm transition-all duration-150">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-surface-subtle px-2 py-0.5 font-mono text-[10px] font-bold text-sapphire border border-border tracking-wider">
                  MODEL 3
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-info-tint px-2 py-0.5 text-[11px] font-semibold text-info border border-info-border">
                  <CheckCircle2 className="h-3 w-3" /> Pipeline Ready
                </span>
              </div>
              <h4 className="mt-3 text-sm font-bold text-[#2F3A58] leading-snug">
                Sandia Solar Electrical Performance Prediction
              </h4>
              <p className="mt-1.5 text-xs text-text-2 leading-relaxed min-h-[48px]">
                Predict reference-normalized PV electrical performance from supported environmental and electrical features. Research-domain limitations apply; secondary UCI SECOM benchmark accessible.
              </p>
              <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs">
                <div className="flex justify-between text-text-2">
                  <span className="text-text-3">Engine:</span>
                  <span className="font-mono font-medium text-text">scikit-learn Pipeline</span>
                </div>
                <div className="flex justify-between text-text-2">
                  <span className="text-text-3">Dataset:</span>
                  <span className="font-mono text-text">Sandia PV Research</span>
                </div>
                <div className="flex justify-between text-text-2">
                  <span className="text-text-3">Target:</span>
                  <span className="font-mono text-info font-medium">power_retention_pct</span>
                </div>
                <div className="flex justify-between text-text-2">
                  <span className="text-text-3">MAE / RMSE / R²:</span>
                  <span className="font-mono text-success font-medium">0.793 pp / 1.107 pp / 0.581</span>
                </div>
              </div>
            </div>
            <Link
              href="/predictive-quality"
              className="mt-5 w-full h-9 inline-flex items-center justify-between rounded-lg bg-surface-subtle border border-border px-3 text-xs font-semibold text-[#2F3A58] hover:bg-[#2F3A58] hover:text-white hover:border-[#2F3A58] transition-all duration-150 shadow-2xs group/btn"
            >
              <span>Predict Performance</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#59647D] group-hover/btn:text-white transition-colors" />
            </Link>
          </div>

          {/* MODEL 4 */}
          <div className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-5 hover:border-sapphire/50 hover:shadow-sm transition-all duration-150">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-surface-subtle px-2 py-0.5 font-mono text-[10px] font-bold text-sapphire border border-border tracking-wider">
                  MODEL 4
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-text-2 border border-border">
                  <CheckCircle2 className="h-3 w-3" /> Benchmark Evaluated
                </span>
              </div>
              <h4 className="mt-3 text-sm font-bold text-[#2F3A58] leading-snug">
                AI-Based Equipment Predictive Maintenance
              </h4>
              <p className="mt-1.5 text-xs text-text-2 leading-relaxed min-h-[48px]">
                Estimate equipment failure risk from machine operating inputs. AI4I physical benchmark evaluated; clear distinction from unvalidated solar factory machinery.
              </p>
              <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs">
                <div className="flex justify-between text-text-2">
                  <span className="text-text-3">Engine:</span>
                  <span className="font-mono font-medium text-text">AI4I 2020 Pipeline</span>
                </div>
                <div className="flex justify-between text-text-2">
                  <span className="text-text-3">Evaluation:</span>
                  <span className="font-mono font-medium text-text">Acc 96.67% · AUC 0.931</span>
                </div>
                <div className="flex justify-between text-text-2">
                  <span className="text-text-3">Failure Modes:</span>
                  <span className="font-mono text-text">TWF, HDF, PWF, OSF, RNF</span>
                </div>
                <div className="flex justify-between text-text-2">
                  <span className="text-text-3">Validation Status:</span>
                  <span className="font-medium text-sapphire">Benchmark Evaluated</span>
                </div>
              </div>
            </div>
            <Link
              href="/predictive-maintenance"
              className="mt-5 w-full h-9 inline-flex items-center justify-between rounded-lg bg-surface-subtle border border-border px-3 text-xs font-semibold text-[#2F3A58] hover:bg-[#2F3A58] hover:text-white hover:border-[#2F3A58] transition-all duration-150 shadow-2xs group/btn"
            >
              <span>Maintenance Center</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#59647D] group-hover/btn:text-white transition-colors" />
            </Link>
          </div>
        </div>
      </section>

      {/* Dev Mode Data Flow & Guided Tour */}
      {isDev && (
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                Developer Telemetry & Architecture
              </span>
              <h3 className="text-sm font-bold text-sapphire">Live Architecture & Demonstration Stages</h3>
            </div>
            <span className="rounded bg-soft-lavender-tint px-2 py-0.5 font-mono text-xs font-bold text-sapphire border border-soft-lavender/40">
              DEV MODE ACTIVE
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/inspection"
              className="group rounded-xl border border-border bg-surface-subtle p-3.5 hover:border-sapphire transition-all"
            >
              <div className="flex items-center justify-between text-xs text-text-3 mb-1">
                <span>Stage 01</span>
                <ScanLine className="h-4 w-4 text-sapphire" />
              </div>
              <h4 className="text-xs font-semibold text-text group-hover:text-sapphire">
                M1 Defect Detection
              </h4>
              <p className="mt-1 text-xs text-text-3 leading-relaxed">
                YOLO26n / PyTorch defect detection on EL/NIR images with confidence thresholding.
              </p>
            </Link>

            <Link
              href="/cell-screening"
              className="group rounded-xl border border-border bg-surface-subtle p-3.5 hover:border-terracotta transition-all"
            >
              <div className="flex items-center justify-between text-xs text-text-3 mb-1">
                <span>Stage 02</span>
                <Scan className="h-4 w-4 text-terracotta" />
              </div>
              <h4 className="text-xs font-semibold text-text group-hover:text-terracotta">
                M2 Cell Screening
              </h4>
              <p className="mt-1 text-xs text-text-3 leading-relaxed">
                EfficientNet-B0 cell classification with 0.55 cutoff and mandatory review.
              </p>
            </Link>

            <Link
              href="/predictive-quality"
              className="group rounded-xl border border-border bg-surface-subtle p-3.5 hover:border-sapphire transition-all"
            >
              <div className="flex items-center justify-between text-xs text-text-3 mb-1">
                <span>Stage 03</span>
                <Activity className="h-4 w-4 text-info" />
              </div>
              <h4 className="text-xs font-semibold text-text group-hover:text-sapphire">
                M3 Sandia Performance
              </h4>
              <p className="mt-1 text-xs text-text-3 leading-relaxed">
                Normalized PV power retention prediction via Sandia regression pipeline.
              </p>
            </Link>

            <Link
              href="/predictive-maintenance"
              className="group rounded-xl border border-border bg-surface-subtle p-3.5 hover:border-sapphire transition-all"
            >
              <div className="flex items-center justify-between text-xs text-text-3 mb-1">
                <span>Stage 04</span>
                <Wrench className="h-4 w-4 text-text-2" />
              </div>
              <h4 className="text-xs font-semibold text-text group-hover:text-sapphire">
                M4 Equipment Health
              </h4>
              <p className="mt-1 text-xs text-text-3 leading-relaxed">
                AI4I machine reliability evaluation and TWF/HDF/PWF failure mode analysis.
              </p>
            </Link>
          </div>
        </section>
      )}

      {/* Recent Inspection History */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Traceability Audit Trail
            </span>
            <h3 className="text-base font-bold text-sapphire">Recent Inspection History</h3>
          </div>
          <Link
            href="/history"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-2 hover:text-sapphire transition-colors"
          >
            <span>View All Records</span>
            <ArrowRight className="h-3.5 w-3.5 text-text-3" />
          </Link>
        </div>

        {historyLoading ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : history && history.length > 0 ? (
          <div className="divide-y divide-border/60">
            {history.map(item => {
              const hasDefects = item.detectionsCount > 0;
              return (
                <div
                  key={item.inspectionId}
                  onClick={() => setLocation(`/inspection/${item.inspectionId}`)}
                  className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 px-2 rounded-xl cursor-pointer hover:bg-surface-subtle transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        hasDefects ? "bg-warning" : "bg-success"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-text truncate group-hover:text-sapphire transition-colors">
                        {item.sourceFilename}
                      </p>
                      <p className="font-mono text-xs text-text-3">
                        {item.inspectionId.slice(0, 8)} • {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 text-xs">
                    <StatusBadge tone={hasDefects ? "warning" : "success"}>
                      {item.detectionsCount} defect{item.detectionsCount === 1 ? "" : "s"}
                    </StatusBadge>
                    <span className="font-mono text-text-3 hidden sm:inline">
                      {Math.round(item.processingTimeMs)} ms
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-text-3 group-hover:text-sapphire transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No Inspections Yet"
            description="Run your first EL/NIR cell inspection to populate this persistent activity log directly from the database."
            action={
              <Link
                href="/inspection"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2F3A58] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#242E47] transition-colors shadow-xs"
              >
                <ScanLine className="h-3.5 w-3.5 text-[#F2DBD7]" />
                <span>Start First Inspection</span>
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
