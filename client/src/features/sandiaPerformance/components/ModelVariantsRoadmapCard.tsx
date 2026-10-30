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
    <Card className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#F2B941]">
              Model 3 Evolution & Roadmap
            </span>
            <Badge className="bg-slate-100 text-slate-800 border-slate-300 text-xs font-mono">
              3 Architectures Planned
            </Badge>
          </div>
          <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
            Electrical Performance Model Architecture Family
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Extensible architecture supporting tabular regression, optical EL multimodal fusion, and temporal yield forecasting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-mono">
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
              className={`rounded-2xl border p-5 flex flex-col justify-between transition-all cursor-pointer ${
                isSelected
                  ? "border-[#0B0909] bg-slate-50/70 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/30"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  {v.status === "operational" ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-semibold gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      OPERATIONAL INFERENCE
                    </Badge>
                  ) : v.status === "in_development" ? (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs font-semibold gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-600" />
                      EXPERIMENTAL
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-xs font-semibold gap-1">
                      <Clock className="h-3 w-3 text-slate-500" />
                      ROADMAP PLANNED
                    </Badge>
                  )}

                  <span className="text-xs font-mono text-slate-400 uppercase">
                    {v.badge}
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                      v.id === "sandia_tabular"
                        ? "bg-[#F2B941]/20 text-[#0B0909]"
                        : v.id === "el_multimodal"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {v.id === "sandia_tabular" ? (
                      <Cpu className="h-5 w-5 text-[#0B0909]" />
                    ) : v.id === "el_multimodal" ? (
                      <Camera className="h-5 w-5 text-purple-700" />
                    ) : (
                      <LineChart className="h-5 w-5 text-blue-700" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">{v.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{v.headline}</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{v.description}</p>

                <div className="space-y-1.5 border-t border-slate-100 pt-3 text-xs">
                  <span className="font-semibold text-slate-500 uppercase tracking-wider text-xs">
                    Inputs:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {v.inputs.map((inp, idx) => (
                      <span
                        key={idx}
                        className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600"
                      >
                        {inp}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-500 italic leading-relaxed">
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
