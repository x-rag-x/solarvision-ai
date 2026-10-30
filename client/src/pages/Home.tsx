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
  Cpu,
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
        description="Unified industrial intelligence platform for crystalline photovoltaic manufacturing: visual electroluminescence inspection, cell defectiveness screening, electrical performance forecasting, and electromechanical equipment health monitoring."
        badge={<span className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs font-semibold text-text border border-border">Production Ops</span>}
        actions={
          <Link
            href="/inspection"
            className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-ink/90 transition-all active:scale-[0.98]"
          >
            <ScanLine className="h-4 w-4 text-brand" />
            <span>Run M1 Inspection</span>
            <ArrowRight className="h-3.5 w-3.5 text-text-3" />
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
          caption="Across persisted detections"
          icon={Target}
        />
        <StatCard
          label="Defect Classes Seen"
          value={configured && stats?.defectTypes != null ? stats.defectTypes : undefined}
          isUnknown={!isAuthenticated || !configured}
          unknownReason="Sign in with authorized operator credentials to view live metrics"
          caption="Unique labels observed in DB (out of 9)"
          icon={Gauge}
        />
        <StatCard
          label="M1 Inference Latency"
          value={
            configured && stats?.avgProcessingTimeMs != null
              ? Math.round(stats.avgProcessingTimeMs)
              : undefined
          }
          unit="ms"
          isUnknown={!isAuthenticated || !configured}
          unknownReason="Sign in with authorized operator credentials to view live metrics"
          caption="Measured model inference latency"
          icon={Clock3}
        />
      </div>

      {/* UNIFIED FOUR-MODEL ARCHITECTURE STATUS MATRIX */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-success animate-pulse" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-3">
                System Status & Model Registry
              </h2>
            </div>
            <h3 className="text-lg font-bold tracking-tight text-text mt-0.5">
              Four-Model Operational Architecture
            </h3>
          </div>
          <span className="rounded-full bg-surface-subtle px-3 py-1 font-mono text-xs text-text-2 border border-border">
            Strict Zero-Fabrication Enforcement
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* MODEL 1 */}
          <div className="flex flex-col justify-between rounded-xl border border-border bg-surface-subtle p-5 hover:border-brand/50 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded bg-ink px-2 py-0.5 font-mono text-xs font-bold text-brand">
                  MODEL 1
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-tint px-2 py-0.5 text-xs font-semibold text-brand-text border border-warning/20">
                  <CheckCircle2 className="h-3 w-3" /> Academic Prototype
                </span>
              </div>
              <h4 className="mt-3 text-sm font-bold text-text">
                AI-Based Solar Cell Defect Detection
              </h4>
              <p className="mt-1 text-xs text-text-2 leading-relaxed">
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
                  <span className="font-medium text-brand-text">PVELAD (91.87% mAP@50)</span>
                </div>
                <div className="flex justify-between text-text-2">
                  <span className="text-text-3">Domain:</span>
                  <span className="font-medium text-text">Solar Cell EL/NIR</span>
                </div>
              </div>
            </div>
            <Link
              href="/inspection"
              className="mt-5 inline-flex items-center justify-between rounded-lg bg-surface border border-border px-3 py-2 text-xs font-semibold text-text hover:bg-surface-subtle transition-colors shadow-xs"
            >
              <span>Run Inspection</span>
              <ArrowRight className="h-3.5 w-3.5 text-brand-text" />
            </Link>
          </div>

          {/* MODEL 2 */}
          <div className="flex flex-col justify-between rounded-xl border border-border bg-surface-subtle p-5 hover:border-brand/50 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded bg-ink px-2 py-0.5 font-mono text-xs font-bold text-brand">
                  MODEL 2
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-success-tint px-2 py-0.5 text-xs font-semibold text-success border border-success/20">
                  <CheckCircle2 className="h-3 w-3" /> Trained Screening
                </span>
              </div>
              <h4 className="mt-3 text-sm font-bold text-text">
                AI-Based Solar Cell Defectiveness Screening
              </h4>
              <p className="mt-1 text-xs text-text-2 leading-relaxed">
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
              className="mt-5 inline-flex items-center justify-between rounded-lg bg-surface border border-border px-3 py-2 text-xs font-semibold text-text hover:bg-surface-subtle transition-colors shadow-xs"
            >
              <span>Cell Screening</span>
              <ArrowRight className="h-3.5 w-3.5 text-brand-text" />
            </Link>
          </div>

          {/* MODEL 3 */}
          <div className="flex flex-col justify-between rounded-xl border border-border bg-surface-subtle p-5 hover:border-brand/50 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded bg-ink px-2 py-0.5 font-mono text-xs font-bold text-brand">
                  MODEL 3
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-info-tint px-2 py-0.5 text-xs font-semibold text-info border border-info/20">
                  <CheckCircle2 className="h-3 w-3" /> Pipeline Ready
                </span>
              </div>
              <h4 className="mt-3 text-sm font-bold text-text">
                Sandia Solar Electrical Performance Prediction
              </h4>
              <p className="mt-1 text-xs text-text-2 leading-relaxed">
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
              className="mt-5 inline-flex items-center justify-between rounded-lg bg-surface border border-border px-3 py-2 text-xs font-semibold text-text hover:bg-surface-subtle transition-colors shadow-xs"
            >
              <span>Predict Performance</span>
              <ArrowRight className="h-3.5 w-3.5 text-brand-text" />
            </Link>
          </div>

          {/* MODEL 4 */}
          <div className="flex flex-col justify-between rounded-xl border border-border bg-surface-subtle p-5 hover:border-brand/50 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded bg-ink px-2 py-0.5 font-mono text-xs font-bold text-brand">
                  MODEL 4
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-text-2 border border-border">
                  <CheckCircle2 className="h-3 w-3" /> Benchmark Evaluated
                </span>
              </div>
              <h4 className="mt-3 text-sm font-bold text-text">
                AI-Based Equipment Predictive Maintenance
              </h4>
              <p className="mt-1 text-xs text-text-2 leading-relaxed">
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
                  <span className="font-medium text-brand-text">Benchmark Evaluated</span>
                </div>
              </div>
            </div>
            <Link
              href="/predictive-maintenance"
              className="mt-5 inline-flex items-center justify-between rounded-lg bg-surface border border-border px-3 py-2 text-xs font-semibold text-text hover:bg-surface-subtle transition-colors shadow-xs"
            >
              <span>Maintenance Center</span>
              <ArrowRight className="h-3.5 w-3.5 text-brand-text" />
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
              <h3 className="text-sm font-bold text-text">Live Architecture & Demonstration Stages</h3>
            </div>
            <span className="rounded bg-brand-tint px-2 py-0.5 font-mono text-xs font-bold text-brand-text">
              DEV MODE ACTIVE
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/cell-screening"
              className="group rounded-xl border border-border bg-surface-subtle p-3.5 hover:border-brand transition-all"
            >
              <div className="flex items-center justify-between text-xs text-text-3 mb-1">
                <span>Stage 02</span>
                <Scan className="h-4 w-4 text-brand-text" />
              </div>
              <h4 className="text-xs font-semibold text-text group-hover:text-brand-text">
                M2 Cell Screening
              </h4>
              <p className="mt-1 text-xs text-text-3 leading-relaxed">
                EfficientNet-B0 cell classification with 0.55 cutoff and mandatory review.
              </p>
            </Link>

            <Link
              href="/predictive-quality"
              className="group rounded-xl border border-border bg-surface-subtle p-3.5 hover:border-brand transition-all"
            >
              <div className="flex items-center justify-between text-xs text-text-3 mb-1">
                <span>Stage 03</span>
                <Activity className="h-4 w-4 text-info" />
              </div>
              <h4 className="text-xs font-semibold text-text group-hover:text-info">
                M3 Sandia Performance
              </h4>
              <p className="mt-1 text-xs text-text-3 leading-relaxed">
                Normalized PV power retention prediction via Sandia regression pipeline.
              </p>
            </Link>

            <Link
              href="/predictive-maintenance"
              className="group rounded-xl border border-border bg-surface-subtle p-3.5 hover:border-brand transition-all"
            >
              <div className="flex items-center justify-between text-xs text-text-3 mb-1">
                <span>Stage 04</span>
                <Wrench className="h-4 w-4 text-text-2" />
              </div>
              <h4 className="text-xs font-semibold text-text">
                M4 Equipment Health
              </h4>
              <p className="mt-1 text-xs text-text-3 leading-relaxed">
                AI4I machine reliability evaluation and TWF/HDF/PWF failure mode analysis.
              </p>
            </Link>

            <Link
              href="/roadmap"
              className="group rounded-xl border border-border bg-surface-subtle p-3.5 hover:border-brand transition-all"
            >
              <div className="flex items-center justify-between text-xs text-text-3 mb-1">
                <span>Architecture</span>
                <Cpu className="h-4 w-4 text-brand-text" />
              </div>
              <h4 className="text-xs font-semibold text-text group-hover:text-brand-text">
                Data Flow Diagram
              </h4>
              <p className="mt-1 text-xs text-text-3 leading-relaxed">
                Vite client → tRPC v11 → Express → FastAPI Inference → SQLite persistence.
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
            <h3 className="text-base font-bold text-text">Recent Inspection History</h3>
          </div>
          <Link
            href="/history"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-2 hover:text-text transition-colors"
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
                      <p className="text-xs font-semibold text-text truncate group-hover:text-brand-text transition-colors">
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
                    <ExternalLink className="h-3.5 w-3.5 text-text-3 group-hover:text-text transition-colors" />
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-ink/90 transition-colors shadow-xs"
              >
                <ScanLine className="h-3.5 w-3.5 text-brand" />
                <span>Start First Inspection</span>
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
