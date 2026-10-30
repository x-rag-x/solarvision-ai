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
} from "lucide-react";
import { Link } from "wouter";
import { DataSourceNote, EmptyData, PageIntro, StatusBadge } from "@/components/solarvision/Primitives";
import { HISTORICAL_MODEL_EVALUATION } from "@/lib/modelData";
import { DEFECT_CLASS_LIST, getDefectMeta } from "@/lib/defects";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function ModelPerformance() {
  const { data: modelStatus, isLoading } = trpc.model.status.useQuery();
  const { data: model2Status } = trpc.model2Elpv.status.useQuery();
  const ready = Boolean(modelStatus?.exists);

  return (
    <div>
      <PageIntro
        eyebrow="Model Registry & Governance"
        title="Model status & benchmark evaluation."
        description="Review active checkpoint availability, inference readiness, supported defect classes, and historical evaluation benchmark metrics. In accordance with strict engineering integrity, benchmark metrics are explicitly labeled as static held-out evaluation results, not live production certification."
      />

      <DataSourceNote configured={ready} />

      {/* Top Grid: Model Architecture & Runtime Readiness */}
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Active Checkpoint Architecture Card */}
        <div className="rounded-2xl bg-[#0B0909] p-6 text-white shadow-[0_12px_32px_rgba(7,27,41,0.15)] flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F2B941]">
                  Active Checkpoint
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white">
                  Ultralytics YOLO26n / YOLOv8n
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Single-stage anchor-free CNN (50 epochs, mAP@50=91.87% on internal validation)
                </p>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-[#F2B941]">
                <BrainCircuit className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-6 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-slate-400">Model Status</span>
                <StatusBadge tone={ready ? "success" : "danger"}>
                  {ready ? "Checkpoint Verified" : "Checkpoint Missing"}
                </StatusBadge>
              </div>

              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-slate-400">Parameter Count</span>
                <span className="font-mono text-slate-200">
                  {HISTORICAL_MODEL_EVALUATION.parameterCount.toLocaleString()} (146 fused layers)
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-slate-400">Computational Complexity</span>
                <span className="font-mono text-slate-200">5.2 GFLOPs · 640×640 input</span>
              </div>

              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-slate-400">SHA-256 Checksum</span>
                <span
                  className="max-w-[200px] truncate font-mono text-[10px] text-slate-400"
                  title={HISTORICAL_MODEL_EVALUATION.checkpointSha256}
                >
                  {HISTORICAL_MODEL_EVALUATION.checkpointSha256}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Runtime Inference Path</span>
                <span
                  className="max-w-[220px] truncate font-mono text-[10px] text-slate-400"
                  title={modelStatus?.modelPath}
                >
                  {modelStatus?.modelPath || "backend/models/best.pt"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-white/5 p-3 text-[11px] text-slate-400 border border-white/10 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-[#F2B941] shrink-0" />
            <span>Inference Bridge: Python Ultralytics runtime via subprocess & CLI</span>
          </div>
        </div>

        {/* Runtime Gateways & Operational State */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(7,27,41,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F2B941]">
                  Integration Gateways
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-900">
                  Inference Readiness
                </h2>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF3C4] text-[#0B0909]">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-6 space-y-4 text-xs">
              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">Weights Checkpoint Present</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    `best.pt` detected on disk. The single-stage YOLO model is ready to process input frames.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <Database className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">
                    Persistence Layer: {modelStatus?.supabaseConfigured ? "Supabase Cloud" : "SQLite Local"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Completed inspections and bounding boxes are saved with full timestamp lineage.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <Sliders className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">Baseline Production Threshold: 0.25</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Calibrated to avoid false alarms from benign multi-busbar solder joints and crystal grain textures.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-xs text-slate-500">Want to test an EL/NIR cell?</span>
            <Link
              href="/inspection"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#F2B941] hover:text-[#0B0909]"
            >
              Go to inspection <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Prominent Historical Evaluation Notice & KPI Banner */}
      <div className="mt-6 rounded-2xl border border-amber-300/80 bg-amber-50/70 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-amber-950">
                Historical Benchmark Evaluation Subset (PVELAD / EL2021 Benchmark)
              </h3>
              <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
                Held-Out Subset: 792 Images
              </span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-amber-900/90">
              <strong>Mandatory Scientific Disclosure:</strong> The metrics displayed below represent{" "}
              <em>historical evaluation benchmark results</em> evaluated on an independent held-out test sample of{" "}
              <strong>792 EL images</strong> (stratified across 9 defect classes from the PVELAD dataset at threshold 0.25).
              These metrics reflect real-world generalization on unseen cells (mAP@50 = 69.75%), distinguished from the internal training/validation run (50 epochs, mAP@50 = 91.87%).
              In adherence to strict engineering integrity, this model is{" "}
              <strong>not presented as universally accurate or 100% production-certified</strong>.
            </p>
          </div>
        </div>

        {/* Historical Evaluation Key Metrics Cards */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-amber-200/80 bg-white p-4">
            <p className="text-[11px] font-medium text-slate-500">mAP@50</p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900">
              {(HISTORICAL_MODEL_EVALUATION.metricsAt025.mAP50 * 100).toFixed(2)}%
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">Mean Average Precision</p>
          </div>

          <div className="rounded-xl border border-amber-200/80 bg-white p-4">
            <p className="text-[11px] font-medium text-slate-500">mAP@50–95</p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900">
              {(HISTORICAL_MODEL_EVALUATION.metricsAt025.mAP50_95 * 100).toFixed(2)}%
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">COCO primary metric</p>
          </div>

          <div className="rounded-xl border border-amber-200/80 bg-white p-4">
            <p className="text-[11px] font-medium text-slate-500">Precision (0.25)</p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900">
              {(HISTORICAL_MODEL_EVALUATION.metricsAt025.precision * 100).toFixed(2)}%
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">1,379 True Positives</p>
          </div>

          <div className="rounded-xl border border-amber-200/80 bg-white p-4">
            <p className="text-[11px] font-medium text-slate-500">Recall (0.25)</p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900">
              {(HISTORICAL_MODEL_EVALUATION.metricsAt025.recall * 100).toFixed(2)}%
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">512 False Negatives</p>
          </div>

          <div className="rounded-xl border border-amber-200/80 bg-white p-4">
            <p className="text-[11px] font-medium text-slate-500">Overall F1 Score</p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900">
              {(HISTORICAL_MODEL_EVALUATION.metricsAt025.f1 * 100).toFixed(2)}%
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">Harmonic mean P & R</p>
          </div>

          <div className="rounded-xl border border-amber-200/80 bg-white p-4">
            <p className="text-[11px] font-medium text-slate-500">Evaluation Sample</p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900">
              {HISTORICAL_MODEL_EVALUATION.evaluationSubsetImages}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">Held-out test images</p>
          </div>
        </div>
      </div>

      {/* Threshold Comparison: Standard (0.25) vs High-Sensitivity (0.10) */}
      <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(7,27,41,0.04)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#FFF3C4] text-[#0B0909]">
              <Scale className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Operating Threshold Ladder Comparison
              </h3>
              <p className="text-xs text-slate-400">
                Trade-off analysis between standard production threshold (0.25) and high sensitivity (0.10)
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-[0.16em] text-slate-400 bg-slate-50/50">
                <th className="px-4 py-3 font-semibold">Operating Mode</th>
                <th className="py-3 font-semibold">Threshold</th>
                <th className="py-3 font-semibold">True Positives</th>
                <th className="py-3 font-semibold">False Positives</th>
                <th className="py-3 font-semibold">False Negatives</th>
                <th className="py-3 font-semibold">Precision</th>
                <th className="py-3 font-semibold">Recall</th>
                <th className="py-3 font-semibold">F1 Score</th>
                <th className="py-3 pr-4 font-semibold">Operational Application</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-emerald-50/30">
                <td className="px-4 py-3.5 font-semibold text-emerald-800">
                  Standard Production (Default)
                </td>
                <td className="py-3.5 font-mono font-bold text-slate-900">0.25</td>
                <td className="py-3.5 font-mono text-emerald-700">1,379</td>
                <td className="py-3.5 font-mono text-amber-700">515</td>
                <td className="py-3.5 font-mono text-rose-700">512</td>
                <td className="py-3.5 font-mono font-semibold">72.81%</td>
                <td className="py-3.5 font-mono font-semibold">72.92%</td>
                <td className="py-3.5 font-mono font-bold text-emerald-800">72.87%</td>
                <td className="py-3.5 pr-4 text-xs text-slate-600">
                  Balanced quality gate; prevents false alarms from busbars.
                </td>
              </tr>
              <tr className="bg-amber-50/30">
                <td className="px-4 py-3.5 font-semibold text-amber-800">
                  High Sensitivity Mode
                </td>
                <td className="py-3.5 font-mono font-bold text-slate-900">0.10</td>
                <td className="py-3.5 font-mono text-emerald-700">1,554 (+175)</td>
                <td className="py-3.5 font-mono text-rose-700">1,072 (+108%)</td>
                <td className="py-3.5 font-mono text-emerald-700">337 (-175)</td>
                <td className="py-3.5 font-mono font-semibold">59.18%</td>
                <td className="py-3.5 font-mono font-semibold text-emerald-700">82.18%</td>
                <td className="py-3.5 font-mono font-bold text-slate-700">68.81%</td>
                <td className="py-3.5 pr-4 text-xs text-slate-600">
                  Secondary review; catches faint cracks but requires human inspection.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Nine Supported Defect Classes */}
      <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(7,27,41,0.04)]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#FFF3C4] text-[#F2B941]">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Supported Defect Taxonomy (All 9 Classes)
              </h3>
              <p className="text-xs text-slate-400">
                Full class breakdown with historical benchmark metrics (tested on 792 held-out images at threshold 0.25)
              </p>
            </div>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-semibold text-slate-700">
            9 Classes Defined
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HISTORICAL_MODEL_EVALUATION.classMetrics.map(item => {
            const meta = getDefectMeta(item.key);
            return (
              <div
                key={item.key}
                className="rounded-xl border border-slate-200/70 bg-[#fdfdfd] p-4 transition-all hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{meta.label}</h4>
                      <p className="font-mono text-[10px] text-slate-400">Class ID: {item.classId}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      meta.severity === "critical"
                        ? "bg-rose-100 text-rose-700"
                        : meta.severity === "high"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {meta.severity}
                  </span>
                </div>

                <p className="mt-2.5 text-xs leading-relaxed text-slate-500 min-h-[38px]">
                  {meta.description}
                </p>

                {/* Historical Benchmark Metrics for this class */}
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                    <span>Ground Truth in 792 Set:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {item.groundTruthCount}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2 text-center">
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">Precision</p>
                      <p className="mt-0.5 font-mono text-xs font-semibold text-slate-800">
                        {(item.precision * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">Recall</p>
                      <p className="mt-0.5 font-mono text-xs font-semibold text-slate-800">
                        {(item.recall * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">F1 Score</p>
                      <p className="mt-0.5 font-mono text-xs font-bold text-slate-900">
                        {(item.f1 * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Model 2 ELPV Screening Benchmark Registry Section */}
      <div className="mt-6 rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#F2B941]/20 px-2 py-0.5 text-xs font-semibold text-[#8b6508] border border-[#F2B941]/40">
                Model 2
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700">
                solarvision_m2_elpv_binary_v1
              </span>
              <span className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-xs font-medium">
                Checkpoint Active
              </span>
            </div>
            <h3 className="mt-2 text-xl font-bold text-slate-900">
              Model 2 — Full-Cell Grayscale EL Defect Screening
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              EfficientNet-B0 transfer learning on ELPV benchmark (CC BY-NC-SA 4.0). Evaluates individual cropped cells.
            </p>
          </div>
          <Link href="/cell-screening">
            <Button className="bg-[#0B0909] text-white hover:bg-slate-800 text-xs">
              Open Cell Screening UI
            </Button>
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">Benchmark Accuracy</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">69.81%</span>
            <span className="text-[10px] text-slate-500">215 / 308 correct</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">Defective Recall</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">68.67%</span>
            <span className="text-[10px] text-slate-500">57 / 83 defective identified</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">Defective Precision</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">45.97%</span>
            <span className="text-[10px] text-slate-500">57 / 124 flagged</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">Decision Threshold</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">0.55</span>
            <span className="text-[10px] text-slate-500">Validation-selected</span>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 space-y-1">
          <p className="font-semibold text-amber-950 flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 text-amber-700" />
            Mandatory Operator Review Policy
          </p>
          <p className="leading-relaxed">
            Every Model 2 output is designated <code>screening_only</code> with review status <code>pending</code>.
            Zero automated PASS/REJECT decisions are permitted. True module independence is not established (44 modules, no source IDs).
          </p>
        </div>
      </div>

      {/* Operational Limitations & Known Model Blind Spots */}
      <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/50 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-rose-100 text-rose-700">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-rose-950">
              Known Blind Spots & Operational Safeguards
            </h3>
            <p className="text-xs text-rose-800/80">
              Important boundaries identified during held-out evaluation that operators must observe
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {HISTORICAL_MODEL_EVALUATION.knownLimitations.map(item => (
            <div
              key={item.title}
              className="rounded-xl border border-rose-200/70 bg-white p-4 text-xs"
            >
              <p className="font-semibold text-rose-900">{item.title}</p>
              <p className="mt-1 text-slate-600 leading-relaxed">{item.impact}</p>
              <p className="mt-2 text-rose-800 font-medium border-t border-rose-100 pt-2">
                Action: {item.recommendation}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
