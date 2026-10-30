/**
 * SolarVision AI — Model 4: Equipment / Machine Selection Panel
 * 
 * Supports selecting between benchmark demonstration configurations.
 */

import React from "react";
import { Cpu, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface EquipmentSelectorProps {
  selectedEquipmentId: string;
  onSelectEquipment: (id: string, isSolarEquipment?: boolean) => void;
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
    <Card className="rounded-2xl border border-border bg-surface p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border-subtle pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Station & Apparatus Selection
            </span>
            <Badge className="bg-ink text-surface text-xs font-mono">
              AI4I Configurations
            </Badge>
          </div>
          <h3 className="mt-1 text-base font-bold text-text">
            AI4I Predictive Maintenance — Benchmark Demonstrations
          </h3>
        </div>
      </div>

      {/* Professional Compact Disclaimer */}
      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-subtle p-3 text-xs text-text-2 leading-relaxed">
        <Info className="h-4 w-4 shrink-0 text-text-3 mt-0.5" />
        <p>
          Model 4 is trained and evaluated using the AI4I 2020 manufacturing benchmark. These are simulated equipment scenarios, not connected physical machines. Solar factory deployment requires real telemetry and independent validation.
        </p>
      </div>

      {/* Three Benchmark Demonstration Configurations */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        {benchmarkApparatus.map((item) => {
          const isSelected = selectedEquipmentId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectEquipment(item.id, false)}
              className={`flex flex-col rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? "border-ink bg-ink text-surface shadow-xs ring-1 ring-ink"
                  : "border-border bg-surface-subtle/50 text-text hover:border-border-strong hover:bg-surface-subtle"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    isSelected ? "text-brand" : "text-text-3"
                  }`}
                >
                  {item.domain}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium font-mono ${
                    isSelected
                      ? "bg-surface/20 text-surface border border-surface/30"
                      : "bg-success-tint text-success border border-success/30"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isSelected ? "bg-brand" : "bg-success"
                    }`}
                  />
                  Active
                </span>
              </div>
              <p className="mt-2.5 text-sm font-bold truncate">{item.name}</p>
              <p
                className={`mt-1 text-xs truncate ${
                  isSelected ? "text-surface/70" : "text-text-3"
                }`}
              >
                {item.subsystem}
              </p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
