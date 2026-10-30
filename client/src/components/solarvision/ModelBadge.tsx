import React from "react";

export type ModelId = "M1" | "M2" | "M3" | "M4" | "RCA";

interface ModelBadgeProps {
  model: ModelId;
  readiness?: string;
  className?: string;
}

const modelMeta: Record<ModelId, { label: string; defaultReadiness: string }> = {
  M1: { label: "Model 1 · YOLO26n", defaultReadiness: "Academic prototype" },
  M2: { label: "Model 2 · ELPV", defaultReadiness: "Screening only" },
  M3: { label: "Model 3 · Sandia", defaultReadiness: "Pipeline verified" },
  M4: { label: "Model 4 · AI4I", defaultReadiness: "Benchmark evaluated" },
  RCA: { label: "Root Cause · RF", defaultReadiness: "Beta experimental" },
};

export function ModelBadge({ model, readiness, className = "" }: ModelBadgeProps) {
  const meta = modelMeta[model] || { label: model, defaultReadiness: "" };
  const displayReadiness = readiness || meta.defaultReadiness;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-subtle px-2 py-0.5 text-xs text-text-2 font-medium ${className}`}
    >
      <span className="font-mono font-semibold text-text">{model}</span>
      <span className="text-border-strong">•</span>
      <span className="text-xs text-text-3">{displayReadiness}</span>
    </span>
  );
}

export default ModelBadge;
