import React from "react";
import { ArrowUpRight, Database, Info, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end border-b border-border pb-5">
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-3">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-xs sm:text-sm leading-relaxed text-text-2">
          {description}
        </p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: "success" | "warning" | "neutral" | "danger";
  children: React.ReactNode;
}) {
  const styles = {
    success: "border-success/30 bg-success-tint text-success",
    warning: "border-warning/30 bg-warning-tint text-warning",
    neutral: "border-border bg-surface-subtle text-text-2",
    danger: "border-danger/30 bg-danger-tint text-danger",
  };

  const dots = {
    success: "bg-success",
    warning: "bg-warning",
    neutral: "bg-text-3",
    danger: "bg-danger",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        styles[tone]
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} />
      <span>{children}</span>
    </span>
  );
}

export function EmptyData({
  title = "No data available",
  description = "Connect the persistence layer and complete an inspection to populate this view.",
  compact = false,
}: {
  title?: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 text-center",
        compact ? "min-h-[160px] p-6" : "min-h-[260px] p-8"
      )}
    >
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-surface-subtle text-text-3 border border-border">
        <Database className="h-5 w-5 text-text-2" />
      </div>
      <p className="text-xs sm:text-sm font-semibold text-text">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-text-3">{description}</p>
    </div>
  );
}

export function DataSourceNote({ configured }: { configured: boolean }) {
  if (configured) {
    return (
      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-border bg-surface-subtle px-3.5 py-2.5 text-xs text-text-2 leading-relaxed">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-3" />
        <p>Live persistence verified. Metrics below reflect stored production inspection records.</p>
      </div>
    );
  }

  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-tint/50 px-3.5 py-2.5 text-xs text-text-2 leading-relaxed">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <p>Sign-in required to query persistent inspection metrics. Zero-fabrication guarantees unauthenticated metrics remain undisclosed.</p>
    </div>
  );
}
