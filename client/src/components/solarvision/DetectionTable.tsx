import React from "react";
import { DefectBadge } from "./DefectBadge";
import { getDefectMeta } from "@/lib/defects";
import { Crosshair, HelpCircle, Layers } from "lucide-react";

export interface DetectionItem {
  defect_type?: string;
  defectType?: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface DetectionTableProps {
  detections: DetectionItem[];
  emptyMessage?: string;
  highlightBoundary?: boolean;
}

export function DetectionTable({
  detections,
  emptyMessage = "No defects detected above the threshold.",
}: DetectionTableProps) {
  if (!detections || detections.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-xs">
        <thead>
          <tr className="border-b border-slate-100 text-[10px] uppercase tracking-[0.16em] text-slate-400">
            <th className="pb-3 font-semibold">Defect Type</th>
            <th className="pb-3 font-semibold">Severity</th>
            <th className="pb-3 font-semibold">Confidence</th>
            <th className="pb-3 font-semibold">Bounding Box Coordinates</th>
            <th className="pb-3 font-semibold">Box Dimensions</th>
            <th className="pb-3 font-semibold">Engine</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {detections.map((detection, index) => {
            const defectType = detection.defect_type || detection.defectType || "unknown";
            const meta = getDefectMeta(defectType);
            const conf = Number(detection.confidence);
            const x1 = Math.round(Number(detection.x1));
            const y1 = Math.round(Number(detection.y1));
            const x2 = Math.round(Number(detection.x2));
            const y2 = Math.round(Number(detection.y2));
            const width = Math.max(0, x2 - x1);
            const height = Math.max(0, y2 - y1);

            return (
              <tr key={`${defectType}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3.5 pr-3">
                  <DefectBadge defectType={defectType} size="sm" />
                </td>
                <td className="py-3.5 pr-3">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      meta.severity === "critical"
                        ? "bg-rose-100 text-rose-700"
                        : meta.severity === "high"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {meta.severity}
                  </span>
                </td>
                <td className="py-3.5 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.round(conf * 100))}%`,
                          backgroundColor: meta.color,
                        }}
                      />
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-700">
                      {(conf * 100).toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="py-3.5 pr-3 font-mono text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Crosshair className="h-3 w-3 text-slate-400" />
                    [{x1}, {y1}] → [{x2}, {y2}]
                  </span>
                </td>
                <td className="py-3.5 pr-3 font-mono text-[11px] text-slate-500">
                  {width} × {height} px
                </td>
                <td className="py-3.5">
                  <span className="inline-flex rounded-full bg-[#FFF3C4] px-2 py-0.5 text-[10px] font-semibold text-[#0B0909]">
                    YOLO26n
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
