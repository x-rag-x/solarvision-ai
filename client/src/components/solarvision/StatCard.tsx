import React from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StatCardProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  caption?: string;
  source?: string;
  isUnknown?: boolean;
  unknownReason?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "warning" | "danger" | "brand";
  className?: string;
}

export function StatCard({
  label,
  value,
  unit,
  caption,
  source,
  isUnknown = false,
  unknownReason = "Requires authenticated operator session",
  icon: Icon,
  tone = "default",
  className = "",
}: StatCardProps) {
  const showUnknown = isUnknown || value === null || value === undefined;

  return (
    <div
      className={`relative rounded-xl border border-border bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border-strong/40 ${className}`}
    >
      <div className="flex items-center justify-between text-xs text-text-3 mb-2">
        <span className="font-medium truncate">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-text-3 shrink-0" />}
      </div>

      <div className="flex items-baseline gap-1.5">
        {showUnknown ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-2xl sm:text-3xl font-semibold text-text-3 cursor-help">
                —
              </span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">{unknownReason}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="font-mono text-2xl sm:text-3xl font-semibold text-text tabular-nums tracking-tight">
            {value}
          </span>
        )}

        {unit && !showUnknown && (
          <span className="font-mono text-xs text-text-3 font-medium">{unit}</span>
        )}
      </div>

      {(caption || source) && (
        <div className="mt-2.5 flex items-center justify-between text-xs text-text-3 border-t border-border/60 pt-2">
          {caption && <span className="truncate">{caption}</span>}
          {source && (
            <span
              className="ml-auto font-mono text-xs text-text-3 shrink-0"
              title={`Source: ${source}`}
            >
              {source}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default StatCard;
