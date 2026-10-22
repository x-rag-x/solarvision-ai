/**
 * SolarVision AI — Phase 3: Manufacturing Context Section
 * 
 * Displays:
 * 1. Manufacturing Batch metadata (Wafer type, cell line, batch code, yield quantity)
 * 2. Machine & Tooling Status (Machine code, operational status, maintenance countdown)
 * 3. Sensor Observations & Telemetry (Values, units, baseline operating range, anomaly flags)
 */

import React, { useState } from "react";
import {
  Activity,
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  Flame,
  Gauge,
  Layers,
  Thermometer,
  Wrench,
} from "lucide-react";
import type {
  ManufacturingBatchData,
  ManufacturingMachineData,
  SensorObservationData,
} from "../types";

export interface ManufacturingContextSectionProps {
  batch: ManufacturingBatchData | null;
  machine: ManufacturingMachineData | null;
  sensors: SensorObservationData[];
}

export function ManufacturingContextSection({
  batch,
  machine,
  sensors,
}: ManufacturingContextSectionProps) {
  const [activeTab, setActiveTab] = useState<"all" | "sensors" | "machine" | "batch">("all");

  const hasAnyData = Boolean(batch || machine || sensors.length > 0);

  if (!hasAnyData) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center">
        <Database className="mx-auto h-8 w-8 text-slate-400 mb-2" />
        <h4 className="text-sm font-semibold text-slate-800">No Manufacturing Data Linked</h4>
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
          This inspection record currently has no MES batch records, machine IDs, or SCADA sensor
          telemetry attached in the database.
        </p>
      </div>
    );
  }

  const anomalySensors = sensors.filter((s) => s.isAnomaly);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      {/* Header and Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Process Telemetry & MES Context
          </span>
          <h3 className="text-sm font-bold text-slate-900">
            Manufacturing Line Observations
          </h3>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
          <button
            onClick={() => setActiveTab("all")}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              activeTab === "all"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("sensors")}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              activeTab === "sensors"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Sensors ({sensors.length})
          </button>
          <button
            onClick={() => setActiveTab("machine")}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              activeTab === "machine"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Machine
          </button>
          <button
            onClick={() => setActiveTab("batch")}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              activeTab === "batch"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Batch
          </button>
        </div>
      </div>

      {/* Overview or Batch Card */}
      {(activeTab === "all" || activeTab === "batch") && batch && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#F2B941]" />
              <span className="text-xs font-bold text-slate-800">
                Batch: {batch.batchNumber}
              </span>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                batch.status === "completed"
                  ? "bg-emerald-100 text-emerald-800"
                  : batch.status === "in_progress"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {batch.status.replace("_", " ")}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400">Wafer Substrate</p>
              <p className="font-semibold text-slate-800">{batch.waferType}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400">Production Line</p>
              <p className="font-semibold text-slate-800">{batch.cellLine}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400">Yield Progress</p>
              <p className="font-semibold text-slate-800">
                {batch.actualQuantity.toLocaleString()} / {batch.targetQuantity.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400">Ingot Lot</p>
              <p className="font-semibold text-slate-800 font-mono text-[11px]">
                {batch.ingotBatch || "Standard Lot"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Overview or Machine Card */}
      {(activeTab === "all" || activeTab === "machine") && machine && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-bold text-slate-800">
                Machine: {machine.machineCode} ({machine.machineType})
              </span>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                machine.status === "operational"
                  ? "bg-emerald-100 text-emerald-800"
                  : machine.status === "degraded"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-rose-100 text-rose-800"
              }`}
            >
              {machine.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400">Line Location</p>
              <p className="font-semibold text-slate-800">{machine.location || machine.lineId}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400">Operating Hours</p>
              <p className="font-semibold text-slate-800">{machine.operatingHours} hrs</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400">Last Serviced</p>
              <p className="font-semibold text-slate-800">
                {machine.lastMaintenanceAt
                  ? new Date(machine.lastMaintenanceAt).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400">Service Due</p>
              <p className="font-semibold text-slate-800">
                {machine.nextMaintenanceDue
                  ? new Date(machine.nextMaintenanceDue).toLocaleDateString()
                  : "Routine"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sensors Observations Section */}
      {(activeTab === "all" || activeTab === "sensors") && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-purple-500" />
              <span className="text-xs font-semibold text-slate-700">
                Real-Time Sensor Telemetry
              </span>
            </div>
            {anomalySensors.length > 0 && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                {anomalySensors.length} Anomaly Flag{anomalySensors.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {sensors.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">
              No real-time sensor recordings logged during this cell's fabrication window.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {sensors.map((sensor) => {
                const isOutOfRange =
                  sensor.isAnomaly ||
                  sensor.measurementValue < sensor.baselineMin ||
                  sensor.measurementValue > sensor.baselineMax;

                return (
                  <div
                    key={sensor.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      isOutOfRange
                        ? "border-rose-300 bg-rose-50/50"
                        : "border-slate-200 bg-slate-50/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {sensor.stage} • {sensor.sensorType}
                        </p>
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {sensor.sensorLabel}
                        </p>
                      </div>

                      {isOutOfRange ? (
                        <span className="rounded-md border border-rose-300 bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800 shrink-0 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 text-rose-600" />
                          Deviation
                        </span>
                      ) : (
                        <span className="rounded-md border border-emerald-300 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 shrink-0 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-emerald-600" />
                          Nominal
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex items-baseline justify-between border-t border-slate-200/60 pt-2">
                      <div>
                        <span className="text-base font-extrabold text-slate-900">
                          {sensor.measurementValue}
                        </span>
                        <span className="ml-1 text-xs text-slate-500">{sensor.unit}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Baseline: {sensor.baselineMin} – {sensor.baselineMax} {sensor.unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
