import React, { useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, ChevronDown, ChevronUp } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type NoticeTone = "info" | "warning" | "danger" | "success";

interface NoticeBarProps {
  tone?: NoticeTone;
  message: React.ReactNode;
  details?: React.ReactNode;
  detailsTitle?: string;
  action?: React.ReactNode;
  className?: string;
}

const toneStyles: Record<NoticeTone, { container: string; icon: typeof Info; text: string }> = {
  info: {
    container: "border-[#B5BCDA]/60 bg-[#E8EBF5] text-text",
    icon: Info,
    text: "text-sapphire",
  },
  warning: {
    container: "border-warning-border bg-warning-tint text-text",
    icon: AlertTriangle,
    text: "text-warning",
  },
  danger: {
    container: "border-danger-border bg-danger-tint text-text",
    icon: AlertCircle,
    text: "text-danger",
  },
  success: {
    container: "border-success-border bg-success-tint text-text",
    icon: CheckCircle2,
    text: "text-success",
  },
};

export function NoticeBar({
  tone = "info",
  message,
  details,
  detailsTitle = "Scientific & Methodological Context",
  action,
  className = "",
}: NoticeBarProps) {
  const { container, icon: Icon, text } = toneStyles[tone] || toneStyles.info;

  return (
    <div
      role="region"
      aria-label="System notice"
      className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs transition-colors ${container} ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className={`h-4 w-4 shrink-0 ${text}`} />
        <div className="truncate font-medium text-text">{message}</div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {action}
        {details && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="rounded-md px-2 py-0.5 text-xs font-semibold text-sapphire underline underline-offset-2 hover:bg-surface/50 transition-colors"
                aria-label="View methodology details"
              >
                Details
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-80 sm:w-96 rounded-xl border border-border bg-surface p-4 shadow-xl"
            >
              <h4 className="text-xs font-semibold text-sapphire mb-1.5 flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${text}`} />
                {detailsTitle}
              </h4>
              <div className="text-xs leading-relaxed text-text-2 space-y-2">
                {details}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

export default NoticeBar;
