import React from "react";
import { ArrowRight, Bot, BrainCircuit, CheckCircle2, Compass, Cpu, Layers, Scan, ShieldCheck, Wrench, Zap } from "lucide-react";
import PageHeader from "@/components/solarvision/PageHeader";
import StatusBadge from "@/components/solarvision/StatusBadge";
import ModelBadge from "@/components/solarvision/ModelBadge";
import NoticeBar from "@/components/solarvision/NoticeBar";
import { Link } from "wouter";

const phases = [
  {
    id: "M1",
    title: "Visual Defect Detection",
    status: "Implemented",
    tone: "success" as const,
    icon: Bot,
    path: "/inspection",
    copy: "EL/NIR image upload, YOLO26n / PyTorch inference, bounding boxes, confidence scores, annotated evidence, history, and defect analytics on PVELAD benchmark.",
  },
  {
    id: "M2",
    title: "Solar Cell Defectiveness Screening",
    status: "Implemented",
    tone: "success" as const,
    icon: Scan,
    path: "/cell-screening",
    copy: "Full-cell grayscale screening on ELPV benchmark (2,624 images) using EfficientNet-B0. Evaluates individual cropped cells with 0.55 decision cutoff and mandatory operator review policy.",
  },
  {
    id: "M3",
    title: "Solar Electrical Performance Prediction",
    status: "Implemented",
    tone: "success" as const,
    icon: Zap,
    path: "/predictive-quality",
    copy: "Predict reference-normalized PV power retention from electrical and environmental features using Sandia PV research pipeline (MAE 0.793 pp, R² 0.581), with secondary UCI SECOM benchmark accessible.",
  },
  {
    id: "M4",
    title: "Equipment Predictive Maintenance",
    status: "Benchmark Evaluated",
    tone: "neutral" as const,
    icon: Wrench,
    path: "/predictive-maintenance",
    copy: "AI4I 2020 physical milling benchmark evaluated with 5 failure modes (TWF, HDF, PWF, OSF, RNF) at 96.67% accuracy. Distinguished clearly from unvalidated solar factory machinery.",
  },
];

export default function Roadmap() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Four-Model Operational Architecture"
        description="SolarVision AI is modular, evidence-first, and grounded in empirical validation. All four operational models maintain strict zero-fabrication contracts and independent lifecycle boundaries."
        badge={<span className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs font-semibold text-text border border-border">Lifecycle Governance</span>}
      />

      <NoticeBar
        tone="info"
        message="Zero-Fabrication Contract: Every reported accuracy, defect count, and parameter is verified against physical model checkpoints."
        details={
          <p>
            No synthetic placeholders or assumed numbers are served to operators. Each model operates inside an
            independent boundary with documented training datasets, evaluation thresholds, and operational review policies.
          </p>
        }
      />

      {/* 4 Models List */}
      <div className="space-y-4">
        {phases.map((phase, index) => (
          <div
            key={phase.id}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 rounded-xl border border-border bg-surface p-6 shadow-xs hover:border-sapphire/40 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface-subtle border border-border text-text">
                <phase.icon className="h-6 w-6 text-sapphire" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-sapphire bg-soft-lavender-tint border border-soft-lavender/30 px-2 py-0.5 rounded">
                    {phase.id}
                  </span>
                  <h3 className="text-base font-bold text-text">{phase.title}</h3>
                  <StatusBadge tone={phase.tone}>{phase.status}</StatusBadge>
                </div>
                <p className="text-xs text-text-3 max-w-2xl leading-relaxed">{phase.copy}</p>
              </div>
            </div>

            <Link
              href={phase.path}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-subtle transition-colors shrink-0 shadow-xs"
            >
              <span>Launch Module</span>
              <ArrowRight className="h-3.5 w-3.5 text-text-3" />
            </Link>
          </div>
        ))}
      </div>

      {/* Optional Experimental Root Cause Note */}
      <div className="rounded-2xl border border-border bg-surface-subtle p-6 space-y-2">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface text-sapphire border border-border">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-text">
              Optional Experimental Module: Manufacturing Root Cause Analysis
            </h4>
            <span className="font-mono text-xs text-text-3">Beta Stage · Disabled by Default</span>
          </div>
        </div>
        <p className="text-xs text-text-3 leading-relaxed max-w-3xl pl-12">
          An auxiliary forensic correlation module for joining inspection defect coordinates with factory SCADA sensors, batches, and machines. Managed via <strong>Settings &gt; Optional / Experimental Modules</strong>, and deactivated by default to maintain strict separation from the four core trained models.
        </p>
      </div>

      {/* Bottom Invariant Guarantee Card */}
      <div className="rounded-2xl bg-sapphire p-6 text-white space-y-3">
        <div className="flex items-center gap-2 text-dusty-pink">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">Zero-Fabrication Guarantee</span>
        </div>
        <p className="text-xs text-white/80 leading-relaxed max-w-3xl">
          SolarVision AI strictly separates benchmark experiments from validated factory equipment. No artificial confidence metrics or manufactured pass rates are presented.
        </p>
      </div>
    </div>
  );
}
