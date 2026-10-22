/**
 * SolarVision AI — Model 4: Dual Domain Status & Quarantine Notice
 * 
 * STRICT COMPLIANCE:
 * - Domain segregation between AI4I 2020 Benchmark and Solar Factory Equipment.
 * - Current-failure classification under operating condition, NOT Remaining Useful Life (RUL).
 * - High-visibility quarantine warning banner.
 */

import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Factory,
  Layers,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { VERIFIED_BENCHMARK_METADATA } from "../benchmarkData";

export function DualDomainStatusBanner() {
  return (
    <div className="space-y-4">
      {/* Side-by-Side Domain Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Domain 1: AI4I 2020 Industrial Benchmark */}
        <Card className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="absolute right-0 top-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full bg-emerald-500/5 pointer-events-none" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#0B0909] text-[#F2B941]">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Domain 1: Reference Benchmark
                  </span>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-mono">
                    Ready
                  </Badge>
                </div>
                <h3 className="text-base font-bold text-slate-900 sm:text-lg">
                  AI4I 2020 Maintenance Benchmark
                </h3>
              </div>
            </div>
            <span className="rounded-full bg-emerald-100 p-1 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs">
            <div>
              <p className="text-slate-400">Dataset Source</p>
              <p className="font-semibold text-slate-800">UCI / Siemens Industrial</p>
            </div>
            <div>
              <p className="text-slate-400">Model Version</p>
              <p className="font-mono font-semibold text-slate-800">
                {VERIFIED_BENCHMARK_METADATA.modelVersion}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Sample Records</p>
              <p className="font-semibold text-slate-800">10,000 runs (3.39% failure)</p>
            </div>
            <div>
              <p className="text-slate-400">Evaluation Scope</p>
              <p className="font-semibold text-emerald-700">Condition Classification</p>
            </div>
          </div>
        </Card>

        {/* Domain 2: Solar PV Manufacturing Equipment */}
        <Card className="relative overflow-hidden rounded-3xl border border-rose-200/80 bg-white p-6 shadow-sm">
          <div className="absolute right-0 top-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full bg-rose-500/5 pointer-events-none" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rose-950 text-rose-300">
                <Factory className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-rose-800">
                    Domain 2: Production Factory Equipment
                  </span>
                  <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] font-mono">
                    Not Trained
                  </Badge>
                </div>
                <h3 className="text-base font-bold text-slate-900 sm:text-lg">
                  Solar PV Equipment Model
                </h3>
              </div>
            </div>
            <span className="rounded-full bg-rose-100 p-1 text-rose-700">
              <XCircle className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs">
            <div>
              <p className="text-slate-400">Target Machines</p>
              <p className="font-semibold text-slate-800">Tabber, Laminator, Furnace</p>
            </div>
            <div>
              <p className="text-slate-400">Operational Gate</p>
              <p className="font-mono font-semibold text-rose-700">DATASET_BLOCKED</p>
            </div>
            <div>
              <p className="text-slate-400">Factory Logs</p>
              <p className="font-semibold text-rose-700">0 Ground-Truth Breakdowns</p>
            </div>
            <div>
              <p className="text-slate-400">Deployment Status</p>
              <p className="font-semibold text-rose-700">Strictly Quarantined</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Domain Quarantine Alert Banner */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-50/80 p-5 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold uppercase tracking-wider text-amber-900 font-mono">
                Domain Quarantine & Classification Scope Notice
              </span>
              <Badge className="bg-amber-200 text-amber-950 border-amber-300 text-[10px]">
                Evaluation Only
              </Badge>
            </div>
            <p className="mt-1 text-slate-700 leading-relaxed">
              <strong>1. Instantaneous Operating Classification (Not RUL):</strong> The AI4I 2020 benchmark performs 
              <em> binary failure classification under instantaneous operating conditions</em> (temperature, torque, rotational speed, and wear). 
              It does <strong>NOT</strong> calculate continuous Remaining Useful Life (RUL) trajectories or forecast future degradation curves over time.
            </p>
            <p className="mt-1.5 text-slate-700 leading-relaxed">
              <strong>2. Solar Factory Isolation:</strong> Predictions derived from this milling apparatus benchmark are 
              <strong> strictly forbidden</strong> from being applied to solar cell tabber/stringer blade replacement, 
              laminator diaphragm vacuum cycles, or furnace conveyor mesh adjustments. Factory equipment remains 
              marked <code>NOT_TRAINED</code> until authentic plant telemetry is ingested.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
