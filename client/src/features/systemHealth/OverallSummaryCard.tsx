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
import { Button } from "@/components/ui/button";
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
          <Badge className="bg-emerald-500/15 text-emerald-800 border-emerald-300 font-bold px-3 py-1 text-sm gap-1.5 shadow-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            OPERATIONAL — ALL PRIMARY SYSTEMS HEALTHY
          </Badge>
        );
      case "degraded":
        return (
          <Badge className="bg-amber-500/15 text-amber-800 border-amber-300 font-bold px-3 py-1 text-sm gap-1.5 shadow-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            DEGRADED — ONE OR MORE SUB-SERVICES AT RISK
          </Badge>
        );
      case "unavailable":
        return (
          <Badge className="bg-red-500/15 text-red-800 border-red-300 font-bold px-3 py-1 text-sm gap-1.5 shadow-sm">
            <XCircle className="h-4 w-4 text-red-600" />
            OUTAGE — PRIMARY SERVICES OFFLINE
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-200 text-slate-800 border-slate-300 font-bold px-3 py-1 text-sm gap-1.5">
            <Activity className="h-4 w-4 text-slate-500" />
            CHECKING SYSTEM STATUS...
          </Badge>
        );
    }
  };

  const sqliteDb = summary?.databases.find((d) => d.type === "sqlite");
  const isDbConnected = sqliteDb?.state === "connected";

  return (
    <Card className="border border-slate-200/80 bg-white shadow-sm overflow-hidden rounded-2xl">
      <div className="bg-[#0B0909] text-white px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 rounded-full bg-[#F2B941] shadow-[0_0_8px_rgba(242,185,65,0.8)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#F2B941]">
              Platform Health & Telemetry
            </p>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            SolarVision AI System Health
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time multi-model inference pipeline, authoritative SQLite database, and diagnostic event stream
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={onToggleAutoRefresh}
            className={cn(
              "h-9 px-3 text-xs font-semibold rounded-xl border gap-1.5 transition-colors",
              autoRefresh
                ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/50"
                : "bg-white/10 text-slate-300 border-white/20 hover:bg-white/20"
            )}
          >
            <Timer className="h-3.5 w-3.5" />
            {autoRefresh ? `Auto-Refresh (${autoRefreshIntervalSec}s)` : "Auto-Refresh Off"}
          </Button>

          <Button
            size="sm"
            onClick={onRefreshAll}
            disabled={isLoading}
            className="h-9 px-4 text-xs font-semibold rounded-xl bg-[#F2B941] text-[#0B0909] hover:bg-[#e0a937] shadow-sm gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            {isLoading ? "Refreshing..." : "Refresh All"}
          </Button>
        </div>
      </div>

      <div className="px-6 py-5 bg-[#FAFAF7] border-b border-slate-200/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            {getStatusBadge()}

            <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-3 py-1 rounded-xl border border-slate-200">
              <Database className="h-3.5 w-3.5 text-slate-500" />
              <span>Authoritative DB:</span>
              <span
                className={cn(
                  "font-bold",
                  isDbConnected ? "text-emerald-700" : "text-red-700"
                )}
              >
                {isDbConnected ? "SQLite Connected" : "Disconnected"}
              </span>
              {sqliteDb?.pingLatencyMs !== null && sqliteDb?.pingLatencyMs !== undefined && (
                <span className="text-[11px] text-slate-400">({sqliteDb.pingLatencyMs}ms)</span>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-medium text-slate-700">Last Telemetry Check:</span>
            <span>
              {summary?.lastRefreshed
                ? new Date(summary.lastRefreshed).toLocaleTimeString()
                : "Never"}
            </span>
          </div>
        </div>

        {/* Counter Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Healthy Services
              </p>
              <p className="text-2xl font-bold text-emerald-700 mt-0.5">
                {summary?.healthyCount ?? "—"}
              </p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Degraded
              </p>
              <p className="text-2xl font-bold text-amber-600 mt-0.5">
                {summary?.degradedCount ?? "—"}
              </p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Unavailable
              </p>
              <p className="text-2xl font-bold text-red-600 mt-0.5">
                {summary?.unavailableCount ?? "—"}
              </p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Not Configured
              </p>
              <p className="text-2xl font-bold text-slate-500 mt-0.5">
                {summary?.notConfiguredCount ?? "—"}
              </p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
              <Server className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

