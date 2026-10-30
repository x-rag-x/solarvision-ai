/**
 * SolarVision AI — Phase 3: Model Limitations & Evidence Disclosure Card
 * 
 * Displays transparent boundaries of AI Model 2:
 * - Dataset horizon & sensor coverage assumptions
 * - Correlation vs causation boundaries
 * - Sensor failure sensitivity
 * - Human-in-the-loop operational policy
 */

import React from "react";
import {
  AlertCircle,
  BrainCircuit,
  CheckCircle,
  FileText,
  Info,
  Scale,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

export interface ModelLimitationsCardProps {
  modelVersionId?: string;
  limitations?: string[];
}

const DEFAULT_LIMITATIONS = [
  "Inference correlates spatial defect geometry with discrete SCADA sensor intervals; unmonitored atmospheric variables (e.g. cleanroom humidity) are excluded.",
  "Assumes stationary sensor calibration; fouled thermal couples or drifted pressure transducers may skew causal ranking.",
  "Model is trained exclusively on PERC/TOPCon solar cell architectures and may not generalize to tandem perovskite-silicon recipes.",
  "Probabilities reflect Random Forest / Decision Tree ensemble class distributions calibrated against historical defect-telemetry splits.",
];

export function ModelLimitationsCard({
  modelVersionId = "2.0-alpha",
  limitations = DEFAULT_LIMITATIONS,
}: ModelLimitationsCardProps) {
  const displayLimitations = limitations && limitations.length > 0 ? limitations : DEFAULT_LIMITATIONS;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-900">
            Model Scope, Limitations & Governance
          </h3>
        </div>
        <span className="font-mono text-xs text-slate-500">
          Model 2 Contract • {modelVersionId}
        </span>
      </div>

      {/* Limitations List */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Known Operational Boundaries
        </p>
        <ul className="space-y-2 text-xs text-slate-600">
          {displayLimitations.map((limitation, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{limitation}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Human In The Loop Notice */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
          <UserCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900">
            Mandatory Human-in-the-Loop Protocol
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Model 2 outputs are algorithmic decision-support recommendations. Line shutdowns, furnace
            re-profiling, or metallization screen replacements must be verified by a qualified
            Manufacturing Engineer before execution.
          </p>
        </div>
      </div>
    </div>
  );
}
