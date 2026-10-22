import React from "react";
import { AlertCircle, ShieldAlert, Sparkles } from "lucide-react";
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
      <div className={`rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-900 dark:text-amber-200 ${className}`}>
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              AI Detection Risk Note ({detectionsCount} defect{detectionsCount === 1 ? "" : "s"} identified)
            </p>
            <p className="leading-relaxed opacity-90">
              YOLO bounding boxes reflect statistical confidence scores above the configured threshold ({threshold.toFixed(2)}).
              Confidence represents pattern matching similarity, not physical damage depth or severity.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-sky-200 bg-sky-50/70 p-5 dark:border-sky-900/50 dark:bg-sky-950/20 ${className}`}>
      <div className="flex items-start gap-3.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-sky-900 dark:text-sky-200">
              Zero Detections Above Threshold ({threshold.toFixed(2)})
            </h4>
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-900/60 dark:text-sky-300">
              Threshold: {threshold.toFixed(2)}
            </span>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-sky-800/90 dark:text-sky-300/90">
            <strong>Important Quality Notice:</strong> No defect patterns met or exceeded the confidence threshold of{" "}
            <span className="font-mono font-semibold">{threshold.toFixed(2)}</span>.
            In manufacturing PV quality inspection, <em>zero detections does not certify the cell as defect-free</em>.
            Faint micro-cracks, hairline fractures, or low-contrast shunts below this cutoff may still be present.
          </p>

          {threshold > 0.10 && onRetryWithHighSensitivity && (
            <div className="mt-4 flex flex-wrap items-center gap-3 pt-3 border-t border-sky-200/60 dark:border-sky-900/40">
              <span className="text-xs text-sky-700 dark:text-sky-400">
                Suspect faint micro-cracks or hairline fractures?
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={onRetryWithHighSensitivity}
                className="h-8 gap-1.5 border-sky-300 bg-white text-xs font-semibold text-sky-900 shadow-sm hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-900 dark:text-sky-100"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Re-inspect at High Sensitivity (0.10)
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
