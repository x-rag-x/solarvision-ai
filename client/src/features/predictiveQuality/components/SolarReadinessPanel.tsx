/**
 * SolarVision AI — Model 3: Predictive Quality Monitoring
 * Solar PV Factory Dataset Readiness & Release Gate Panel
 */

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  Database,
  ExternalLink,
  Flame,
  Layers,
  Link as LinkIcon,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sun,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchSolarFactoryReadiness } from "../api";
import type { SolarReadinessData } from "../types";

export function SolarReadinessPanel() {
  const [readiness, setReadiness] = useState<SolarReadinessData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReadiness = async () => {
    setLoading(true);
    try {
      const data = await fetchSolarFactoryReadiness();
      setReadiness(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReadiness();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Status Card */}
      <Card className="rounded-3xl border border-rose-300/80 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] uppercase font-semibold">
                Status: NOT_TRAINED
              </Badge>
              <Badge className="bg-slate-100 text-slate-800 border-slate-300 text-[10px] font-mono">
                DATASET_BLOCKED
              </Badge>
              <span className="text-xs text-slate-400 font-mono">
                Canonical Feature Contract: 32 Dimensions (v1.0.0)
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Photovoltaic Manufacturing Quality Model Readiness
            </h2>
            <p className="text-xs text-slate-600 sm:text-sm max-w-2xl leading-relaxed">
              Model 3 for solar manufacturing monitors in-line flash testing (Voc, Isc, Fill Factor, efficiency) and SCADA furnace/laminator telemetry. Serving is strictly quarantined until real factory ground-truth labels are ingested.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadReadiness}
            disabled={loading}
            className="gap-2 rounded-xl border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 self-start sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-slate-400" : "text-[#F2B941]"}`} />
            Refresh Telemetry Audit
          </Button>
        </div>

        {/* Live Database Inventory Counter */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-5">
          {/* Batches */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              Manufacturing Batches
            </span>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {readiness?.tableCounts.batches ?? 0}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Database batches</p>
          </div>

          {/* Sensor Telemetry */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              Sensor Streams
            </span>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {readiness?.tableCounts.sensorReadings ?? 0}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Continuous records</p>
          </div>

          {/* Quality Outcome Labels */}
          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
            <span className="text-rose-700 text-[11px] font-semibold uppercase tracking-wider">
              Quality Labels
            </span>
            <p className="mt-2 text-2xl font-bold text-rose-700">
              {readiness?.tableCounts.qualityOutcomeLabels ?? 0}
            </p>
            <p className="text-[10px] text-rose-600 mt-0.5">Confirmed factory tiers</p>
          </div>

          {/* Linked Inspections */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              Linked Inspections
            </span>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {readiness?.tableCounts.linkedInspections ?? 0}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Model 1 optical records</p>
          </div>

          {/* Eligible Training Examples */}
          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
            <span className="text-rose-700 text-[11px] font-semibold uppercase tracking-wider">
              Eligible Training N
            </span>
            <p className="mt-2 text-2xl font-bold text-rose-700">
              {readiness?.tableCounts.eligibleTrainingExamples ?? 0}
            </p>
            <p className="text-[10px] text-rose-600 mt-0.5">Minimum 500 required</p>
          </div>
        </div>
      </Card>

      {/* Two Column Layout: Blocking Checklist & Prerequisites */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Active Blockers Checklist */}
        <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Active Production Blockers (Statistical Floor: N ≥ 500)
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            {readiness?.blockingReasons.map((reason, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50/40 p-3.5 text-xs text-rose-950 leading-relaxed"
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span>{reason}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">Zero-Fabrication Policy:</span> The SolarVision AI release gate prevents serving simulated risk scores or synthetic confidence percentages to plant operators.
          </div>
        </Card>

        {/* Prerequisites to Training */}
        <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#F2B941]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Prerequisites to Solar Model 3 Deployment
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            {readiness?.prerequisites.map((step, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-xs text-slate-700 leading-relaxed"
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-200 font-mono text-[10px] font-bold text-slate-700">
                  {index + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 text-[11px] text-emerald-900">
            <span className="font-semibold">Contract Ready:</span> The 32-feature solar schema (`CANONICAL_SOLAR_FEATURES`, v1.0.0) is synchronized across Python and TypeScript. Ingestion can begin immediately once factory CSVs or SCADA webhooks connect.
          </div>
        </Card>
      </div>
    </div>
  );
}
