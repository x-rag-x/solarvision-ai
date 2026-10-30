import React from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Timer,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SystemHealthSummary } from "./types";

interface OverallSummaryCardProps {
  summary: SystemHealthSummary | null;
  isLoading: boolean;
  onRefreshAll: () => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  autoRefreshIntervalSec?: number;
}

export function OverallSummaryCard({
  summary,
  isLoading,
  onRefreshAll,
  autoRefresh,
  onToggleAutoRefresh,
  autoRefreshIntervalSec = 10,
}: OverallSummaryCardProps) {
  const overallStatus = summary?.overallStatus || "unknown";

  const getStatusBadge = () => {
    switch (overallStatus) {
      case "healthy":
        return (
          <Badge className="bg-success-tint text-success border-success-border font-bold px-3 py-1 text-xs gap-1.5 shadow-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            OPERATIONAL — ALL PRIMARY SYSTEMS HEALTHY
          </Badge>
        );
      case "degraded":
        return (
          <Badge className="bg-warning-tint text-warning border-warning-border font-bold px-3 py-1 text-xs gap-1.5 shadow-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            DEGRADED — ONE OR MORE SUB-SERVICES AT RISK
          </Badge>
        );
      case "unavailable":
        return (
          <Badge className="bg-danger-tint text-danger border-danger-border font-bold px-3 py-1 text-xs gap-1.5 shadow-xs">
            <XCircle className="h-3.5 w-3.5 text-danger" />
            OUTAGE — PRIMARY SERVICES OFFLINE
          </Badge>
        );
      default:
        return (
          <Badge className="bg-surface-subtle text-text-3 border-border font-bold px-3 py-1 text-xs gap-1.5">
            <Activity className="h-3.5 w-3.5 text-text-3" />
            CHECKING SYSTEM STATUS...
          </Badge>
        );
    }
  };

  const sqliteDb = summary?.databases.find((d) => d.type === "sqlite");
  const isDbConnected = sqliteDb?.state === "connected";

  return (
    <Card className="border border-border bg-surface shadow-xs overflow-hidden rounded-2xl">
      <div className="bg-surface-subtle/70 px-6 py-4 border-b border-border flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2 w-2 rounded-full bg-primary" />
            <p className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Platform Status & Summary
            </p>
          </div>
          <h2 className="text-base font-bold tracking-tight text-text">
            SolarVision AI Service Matrix
          </h2>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {getStatusBadge()}
        </div>
      </div>

      <div className="px-6 py-5 bg-canvas/40 border-b border-border">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-text-3 bg-surface px-3 py-1.5 rounded-lg border border-border">
              <Database className="h-3.5 w-3.5 text-text-3" />
              <span>Authoritative DB:</span>
              <span
                className={cn(
                  "font-bold",
                  isDbConnected ? "text-success" : "text-danger"
                )}
              >
                {isDbConnected ? "SQLite Connected" : "Disconnected"}
              </span>
              {sqliteDb?.pingLatencyMs !== null && sqliteDb?.pingLatencyMs !== undefined && (
                <span className="text-xs text-text-3">({sqliteDb.pingLatencyMs}ms)</span>
              )}
            </div>
          </div>

          <div className="text-xs text-text-3 flex items-center gap-1.5">
            <span className="font-medium text-text">Last Telemetry Check:</span>
            <span>
              {summary?.lastRefreshed
                ? new Date(summary.lastRefreshed).toLocaleTimeString()
                : "Never"}
            </span>
          </div>
        </div>

        {/* Counter Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-surface rounded-xl border border-border p-3.5 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-3">
                Healthy Services
              </p>
              <p className="text-2xl font-bold text-success mt-1 tabular-nums">
                {summary?.healthyCount ?? "—"}
              </p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-success-tint text-success flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border p-3.5 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-3">
                Degraded
              </p>
              <p className="text-2xl font-bold text-warning mt-1 tabular-nums">
                {summary?.degradedCount ?? "—"}
              </p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-warning-tint text-warning flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border p-3.5 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-3">
                Unavailable
              </p>
              <p className="text-2xl font-bold text-danger mt-1 tabular-nums">
                {summary?.unavailableCount ?? "—"}
              </p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-danger-tint text-danger flex items-center justify-center">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border p-3.5 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-3">
                Not Configured
              </p>
              <p className="text-2xl font-bold text-text-3 mt-1 tabular-nums">
                {summary?.notConfiguredCount ?? "—"}
              </p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-surface-subtle text-text-3 flex items-center justify-center">
              <Server className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
