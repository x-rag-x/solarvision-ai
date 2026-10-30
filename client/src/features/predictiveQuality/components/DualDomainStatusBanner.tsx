/**
 * SolarVision AI — Model 3: Predictive Quality Monitoring
 * Dual Domain Status Banner & Critical Domain Quarantine Disclaimer
 */

import React, { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  ExternalLink,
  Flame,
  Info,
  ShieldAlert,
  Sun,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function DualDomainStatusBanner() {
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  return (
    <div className="space-y-4">
      {/* Top Level Dual Domain Comparison Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Domain 1: General Semiconductor Benchmark */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-white p-5 shadow-sm">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-amber-500/10 blur-xl pointer-events-none" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-800">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Semiconductor Benchmark (UCI SECOM)
                  </h3>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs uppercase font-semibold">
                    Benchmark Only
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Microelectronics In-Situ Sensor Baseline • 590 Channels
                </p>
              </div>
            </div>
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-mono">
              EVALUATED
            </Badge>
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs leading-relaxed text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div>
                <span className="font-semibold">Algorithmic Reference:</span> Trained on 1,567 historical IC wafer runs (104 excursions, 14:1 imbalance). Used strictly to audit high-dimensional sparse ML behavior.
              </div>
            </div>
          </div>
        </div>

        {/* Domain 2: Solar PV Manufacturing Quality Model */}
        <div className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-white p-5 shadow-sm">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-rose-500/10 blur-xl pointer-events-none" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-100 text-rose-800">
                <Sun className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Solar Manufacturing Quality Model
                  </h3>
                  <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-xs uppercase font-semibold">
                    Not Trained
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Photovoltaic Cell & Stringer Line Control • 32 Canonical Features
                </p>
              </div>
            </div>
            <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-xs font-mono">
              DATASET BLOCKED
            </Badge>
          </div>

          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs leading-relaxed text-rose-900">
            <div className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" />
              <div>
                <span className="font-semibold">Zero Factory Telemetry:</span> 0 confirmed quality labels exist in the active database. Zero synthetic scores served. Production model blocked pending physical flash & SCADA streams.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Prominent Mandatory Safety Quarantine Banner */}
      <div className="rounded-2xl border border-amber-600/30 bg-[#0B0909] p-4 text-white shadow-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F2B941] text-[#0B0909]">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#F2B941]">
                Critical Domain Quarantine Notice
              </p>
              <p className="mt-0.5 text-xs text-slate-300 leading-relaxed max-w-3xl">
                Benchmark predictions reflect microelectronics wafer fab physics (lithography & dry-etching). They are <span className="font-semibold text-white underline decoration-[#F2B941] underline-offset-2">strictly unsuitable for operational solar cell manufacturing decisions</span> (stringer ribbon tension, furnace peak profiles, or EVA lamination).
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setDetailsExpanded(!detailsExpanded)}
            className="self-start sm:self-auto border-white/20 bg-white/5 text-xs text-white hover:bg-white/10 hover:text-white"
          >
            {detailsExpanded ? (
              <>
                Hide Comparison <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Domain Comparison <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>

        {detailsExpanded && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/15 text-slate-400">
                    <th className="py-2 pr-4 font-semibold">Engineering Dimension</th>
                    <th className="py-2 px-4 font-semibold text-amber-300">SECOM Benchmark (Evaluated)</th>
                    <th className="py-2 pl-4 font-semibold text-rose-300">Solar Factory Model (Blocked)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-slate-300">
                  <tr>
                    <td className="py-2.5 pr-4 font-medium text-white">Physical Product</td>
                    <td className="py-2.5 px-4 text-amber-100">Silicon Integrated Circuits (IC Wafers)</td>
                    <td className="py-2.5 pl-4 text-rose-100">Crystalline PV Solar Cells & Modules</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium text-white">Manufacturing Steps</td>
                    <td className="py-2.5 px-4">Photolithography, Dry Etch, CMP, PVD/CVD</td>
                    <td className="py-2.5 pl-4">Screen Printing, Fast-Firing, Stringing, Lamination</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium text-white">Input Feature Schema</td>
                    <td className="py-2.5 px-4">590 anonymized sensor series (integers)</td>
                    <td className="py-2.5 pl-4">32 canonical physical engineering units (°C, N, bar)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium text-white">Electrical Metric</td>
                    <td className="py-2.5 px-4">Multi-site electrical wafer probe sort</td>
                    <td className="py-2.5 pl-4">Flash-test Voc, Isc, Fill Factor (FF), Efficiency (η)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium text-white">Production Safety</td>
                    <td className="py-2.5 px-4 text-emerald-400 font-semibold">Approved for Algorithm Benchmark Only</td>
                    <td className="py-2.5 pl-4 text-rose-400 font-semibold">Inference Blocked (Zero Factory Training)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
