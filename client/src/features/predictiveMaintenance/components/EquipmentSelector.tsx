/**
 * SolarVision AI — Model 4: Equipment / Machine Selection Panel
 * 
 * Supports selecting between benchmark apparatus and production solar equipment.
 */

import React from "react";
import {
  Cpu,
  Factory,
  Layers,
  ShieldAlert,
  Sliders,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SOLAR_EQUIPMENT_CATALOG } from "../benchmarkData";
import type { SolarEquipmentItem } from "../types";

interface EquipmentSelectorProps {
  selectedEquipmentId: string;
  onSelectEquipment: (id: string, isSolarEquipment: boolean) => void;
}

export function EquipmentSelector({
  selectedEquipmentId,
  onSelectEquipment,
}: EquipmentSelectorProps) {
  const benchmarkApparatus = [
    {
      id: "AI4I-BENCHMARK-MILL-01",
      name: "AI4I Milling Machine #01",
      station: "Academic Benchmark CNC Cell",
      subsystem: "Milling Spindle & Cutter Head",
      status: "BENCHMARK_READY",
      domain: "Benchmark Apparatus",
    },
    {
      id: "AI4I-BENCHMARK-MILL-02",
      name: "AI4I Milling Machine #02 (Thermal Test)",
      station: "Academic Benchmark CNC Cell",
      subsystem: "Cooling & Thermal Dissipation Jacket",
      status: "BENCHMARK_READY",
      domain: "Benchmark Apparatus",
    },
    {
      id: "SYNTHETIC-STRESS-BENCH",
      name: "Synthetic High-Speed Test Bench",
      station: "Engineering Stress Laboratory",
      subsystem: "Variable-Frequency High-RPM Drive",
      status: "BENCHMARK_READY",
      domain: "Synthetic Stress Bench",
    },
  ];

  return (
    <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Station & Apparatus Selection
            </span>
            <Badge className="bg-[#0B0909] text-white text-[10px] font-mono">
              Equipment Matrix
            </Badge>
          </div>
          <h3 className="mt-1 text-base font-bold text-slate-900 sm:text-lg">
            Target Equipment & Subsystems
          </h3>
        </div>
      </div>

      {/* Benchmark Testing Stations */}
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          1. Supported Benchmark Test Stations (Ready for AI4I Evaluation):
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {benchmarkApparatus.map((item) => {
            const isSelected = selectedEquipmentId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectEquipment(item.id, false)}
                className={`flex flex-col rounded-2xl border p-4 text-left transition-all ${
                  isSelected
                    ? "border-[#0B0909] bg-[#0B0909] text-white shadow-md"
                    : "border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 hover:bg-slate-100/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider ${
                      isSelected ? "text-[#F2B941]" : "text-slate-500"
                    }`}
                  >
                    {item.domain}
                  </span>
                  <Badge
                    className={`text-[9px] font-mono ${
                      isSelected
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-emerald-100 text-emerald-800 border-emerald-300"
                    }`}
                  >
                    Active
                  </Badge>
                </div>
                <p className="mt-2 text-sm font-bold truncate">{item.name}</p>
                <p
                  className={`mt-1 text-xs truncate ${
                    isSelected ? "text-slate-300" : "text-slate-500"
                  }`}
                >
                  {item.subsystem}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Production Solar Factory Equipment (Quarantined) */}
      <div className="mt-6 border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-800">
            2. Production Solar PV Assembly Lines (Model Blocked / Not Trained):
          </p>
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] font-mono">
            Zero Factory Telemetry
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SOLAR_EQUIPMENT_CATALOG.map((item) => {
            const isSelected = selectedEquipmentId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectEquipment(item.id, true)}
                className={`flex flex-col rounded-2xl border p-4 text-left transition-all ${
                  isSelected
                    ? "border-rose-700 bg-rose-950 text-white shadow-md"
                    : "border-rose-200/80 bg-rose-50/40 text-slate-700 hover:border-rose-300 hover:bg-rose-50/80"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider ${
                      isSelected ? "text-rose-300" : "text-rose-700"
                    }`}
                  >
                    {item.id}
                  </span>
                  <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[9px] font-mono">
                    BLOCKED
                  </Badge>
                </div>
                <p className="mt-2 text-sm font-bold truncate">{item.name}</p>
                <p
                  className={`mt-1 text-[11px] truncate ${
                    isSelected ? "text-rose-200" : "text-slate-500"
                  }`}
                >
                  {item.subsystem}
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-[10px] text-rose-700">
                  <ShieldAlert className="h-3 w-3 shrink-0" />
                  <span>Requires IoT sensor install</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
