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
      className={`relative flex flex-col justify-between rounded-xl border border-border bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-[#2F3A58]/30 hover:shadow-sm ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-3 truncate">
            {label}
          </span>
          {Icon && (
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-subtle text-sapphire border border-border/70 shadow-2xs">
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-2 my-1">
          {showUnknown ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-mono text-3xl sm:text-4xl font-semibold text-text-3/60 cursor-help select-none">
                  —
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-xs">{unknownReason}</TooltipContent>
            </Tooltip>
          ) : (
            <span className="font-mono text-3xl sm:text-4xl font-bold text-sapphire tabular-nums tracking-tight">
              {value}
            </span>
          )}

          {unit && !showUnknown && (
            <span className="font-mono text-xs font-semibold text-text-3">{unit}</span>
          )}
        </div>
      </div>

      {(caption || source) && (
        <div className="mt-3 flex items-center justify-between text-xs text-text-3 border-t border-border/70 pt-2.5">
          {caption && <span className="truncate text-text-2 font-medium">{caption}</span>}
          {source && (
            <span
              className="ml-auto font-mono text-[11px] text-text-3 shrink-0"
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
