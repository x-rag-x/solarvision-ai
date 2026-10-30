import { ArrowRight, Bot, BrainCircuit, Cable, CheckCircle2, Compass, Cpu, DatabaseZap, Scan, Wrench, Zap } from "lucide-react";
import { PageIntro, StatusBadge } from "@/components/solarvision/Primitives";

const phases = [
  {
    id: "M1",
    title: "Visual Defect Detection",
    status: "Implemented",
    tone: "success" as const,
    icon: Bot,
    copy: "EL/NIR image upload, YOLO / PyTorch inference, bounding boxes, confidence scores, annotated evidence, history, and defect analytics on PVELAD benchmark.",
  },
  {
    id: "M2",
    title: "Solar Cell Defectiveness Screening",
    status: "Implemented",
    tone: "success" as const,
    icon: Scan,
    copy: "Full-cell grayscale screening on ELPV benchmark (2,624 images) using EfficientNet-B0. Evaluates individual cropped cells with 0.55 decision cutoff and mandatory operator review policy.",
  },
  {
    id: "M3",
    title: "Solar Electrical Performance Prediction",
    status: "Implemented",
    tone: "success" as const,
    icon: Zap,
    copy: "Predict reference-normalized PV power retention from electrical and environmental features using Sandia PV research pipeline (MAE 0.793 pp, R² 0.581), with secondary UCI SECOM benchmark accessible.",
  },
  {
    id: "M4",
    title: "Equipment Predictive Maintenance",
    status: "Benchmark Evaluated",
    tone: "neutral" as const,
    icon: Wrench,
    copy: "AI4I 2020 physical milling benchmark evaluated with 5 failure modes (TWF, HDF, PWF, OSF, RNF) at 96.67% accuracy. Distinguished clearly from unvalidated solar factory machinery.",
  },
];

export default function Roadmap() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Product Architecture & Model Registry"
        title="Four-Model Operational Architecture."
        description="SolarVision AI is modular and grounded in empirical validation. All four operational models maintain strict zero-fabrication contracts and independent lifecycle boundaries."
      />

      <div className="relative space-y-4">
        {phases.map((phase, index) => (
          <div
            key={phase.id}
            className="relative grid gap-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(7,27,41,0.04)] md:grid-cols-[110px_1fr_auto] md:items-center"
          >
            <div className="flex items-center gap-4 md:block">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#F4F0D7] px-3 py-1.5 font-mono text-xs font-medium text-slate-500">
                <span className="text-[#F2B941]">{phase.id}</span>
                <span className="text-slate-300">/</span>
                <span>0{index + 1}</span>
              </div>
              <phase.icon className="hidden h-9 w-9 text-slate-200 md:mt-5 md:block" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold tracking-[-0.03em]">{phase.title}</h2>
                <StatusBadge tone={phase.tone}>{phase.status}</StatusBadge>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{phase.copy}</p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <CheckCircle2 className="h-4 w-4 text-[#F2B941]" />
              {phase.status}
            </div>
          </div>
        ))}
      </div>

      {/* Optional / Experimental Root Cause Note */}
      <div className="rounded-2xl border border-slate-200/80 bg-[#FAF9F5] p-6 text-slate-800">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FFF3C4] text-[#0B0909]">
            <Compass className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">
              Optional Experimental Module: Manufacturing Root Cause Analysis
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
              An auxiliary forensic correlation module for joining inspection defect coordinates with factory SCADA sensors, batches, and machines. Managed via <strong>Settings &gt; Optional / Experimental Modules</strong>, and deactivated by default to maintain strict separation from the four core trained models.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-[#0B0909] p-6 text-white">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F2B941]">
              Zero-Fabrication Contract
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
              Inspection → Screening → Performance → Maintenance
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Every prediction is backed by verified model checkpoints or reproducible benchmark datasets, with explicit provenance and no synthetic quality claims.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 font-mono text-xs text-[#F2B941]">
            <DatabaseZap className="h-4 w-4" />
            4 Active Models <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
