/**
 * SolarVision AI — Model 4: Maintenance Input Panel
 * 
 * Supports AI4I measurements, live physics validation, and clearly labeled presets.
 */

import React, { useMemo } from "react";
import {
  AlertCircle,
  Cpu,
  Flame,
  Gauge,
  HelpCircle,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Thermometer,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PRESET_MAINTENANCE_SAMPLES } from "../benchmarkData";
import { calculateDerivedPhysics } from "../api";
import type {
  MaintenanceInputMeasurements,
  PresetMaintenanceSample,
  ProductType,
} from "../types";

interface MaintenanceInputPanelProps {
  measurements: MaintenanceInputMeasurements;
  onChangeMeasurements: (updated: MaintenanceInputMeasurements) => void;
  onExecuteAssessment: () => void;
  loading: boolean;
  selectedPresetId: string | null;
  onSelectPreset: (preset: PresetMaintenanceSample) => void;
}

export function MaintenanceInputPanel({
  measurements,
  onChangeMeasurements,
  onExecuteAssessment,
  loading,
  selectedPresetId,
  onSelectPreset,
}: MaintenanceInputPanelProps) {
  // Compute live physics indicators in real-time
  const derived = useMemo(() => {
    try {
      return calculateDerivedPhysics(measurements);
    } catch {
      return null;
    }
  }, [measurements]);

  const handleChangeField = (
    field: keyof MaintenanceInputMeasurements,
    value: any
  ) => {
    onChangeMeasurements({
      ...measurements,
      [field]: value,
    });
  };

  return (
    <Card className="rounded-xl border border-border bg-surface p-6 shadow-xs sm:p-7">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Operating Telemetry Input
            </span>
            <Badge className="bg-sapphire text-white text-xs font-mono">
              6 Physical Features
            </Badge>
          </div>
          <h3 className="mt-1 text-base font-bold text-sapphire sm:text-lg">
            AI4I 2020 Operational Measurements
          </h3>
        </div>

        <div className="text-xs text-text-3 font-mono">
          Product Variant: <span className="font-bold text-text">{measurements.productType}-Type</span>
        </div>
      </div>

      {/* Preset Buttons */}
      <div className="mt-6 border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-3 mb-3">
          Select Academic Evaluation Preset:
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRESET_MAINTENANCE_SAMPLES.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset)}
                className={`flex flex-col rounded-xl border p-3.5 text-left transition-all ${
                  isSelected
                    ? "border-[#965660] bg-[#965660] text-white shadow-xs"
                    : "border-border bg-surface-subtle text-text hover:border-[#965660]/40 hover:bg-surface"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Badge
                    className={`text-xs font-mono uppercase ${
                      preset.sourceCategory === "authentic_benchmark_record"
                        ? isSelected
                          ? "bg-white/20 text-white border-white/30"
                          : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : isSelected
                        ? "bg-white/20 text-white border-white/30"
                        : "bg-warning-tint text-warning border-warning-border"
                    }`}
                  >
                    {preset.sourceCategory === "authentic_benchmark_record"
                      ? "AI4I Record"
                      : "Synthetic Stress"}
                  </Badge>
                  <span
                    className={`text-xs font-bold ${
                      preset.expectedClassification === "FAILURE"
                        ? isSelected ? "text-rose-200" : "text-rose-600"
                        : isSelected ? "text-emerald-200" : "text-emerald-600"
                    }`}
                  >
                    {preset.targetLabel || (preset.expectedClassification === "FAILURE" ? "Machine Failure" : "Normal Operation")}
                  </span>
                </div>
                <p className="mt-2 text-xs font-bold truncate">{preset.name}</p>
                <p
                  className={`mt-1 text-xs leading-relaxed line-clamp-2 ${
                    isSelected ? "text-white/80" : "text-text-3"
                  }`}
                >
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Input Fields Grid */}
      <div className="mt-6 border-t border-border pt-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Product Type Variant */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-2">
              Product Variant / Quality Class
            </label>
            <div className="flex rounded-lg border border-border bg-surface-subtle p-1">
              {(["L", "M", "H"] as ProductType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleChangeField("productType", type)}
                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                    measurements.productType === type
                      ? "bg-[#965660] text-white shadow-xs"
                      : "text-text-2 hover:text-text"
                  }`}
                >
                  {type} ({type === "L" ? "Low 50%" : type === "M" ? "Med 30%" : "High 20%"})
                </button>
              ))}
            </div>
            <p className="text-xs text-text-3">
              Determines tool wear threshold (L: 240m, M: 215m, H: 180m).
            </p>
          </div>

          {/* Air Temperature */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Thermometer className="h-3.5 w-3.5 text-blue-500" />
                Air Temperature [K]
              </label>
              <span className="text-xs text-slate-400 font-mono">
                {(Number(measurements.airTemperatureK) - 273.15).toFixed(1)} °C
              </span>
            </div>
            <Input
              type="number"
              step="0.1"
              min="290"
              max="320"
              value={measurements.airTemperatureK}
              onChange={(e) => handleChangeField("airTemperatureK", parseFloat(e.target.value) || 0)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-slate-400">Plausible range: 290.0 K – 320.0 K</p>
          </div>

          {/* Process Temperature */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Flame className="h-3.5 w-3.5 text-rose-500" />
                Process Temperature [K]
              </label>
              <span className="text-xs text-slate-400 font-mono">
                {(Number(measurements.processTemperatureK) - 273.15).toFixed(1)} °C
              </span>
            </div>
            <Input
              type="number"
              step="0.1"
              min="295"
              max="330"
              value={measurements.processTemperatureK}
              onChange={(e) => handleChangeField("processTemperatureK", parseFloat(e.target.value) || 0)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-slate-400">Plausible range: 295.0 K – 330.0 K</p>
          </div>

          {/* Rotational Speed */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Gauge className="h-3.5 w-3.5 text-amber-500" />
              Rotational Speed [rpm]
            </label>
            <Input
              type="number"
              step="1"
              min="500"
              max="3500"
              value={measurements.rotationalSpeedRpm}
              onChange={(e) => handleChangeField("rotationalSpeedRpm", parseInt(e.target.value, 10) || 0)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-slate-400">Normal operating range: 1100 – 2900 rpm</p>
          </div>

          {/* Torque */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Zap className="h-3.5 w-3.5 text-amber-600" />
              Drive Torque [Nm]
            </label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              max="120"
              value={measurements.torqueNm}
              onChange={(e) => handleChangeField("torqueNm", parseFloat(e.target.value) || 0)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-slate-400">Normal operating range: 10.0 – 80.0 Nm</p>
          </div>

          {/* Tool Wear */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Layers className="h-3.5 w-3.5 text-indigo-500" />
              Tool Wear [min]
            </label>
            <Input
              type="number"
              step="1"
              min="0"
              max="400"
              value={measurements.toolWearMin}
              onChange={(e) => handleChangeField("toolWearMin", parseInt(e.target.value, 10) || 0)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-slate-400">Cumulative cutting duration in minutes</p>
          </div>
        </div>
      </div>

      {/* Live Physical State Card (Derived Parameters) */}
      {derived && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Real-Time Physical Indicators (AI4I Operating Envelope):
          </p>
          <div className="grid gap-3 sm:grid-cols-4 text-xs">
            {/* Mechanical Power */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-3">
              <p className="text-slate-400 text-xs">Mechanical Power</p>
              <p className="font-mono font-bold text-slate-900 mt-0.5">
                {derived.powerWatts.toLocaleString()} W
              </p>
              <span
                className={`mt-1 inline-block text-xs font-semibold ${
                  derived.isPowerAbnormal ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {derived.isPowerAbnormal ? "⚠ Power Anomaly (<3.5kW or >9kW)" : "✓ Normal Power [3.5–9kW]"}
              </span>
            </div>

            {/* Thermal Delta */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-3">
              <p className="text-slate-400 text-xs">Thermal Delta (ΔT)</p>
              <p className="font-mono font-bold text-slate-900 mt-0.5">
                {derived.deltaTemperatureK.toFixed(2)} K
              </p>
              <span
                className={`mt-1 inline-block text-xs font-semibold ${
                  derived.isDeltaTAbnormal ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {derived.isDeltaTAbnormal ? "⚠ Heat Dissipation Anomaly" : "✓ Adequate Dissipation"}
              </span>
            </div>

            {/* Overstrain Product */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-3">
              <p className="text-slate-400 text-xs">Overstrain Product</p>
              <p className="font-mono font-bold text-slate-900 mt-0.5">
                {derived.overstrainProductNmMin.toLocaleString()} Nm·min
              </p>
              <span
                className={`mt-1 inline-block text-xs font-semibold ${
                  derived.isOverstrainAbnormal ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {derived.isOverstrainAbnormal ? "⚠ Overstrain Limit Exceeded" : "✓ Normal Structural Load"}
              </span>
            </div>

            {/* Tool Wear Status */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-3">
              <p className="text-slate-400 text-xs">Tool Wear Limit</p>
              <p className="font-mono font-bold text-slate-900 mt-0.5">
                {measurements.toolWearMin} / {measurements.productType === "H" ? 180 : measurements.productType === "M" ? 215 : 240} min
              </p>
              <span
                className={`mt-1 inline-block text-xs font-semibold ${
                  derived.isToolWearAbnormal ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {derived.isToolWearAbnormal ? "⚠ Tool Replacement Due" : "✓ Usable Tool Life"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          onClick={onExecuteAssessment}
          disabled={loading}
          className="h-10 gap-2 rounded-lg bg-[#965660] px-6 text-xs font-semibold text-white shadow-xs hover:bg-[#7E454E] transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              Classifying Operating Condition...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 text-white" />
              Evaluate Operating Condition Failure Risk
            </>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={() => onSelectPreset(PRESET_MAINTENANCE_SAMPLES[0])}
          disabled={loading}
          className="h-10 gap-2 rounded-lg border-border text-xs font-semibold text-text hover:bg-surface-subtle"
        >
          <RotateCcw className="h-3.5 w-3.5 text-text-3" />
          Reset to Nominal Sample
        </Button>
      </div>
    </Card>
  );
}
