/**
 * SolarVision AI — Phase 3: Selected Inspection & Defect Panel
 * 
 * Displays:
 * - Selected inspection identifiers and timestamp
 * - Cell image preview (Annotated vs Original)
 * - Defect summary and full detection list with SolarVision defect classes
 */

import React, { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Layers,
  Maximize2,
  ScanLine,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDefectMeta } from "@/lib/defects";
import type { InspectionContext } from "../types";

export interface SelectedInspectionPanelProps {
  inspection: InspectionContext | null;
  onClearSelection?: () => void;
  onOpenImageModal?: (imageUrl: string) => void;
}

export function SelectedInspectionPanel({
  inspection,
  onClearSelection,
  onOpenImageModal,
}: SelectedInspectionPanelProps) {
  const [viewMode, setViewMode] = useState<"annotated" | "original">("annotated");
  const [copied, setCopied] = useState(false);

  if (!inspection) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
          <ScanLine className="h-6 w-6" />
        </div>
        <h4 className="mt-3 text-sm font-semibold text-slate-800">
          No Solar Cell Inspection Selected
        </h4>
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
          Select an inspection record from the history table or upload a new wafer scan to
          correlate physical defects with manufacturing root causes.
        </p>
      </div>
    );
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(inspection.inspectionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeImageUrl =
    viewMode === "annotated"
      ? inspection.annotatedImageUrl || inspection.inputImageUrl
      : inspection.inputImageUrl || inspection.annotatedImageUrl;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      {/* Header with ID and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Active Inspection Record
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-xs font-bold text-slate-900 truncate max-w-[220px]">
              {inspection.inspectionId}
            </span>
            <button
              onClick={handleCopyId}
              className="text-slate-400 hover:text-slate-700 transition-colors"
              title="Copy Inspection ID"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            {copied && (
              <span className="text-[10px] text-[#087e6d] font-semibold">Copied!</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            <FileSpreadsheet className="h-3 w-3 text-slate-400" />
            {inspection.sourceFilename}
          </span>
          {onClearSelection && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="h-7 text-xs text-slate-500 hover:text-slate-800"
            >
              Change
            </Button>
          )}
        </div>
      </div>

      {/* Image Preview & View Toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">Electroluminescence Scan</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
            <button
              onClick={() => setViewMode("annotated")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                viewMode === "annotated"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Annotated
            </button>
            <button
              onClick={() => setViewMode("original")}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                viewMode === "original"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Raw Grayscale
            </button>
          </div>
        </div>

        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950 flex items-center justify-center">
          {activeImageUrl ? (
            <img
              src={activeImageUrl}
              alt="Solar Cell EL Scan"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="text-center p-4">
              <ScanLine className="mx-auto h-8 w-8 text-slate-600 mb-2 animate-pulse" />
              <p className="text-xs text-slate-400">Image artifact stored securely</p>
            </div>
          )}

          {activeImageUrl && onOpenImageModal && (
            <button
              onClick={() => onOpenImageModal(activeImageUrl)}
              className="absolute bottom-2 right-2 rounded-lg bg-black/60 p-1.5 text-white backdrop-blur hover:bg-black/80 transition-colors"
              title="Expand view"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Detected Defect Classes from Model 1 */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">
            Detected Defect Classes (Model 1)
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
            {inspection.detectionsCount} Anomali{inspection.detectionsCount === 1 ? "es" : "es"}
          </span>
        </div>

        {inspection.detections.length === 0 ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-center">
            <CheckCircle2 className="mx-auto h-5 w-5 text-[#087e6d] mb-1" />
            <p className="text-xs font-semibold text-slate-700">Zero Surface Defects Detected</p>
            <p className="text-[11px] text-slate-500">
              Solar cell is nominal. Root cause analysis is only required when anomalies are present.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {inspection.detections.map((det, idx) => {
              const meta = getDefectMeta(det.defectType);
              const confPct = Math.round(det.confidence * 100);

              return (
                <div
                  key={`${det.id}-${idx}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 transition-colors hover:bg-slate-100"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {meta.label}
                      </p>
                      <p className="text-[10px] text-slate-500 capitalize">
                        {meta.category} • BBox: [{Math.round(det.x1)}, {Math.round(det.y1)}] to [{Math.round(det.x2)}, {Math.round(det.y2)}]
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${meta.badgeBg} ${meta.badgeBorder} ${meta.badgeText}`}
                    >
                      {confPct}% conf
                    </span>
                    <span className="rounded bg-slate-200 px-1 py-0.5 text-[9px] uppercase font-bold text-slate-700">
                      {meta.severity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
