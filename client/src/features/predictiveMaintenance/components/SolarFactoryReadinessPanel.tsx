/**
 * SolarVision AI — Model 4: Solar Factory Equipment Readiness Panel
 * 
 * STRICT COMPLIANCE:
 * - Keeps Solar Model 4 marked NOT_TRAINED / DATASET_BLOCKED.
 * - Displays actual availability of factory equipment telemetry.
 * - Distinct from AI4I 2020 benchmark.
 */

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Database,
  Factory,
  Layers,
  Lock,
  RefreshCw,
  ShieldAlert,
  Wrench,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchSolarMaintenanceReadiness } from "../api";
import { SOLAR_EQUIPMENT_CATALOG } from "../benchmarkData";
import type { SolarMaintenanceReadiness } from "../types";

export function SolarFactoryReadinessPanel() {
  const [readiness, setReadiness] = useState<SolarMaintenanceReadiness | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadReadiness = async () => {
    setLoading(true);
    try {
      const data = await fetchSolarMaintenanceReadiness();
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
      {/* Top Status Header */}
      <Card className="rounded-3xl border border-rose-200/80 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-950 text-rose-300">
              <Factory className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-800">
                  Solar Manufacturing Domain
                </span>
                <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-xs font-mono">
                  NOT_TRAINED
                </Badge>
                <Badge className="bg-rose-950 text-rose-300 text-xs font-mono">
                  DATASET_BLOCKED
                </Badge>
              </div>
              <h3 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
                Solar PV Equipment Model Deployment Gate
              </h3>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                Production maintenance model training is blocked pending authentic factory edge IoT sensor ingestion.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadReadiness}
            disabled={loading}
            className="gap-2 rounded-xl border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 self-start sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Readiness Audit
          </Button>
        </div>

        {/* Database Inventory Metrics */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-slate-100 pt-6 text-xs">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <span className="text-slate-500 font-medium">IoT Telemetry Features</span>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {readiness?.tableCounts.telemetryReadings ?? 0}
            </p>
            <span className="text-xs text-rose-600 font-medium">
              pdm_telemetry_features rows
            </span>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <span className="text-slate-500 font-medium">Factory CMMS Work Orders</span>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {readiness?.tableCounts.cmmsWorkOrders ?? 0}
            </p>
            <span className="text-xs text-rose-600 font-medium">
              Maintenance work orders
            </span>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <span className="text-slate-500 font-medium">Verified Breakdown Events</span>
            <p className="text-2xl font-bold font-mono text-rose-700 mt-1">
              {readiness?.tableCounts.verifiedFailureEvents ?? 0}
            </p>
            <span className="text-xs text-rose-600 font-medium">
              Ground-truth failure logs (0)
            </span>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <span className="text-slate-500 font-medium">Eligible Training Runs</span>
            <p className="text-2xl font-bold font-mono text-rose-700 mt-1">
              {readiness?.tableCounts.eligibleTrainingTrajectories ?? 0}
            </p>
            <span className="text-xs text-rose-600 font-medium">
              Required: &gt;= 100 runs
            </span>
          </div>
        </div>

        {/* Blocking Reasons Callout */}
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/70 p-5">
          <div className="flex items-center gap-2 text-rose-900 font-bold text-xs uppercase tracking-wider font-mono">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            Audit Findings — Model Training Strictly Blocked:
          </div>
          <ul className="mt-3 space-y-2 text-xs text-rose-950">
            {readiness?.blockingReasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* Solar Assembly Equipment Sensor Audit */}
      <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Machine Telemetry Instrumentation
              </span>
              <Badge className="bg-slate-200 text-slate-800 text-xs font-mono">
                4 Critical Stations
              </Badge>
            </div>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              Photovoltaic Factory Equipment Audit
            </h3>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {SOLAR_EQUIPMENT_CATALOG.map((machine) => (
            <div
              key={machine.id}
              className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-slate-900">{machine.id}</span>
                  <h4 className="text-sm font-bold text-slate-900">{machine.name}</h4>
                </div>
                <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-xs font-mono">
                  UNINSTRUMENTED
                </Badge>
              </div>

              <div className="text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Subsystem:</p>
                <p className="text-slate-500">{machine.subsystem}</p>
              </div>

              <div className="text-xs space-y-1">
                <p className="font-semibold text-slate-700">Required IoT Sensor Channels:</p>
                <ul className="grid grid-cols-2 gap-1 text-xs text-slate-500">
                  {machine.criticalSensorTypes.map((sensor, sIdx) => (
                    <li key={sIdx} className="flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-slate-400" />
                      <span className="truncate">{sensor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 4 Prerequisites to Production Training */}
      <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-[#F2B941]" />
          Mandatory Pre-requisites for Solar Model 4 Training:
        </h4>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <span className="font-mono font-bold text-[#0B0909]">01. Edge Gateways</span>
            <p className="mt-1 text-slate-600 leading-relaxed">
              Install industrial OPC-UA/MQTT IoT gateways on Tabber cutter heads and Laminator vacuum pumps.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <span className="font-mono font-bold text-[#0B0909]">02. Continuous Logging</span>
            <p className="mt-1 text-slate-600 leading-relaxed">
              Ingest 1-minute aggregate vibration, current, and temperature features into pdm_telemetry_features.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <span className="font-mono font-bold text-[#0B0909]">03. CMMS Integration</span>
            <p className="mt-1 text-slate-600 leading-relaxed">
              Link factory maintenance work orders with confirmed physical failure mode labels in pdm_maintenance_logs.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <span className="font-mono font-bold text-[#0B0909]">04. Supervised Training</span>
            <p className="mt-1 text-slate-600 leading-relaxed">
              Execute cross-validated condition-based classification once at least 100 failure events are accumulated.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
