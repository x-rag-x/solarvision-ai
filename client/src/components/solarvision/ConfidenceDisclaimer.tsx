import React from "react";
import { AlertCircle, ShieldAlert, Sparkles, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfidenceDisclaimerProps {
  threshold: number;
  detectionsCount: number;
  onRetryWithHighSensitivity?: () => void;
  className?: string;
}

export function ConfidenceDisclaimer({
  threshold,
  detectionsCount,
  onRetryWithHighSensitivity,
  className = "",
}: ConfidenceDisclaimerProps) {
  if (detectionsCount > 0) {
    return (
      <div
        className={`rounded-xl border border-warning/30 bg-warning-tint/50 p-3.5 text-xs text-text ${className}`}
      >
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-brand-text">
              Academic Prototype — Statistical Bounding ({detectionsCount} defect{detectionsCount === 1 ? "" : "s"} identified)
            </p>
            <p className="leading-relaxed text-text-2 text-xs">
              YOLO bounding boxes reflect statistical pattern similarity above cutoff ({threshold.toFixed(2)}).
              Confidence denotes visual pattern correlation, not physical cell micro-structural depth.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-info/30 bg-info-tint/40 p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-info-tint text-info border border-info/30">
          <Info className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-text">
              Zero Detections Above Cutoff ({threshold.toFixed(2)})
            </h4>
            <span className="rounded-md border border-info/20 bg-surface px-2 py-0.5 font-mono text-xs text-text-3">
              Cutoff: {threshold.toFixed(2)}
            </span>
          </div>

          <p className="text-xs leading-relaxed text-text-2">
            <strong>Mandatory Invariant:</strong> No defect features met or exceeded the confidence cutoff of{" "}
            <span className="font-mono font-semibold">{threshold.toFixed(2)}</span>.
            In industrial photovoltaic quality operations, <em>zero detections does not certify the cell as defect-free</em>.
            Hairline fractures or low-contrast shunts below this threshold may still be present.
          </p>

          {threshold > 0.10 && onRetryWithHighSensitivity && (
            <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-info/20">
              <span className="text-xs text-text-3">
                Suspect faint hairline micro-fractures?
              </span>
              <button
                type="button"
                onClick={onRetryWithHighSensitivity}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-text hover:bg-surface-subtle transition-colors shadow-xs"
              >
                <Sparkles className="h-3 w-3 text-brand-text" />
                <span>Re-inspect at High Sensitivity (0.10)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConfidenceDisclaimer;
