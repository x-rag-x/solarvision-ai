import React from "react";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  FileCheck2,
  Gauge,
  HelpCircle,
  Info,
  Layers,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import { HISTORICAL_MODEL_EVALUATION } from "@/lib/modelData";
import { DEFECT_CLASS_LIST, getDefectMeta } from "@/lib/defects";

// Shared SolarVision UI Components
import PageHeader from "@/components/solarvision/PageHeader";
import ModelBadge from "@/components/solarvision/ModelBadge";
import StatusBadge from "@/components/solarvision/StatusBadge";
import NoticeBar from "@/components/solarvision/NoticeBar";
import StatCard from "@/components/solarvision/StatCard";

export default function ModelPerformance() {
  const { data: modelStatus } = trpc.model.status.useQuery();
  const { data: model2Status } = trpc.model2Elpv.status.useQuery();
  const { data: sandiaStatus } = trpc.sandiaPerformance.status.useQuery();
  const { data: model4Status } = trpc.predictiveMaintenance.status.useQuery();
  const ready = Boolean(modelStatus?.exists);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Model Registry & Governance"
        description="Review active checkpoint availability, architecture parameters, and evaluation benchmark results across all 4 machine learning pipelines."
        badge={<span className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs font-semibold text-text border border-border">4 Operational Engines</span>}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge tone={ready ? "success" : "warning"}>
              {ready ? "M1 YOLO Checkpoint Active" : "CLI Fallback Mode"}
            </StatusBadge>
            <Link
              href="/inspection"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#965660] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#7E454E] transition-colors shadow-xs"
            >
              <span>Test Inspection</span>
              <ArrowRight className="h-3 w-3 text-white" />
            </Link>
          </div>
        }
      />

      {/* Mandatory Scientific Transparency Notice */}
      <NoticeBar
        tone="info"
        message="Governance Invariant: Benchmark evaluation results are recorded on independent held-out subsets; not certified for autonomous factory rejection."
        details={
          <p>
            In accordance with zero-fabrication standards, training-time metrics (e.g. YOLO 91.87% internal validation)
            are distinguished from held-out generalization figures (69.75% mAP@50 on 792 unseen EL images).
          </p>
        }
      />

      {/* Top Grid: Model Architecture & Runtime Specifications */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Active Checkpoint Architecture Card (7 cols) */}
        <div className="lg:col-span-7 rounded-xl bg-sapphire text-white p-6 shadow-xs flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-dusty-pink">
                  Active Checkpoint (Model 1)
                </span>
                <h2 className="mt-1 text-xl font-bold text-white">
                  Ultralytics YOLO26n (best.pt)
                </h2>
                <p className="mt-1 text-xs text-white/70">
                  Single-stage anchor-free CNN (50 epochs, mAP@50=91.87% on internal validation; 69.75% on held-out test).
                </p>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-dusty-pink">
                <BrainCircuit className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-6 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <span className="text-white/60">Checkpoint Status</span>
                <StatusBadge tone={ready ? "success" : "danger"}>
                  {ready ? "Verified (backend/models/best.pt)" : "Missing / CLI Fallback"}
                </StatusBadge>
              </div>

              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <span className="text-white/60">Parameter Complexity</span>
                <span className="font-mono text-white/90">
                  {HISTORICAL_MODEL_EVALUATION.parameterCount.toLocaleString()} weights (5.2 GFLOPs @ 640×640)
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <span className="text-white/60">SHA-256 Checksum</span>
                <span
                  className="font-mono text-xs text-dusty-pink truncate max-w-[220px]"
                  title={HISTORICAL_MODEL_EVALUATION.checkpointSha256}
                >
                  {HISTORICAL_MODEL_EVALUATION.checkpointSha256}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white/60">Supported Defect Classes</span>
                <span className="font-mono font-semibold text-white">9 Classes (PVELAD Schema)</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-white/70">
            <span>FastAPI Bridge with CLI Fallback</span>
            <span className="font-mono text-xs text-dusty-pink">PVELAD EL2021 Benchmark</span>
          </div>
        </div>

        {/* Runtime Settings Card (5 cols) */}
        <div className="lg:col-span-5 rounded-xl border border-border bg-surface p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                Model Operating Guidelines
              </span>
              <Scale className="h-4 w-4 text-text-3" />
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-xl border border-border bg-surface-subtle p-3 space-y-1">
                <span className="font-semibold text-text flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-sapphire" />
                  Baseline Cutoff: 0.25
                </span>
                <p className="text-text-3 leading-relaxed">
                  Calibrated to reject optical noise from multi-busbar solder joints while capturing significant cracks.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface-subtle p-3 space-y-1">
                <span className="font-semibold text-text flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-text-3" />
                  Factory Persistence
                </span>
                <p className="text-text-3 leading-relaxed">
                  Completed inference bounding boxes, execution latency, and source file metadata are permanently committed.
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/inspection"
            className="inline-flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text hover:bg-surface-subtle transition-colors shadow-xs"
          >
            <span>Launch M1 Defect Detection</span>
            <ExternalLink className="h-3.5 w-3.5 text-sapphire" />
          </Link>
        </div>
      </div>

      {/* Held-out Benchmark KPI Strip */}
      <section className="rounded-xl border border-border bg-surface p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Held-Out Generalization Evaluation (PVELAD / 792 Images)
            </span>
            <h3 className="text-base font-bold text-text mt-0.5">
              Independent Model 1 Benchmark Metrics
            </h3>
          </div>
          <span className="rounded-full bg-surface-subtle border border-border px-2.5 py-0.5 font-mono text-xs text-text-2">
            Threshold: 0.25
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="rounded-xl border border-border bg-surface-subtle p-3.5">
            <span className="text-xs text-text-3 block">mAP@50</span>
            <span className="font-mono text-xl font-bold text-text tabular-nums mt-0.5 block">
              {(HISTORICAL_MODEL_EVALUATION.metricsAt025.mAP50 * 100).toFixed(2)}%
            </span>
            <span className="text-xs text-text-3">Mean Average Precision</span>
          </div>

          <div className="rounded-xl border border-border bg-surface-subtle p-3.5">
            <span className="text-xs text-text-3 block">mAP@50-95</span>
            <span className="font-mono text-xl font-bold text-text tabular-nums mt-0.5 block">
              {(HISTORICAL_MODEL_EVALUATION.metricsAt025.mAP50_95 * 100).toFixed(2)}%
            </span>
            <span className="text-xs text-text-3">COCO standard metric</span>
          </div>

          <div className="rounded-xl border border-border bg-surface-subtle p-3.5">
            <span className="text-xs text-text-3 block">Precision (0.25)</span>
            <span className="font-mono text-xl font-bold text-text tabular-nums mt-0.5 block">
              {(HISTORICAL_MODEL_EVALUATION.metricsAt025.precision * 100).toFixed(2)}%
            </span>
            <span className="text-xs text-text-3">1,379 True Positives</span>
          </div>

          <div className="rounded-xl border border-border bg-surface-subtle p-3.5">
            <span className="text-xs text-text-3 block">Recall (0.25)</span>
            <span className="font-mono text-xl font-bold text-text tabular-nums mt-0.5 block">
              {(HISTORICAL_MODEL_EVALUATION.metricsAt025.recall * 100).toFixed(2)}%
            </span>
            <span className="text-xs text-text-3">512 False Negatives</span>
          </div>

          <div className="rounded-xl border border-border bg-surface-subtle p-3.5">
            <span className="text-xs text-text-3 block">Overall F1</span>
            <span className="font-mono text-xl font-bold text-text tabular-nums mt-0.5 block">
              {(HISTORICAL_MODEL_EVALUATION.metricsAt025.f1 * 100).toFixed(2)}%
            </span>
            <span className="text-xs text-text-3">Harmonic mean P & R</span>
          </div>
        </div>
      </section>

      {/* Nine Defect Classes Breakdown */}
      <section className="rounded-xl border border-border bg-surface p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Taxonomy & Class Verification
            </span>
            <h3 className="text-base font-bold text-text">Supported Defect Classes (9 Classes)</h3>
          </div>
          <span className="rounded-full bg-surface-subtle border border-border px-2.5 py-0.5 font-mono text-xs text-text-2">
            PVELAD Standard
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HISTORICAL_MODEL_EVALUATION.classMetrics.map(item => {
            const meta = getDefectMeta(item.key);
            return (
              <div
                key={item.key}
                className="rounded-xl border border-border bg-surface-subtle p-4 space-y-2.5 hover:border-brand/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    <div>
                      <h4 className="text-xs font-semibold text-text">{meta.label}</h4>
                      <p className="font-mono text-xs text-text-3">ID: {item.classId}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold capitalize ${
                      meta.severity === "critical"
                        ? "bg-danger-tint text-danger border border-danger/20"
                        : meta.severity === "high"
                        ? "bg-warning-tint text-terracotta border border-warning/20"
                        : "bg-surface text-text-2 border border-border"
                    }`}
                  >
                    {meta.severity}
                  </span>
                </div>

                <p className="text-xs text-text-3 leading-relaxed min-h-[36px]">
                  {meta.description}
                </p>

                <div className="grid grid-cols-3 gap-2 rounded-lg bg-surface p-2 text-center border border-border/60 text-xs">
                  <div>
                    <span className="text-xs text-text-3 block">Precision</span>
                    <span className="font-mono font-semibold text-text">
                      {(item.precision * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-text-3 block">Recall</span>
                    <span className="font-mono font-semibold text-text">
                      {(item.recall * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-text-3 block">F1 Score</span>
                    <span className="font-mono font-semibold text-text">
                      {(item.f1 * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Models 2, 3, 4 Governance Overviews */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Model 2 ELPV Card */}
        <div className="rounded-xl border border-border bg-surface p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <span className="font-mono text-xs font-bold text-text">Model 2 · ELPV</span>
            <StatusBadge tone="success">Active</StatusBadge>
          </div>
          <h4 className="text-xs font-bold text-text">EfficientNet-B0 Cell Screening</h4>
          <p className="text-xs text-text-3 leading-relaxed">
            Binary defectiveness screening trained on 2,624 images. Accuracy 69.81%, Recall 68.67% at threshold 0.55.
          </p>
          <div className="pt-2 border-t border-border/60">
            <Link
              href="/cell-screening"
              className="text-xs font-semibold text-sapphire hover:underline inline-flex items-center gap-1"
            >
              <span>Open Cell Screening</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Model 3 Sandia Card */}
        <div className="rounded-xl border border-border bg-surface p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <span className="font-mono text-xs font-bold text-text">Model 3 · Sandia</span>
            <StatusBadge tone="success">Verified</StatusBadge>
          </div>
          <h4 className="text-xs font-bold text-text">Solar Electrical Performance</h4>
          <p className="text-xs text-text-3 leading-relaxed">
            scikit-learn regression pipeline predicting power retention. MAE 0.793 pp, RMSE 1.107 pp, R² 0.581.
          </p>
          <div className="pt-2 border-t border-border/60">
            <Link
              href="/predictive-quality"
              className="text-xs font-semibold text-sapphire hover:underline inline-flex items-center gap-1"
            >
              <span>Open Sandia Forecaster</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Model 4 AI4I Card */}
        <div className="rounded-xl border border-border bg-surface p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <span className="font-mono text-xs font-bold text-text">Model 4 · AI4I</span>
            <StatusBadge tone="neutral">Evaluated</StatusBadge>
          </div>
          <h4 className="text-xs font-bold text-text">Predictive Equipment Maintenance</h4>
          <p className="text-xs text-text-3 leading-relaxed">
            Gradient boosted pipeline evaluated on AI4I benchmark. Accuracy 96.67%, ROC-AUC 0.931 across 5 failure modes.
          </p>
          <div className="pt-2 border-t border-border/60">
            <Link
              href="/predictive-maintenance"
              className="text-xs font-semibold text-sapphire hover:underline inline-flex items-center gap-1"
            >
              <span>Open Maintenance Center</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
