import React from "react";
import { AlertCircle, RotateCcw, Database, FolderOpen, Inbox } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = "No Records Available",
  description = "No data points matching your current criteria or filter parameters were found in the database.",
  icon: Icon = Inbox,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center ${className}`}
    >
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-surface-subtle text-text-3 border border-border">
        <Icon className="h-5 w-5 text-text-2" />
      </div>
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-text-3 leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Inspection Engine Error",
  message = "An unexpected error occurred while communicating with the inference pipeline or retrieving records.",
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      className={`rounded-2xl border border-danger/25 bg-danger-tint/30 p-6 sm:p-8 text-center space-y-3 ${className}`}
    >
      <div className="grid h-11 w-11 mx-auto place-items-center rounded-xl bg-danger-tint text-danger border border-danger/30">
        <AlertCircle className="h-5 w-5" />
      </div>
      <div className="max-w-md mx-auto space-y-1">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <p className="text-xs text-text-2 leading-relaxed">{message}</p>
      </div>
      {onRetry && (
        <div className="pt-2">
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-text hover:bg-surface-subtle transition-colors shadow-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Retry Operation</span>
          </button>
        </div>
      )}
    </div>
  );
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-subtle border border-border/40 ${className}`}
    />
  );
}
