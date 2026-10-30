/**
 * SolarVision AI — Model 3: Sandia Model Architecture Variants
 * Future Architectural Extensions & Operational State Manifest
 * 
 * STRICT COMPLIANCE:
 * - Shows Sandia Tabular Predictor, EL-Image Multimodal Experiment, and Next-Observation Forecasting.
 * - Explicitly quarantines and marks multimodal and sequential models as experimental/planned.
 * - Never claims non-operational modes are live.
 */

import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Camera,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  LineChart,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MODEL_VARIANTS } from "../modelVariants";
import type { ModelVariantId } from "../types";

interface ModelVariantsRoadmapCardProps {
  selectedVariant?: ModelVariantId;
  onSelectVariant?: (variantId: ModelVariantId) => void;
  isTabularReady?: boolean;
}

export function ModelVariantsRoadmapCard({
  selectedVariant = "sandia_tabular",
  onSelectVariant,
  isTabularReady = false,
}: ModelVariantsRoadmapCardProps) {
  return (
    <Card className="rounded-xl border border-border bg-surface p-6 shadow-xs sm:p-7 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-sapphire">
              Model 3 Evolution & Roadmap
            </span>
            <Badge className="bg-surface-subtle text-text-2 border border-border text-xs font-mono">
              3 Architectures Planned
            </Badge>
          </div>
          <h3 className="mt-1 text-lg font-bold tracking-tight text-sapphire">
            Electrical Performance Model Architecture Family
          </h3>
          <p className="text-xs text-text-3 mt-0.5">
            Extensible architecture supporting tabular regression, optical EL multimodal fusion, and temporal yield forecasting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-mono">
            Tabular Primary Active
          </Badge>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {MODEL_VARIANTS.map((v) => {
          const isSelected = selectedVariant === v.id;
          const isOperational = v.status === "operational";

          return (
            <div
              key={v.id}
              onClick={() => onSelectVariant?.(v.id)}
              className={`rounded-xl border p-5 flex flex-col justify-between transition-all cursor-pointer ${
                isSelected
                  ? "border-sapphire bg-surface-subtle shadow-xs"
                  : "border-border bg-surface hover:border-sapphire/40"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  {v.status === "operational" ? (
                    <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-semibold gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      OPERATIONAL INFERENCE
                    </Badge>
                  ) : v.status === "in_development" ? (
                    <Badge className="bg-warning-tint text-warning border-warning-border text-xs font-semibold gap-1">
                      <AlertTriangle className="h-3 w-3 text-warning" />
                      EXPERIMENTAL
                    </Badge>
                  ) : (
                    <Badge className="bg-surface-subtle text-text-2 border border-border text-xs font-semibold gap-1">
                      <Clock className="h-3 w-3 text-text-3" />
                      ROADMAP PLANNED
                    </Badge>
                  )}

                  <span className="text-xs font-mono text-text-3 uppercase">
                    {v.badge}
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                      v.id === "sandia_tabular"
                        ? "bg-sapphire/15 text-sapphire"
                        : v.id === "el_multimodal"
                        ? "bg-soft-lavender-tint text-soft-lavender-text"
                        : "bg-terracotta/15 text-terracotta"
                    }`}
                  >
                    {v.id === "sandia_tabular" ? (
                      <Cpu className="h-5 w-5 text-sapphire" />
                    ) : v.id === "el_multimodal" ? (
                      <Camera className="h-5 w-5 text-soft-lavender-text" />
                    ) : (
                      <LineChart className="h-5 w-5 text-terracotta" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-sapphire leading-snug">{v.name}</h4>
                    <p className="text-xs text-text-3 mt-0.5">{v.headline}</p>
                  </div>
                </div>

                <p className="text-xs text-text-2 leading-relaxed">{v.description}</p>

                <div className="space-y-1.5 border-t border-border pt-3 text-xs">
                  <span className="font-semibold text-text-3 uppercase tracking-wider text-xs">
                    Inputs:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {v.inputs.map((inp, idx) => (
                      <span
                        key={idx}
                        className="rounded-md bg-surface-subtle px-1.5 py-0.5 font-mono text-xs text-text-2 border border-border"
                      >
                        {inp}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs text-text-3 italic leading-relaxed">
                  {v.readinessNotice}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
