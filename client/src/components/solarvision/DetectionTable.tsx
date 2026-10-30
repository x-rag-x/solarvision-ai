import React from "react";
import { DefectBadge } from "./DefectBadge";
import { getDefectMeta } from "@/lib/defects";
import { Crosshair } from "lucide-react";

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
  highlightedIndex?: number | null;
  onHighlightIndex?: (index: number | null) => void;
}

export function DetectionTable({
  detections,
  emptyMessage = "No defects detected above the threshold.",
  highlightedIndex = null,
  onHighlightIndex,
}: DetectionTableProps) {
  if (!detections || detections.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-subtle p-6 text-center text-xs text-text-3">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="border-b border-border bg-surface-subtle text-xs text-text-3 font-semibold">
          <tr>
            <th className="py-2.5 px-3.5">Defect Class</th>
            <th className="py-2.5 px-3">Severity</th>
            <th className="py-2.5 px-3">Confidence</th>
            <th className="py-2.5 px-3">Bounding Box</th>
            <th className="py-2.5 px-3">Dimensions</th>
            <th className="py-2.5 px-3 text-right">Model Engine</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
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
            const isHighlighted = highlightedIndex === index;

            return (
              <tr
                key={`${defectType}-${index}`}
                onMouseEnter={() => onHighlightIndex?.(index)}
                onMouseLeave={() => onHighlightIndex?.(null)}
                className={`transition-colors cursor-pointer ${
                  isHighlighted ? "bg-brand-tint/40 font-medium" : "hover:bg-surface-subtle"
                }`}
              >
                <td className="py-2.5 px-3.5">
                  <DefectBadge defectType={defectType} size="sm" />
                </td>
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-semibold capitalize ${
                      meta.severity === "critical"
                        ? "bg-danger-tint text-danger border border-danger/20"
                        : meta.severity === "high"
                        ? "bg-warning-tint text-brand-text border border-warning/20"
                        : "bg-surface-subtle text-text-2 border border-border"
                    }`}
                  >
                    {meta.severity}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1.5 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.round(conf * 100))}%`,
                          backgroundColor: meta.color,
                        }}
                      />
                    </div>
                    <span className="font-mono text-xs font-semibold text-text tabular-nums">
                      {(conf * 100).toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-3 font-mono text-xs text-text-3 tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <Crosshair className="h-3 w-3 text-text-3" />
                    [{x1}, {y1}] → [{x2}, {y2}]
                  </span>
                </td>
                <td className="py-2.5 px-3 font-mono text-xs text-text-3 tabular-nums">
                  {width} × {height} px
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className="inline-flex rounded bg-surface-subtle border border-border px-1.5 py-0.5 font-mono text-xs text-text-3">
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

export default DetectionTable;
