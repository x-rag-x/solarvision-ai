import React from "react";
import { getDefectMeta } from "@/lib/defects";
import { cn } from "@/lib/utils";

interface DefectBadgeProps {
  defectType: string;
  confidence?: number;
  showConfidence?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function DefectBadge({
  defectType,
  confidence,
  showConfidence = false,
  className,
  size = "md",
}: DefectBadgeProps) {
  const meta = getDefectMeta(defectType);

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-full border transition-colors",
        meta.badgeBg,
        meta.badgeBorder,
        meta.badgeText,
        sizeClasses[size],
        className
      )}
      title={`${meta.label}: ${meta.description}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: meta.color }}
      />
      <span>{meta.label}</span>
      {showConfidence && confidence != null && (
        <span className="font-mono opacity-80 pl-1 border-l border-current/20">
          {(confidence * 100).toFixed(1)}%
        </span>
      )}
    </span>
  );
}
