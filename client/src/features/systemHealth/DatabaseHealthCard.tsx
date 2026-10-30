import React, { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CloudOff,
  Database,
  HardDrive,
  Table,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { DatabaseHealthInfo } from "./types";

interface DatabaseHealthCardProps {
  databases: DatabaseHealthInfo[];
}

export function DatabaseHealthCard({ databases }: DatabaseHealthCardProps) {
  const [expandedTables, setExpandedTables] = useState(false);

  const sqliteDb = databases.find((d) => d.type === "sqlite");
  const remoteDb = databases.find((d) => d.type === "supabase" || d.name.toLowerCase().includes("remote"));

  return (
    <Card className="border border-border bg-surface shadow-xs overflow-hidden rounded-2xl">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-surface-elevated/70">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-success-soft text-success flex items-center justify-center">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text tracking-tight">
              Database Connectivity & Table Telemetry
            </h2>
            <p className="text-xs text-text-muted">
              Direct verification of database connections, read-only ping latency, and model persistence tables
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Authoritative SQLite Database Card */}
        {sqliteDb && (
          <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-9 w-9 rounded-xl bg-success-soft text-success flex items-center justify-center shrink-0">
                  <HardDrive className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-text">{sqliteDb.name}</span>
                    <Badge className="bg-surface-elevated text-text-muted border-border text-xs font-semibold">
                      SQLite 3 (WAL Mode)
                    </Badge>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    Path: <code className="font-mono text-text text-xs">{sqliteDb.details?.path || "data/solarvision.db"}</code>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                {sqliteDb.state === "connected" ? (
                  <Badge className="bg-success-soft text-success border-success-border font-semibold gap-1 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    CONNECTED (SELECT 1: {sqliteDb.pingLatencyMs}ms)
                  </Badge>
                ) : (
                  <Badge className="bg-danger-soft text-danger border-danger-border font-semibold gap-1 text-xs">
                    <XCircle className="h-3.5 w-3.5 text-danger" />
                    DISCONNECTED
                  </Badge>
                )}
              </div>
            </div>

            {sqliteDb.errorMessage && (
              <div className="mt-3 p-3 rounded-lg bg-danger-soft border border-danger-border text-xs text-danger">
                Error: {sqliteDb.errorMessage}
              </div>
            )}

            {/* Tables Breakdown Header */}
            <div className="mt-4 pt-4 border-t border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-text">
                <Table className="h-3.5 w-3.5 text-text-subtle" />
                <span>
                  Persistence Tables Verified ({sqliteDb.details?.tablesVerified || 0} /{" "}
                  {sqliteDb.details?.tables?.length || 0})
                </span>
              </div>
              <button
                onClick={() => setExpandedTables(!expandedTables)}
                className="text-xs text-text font-semibold flex items-center gap-1 transition-colors hover:underline"
              >
                <span>{expandedTables ? "Hide Table Breakdown" : "View Table Breakdown"}</span>
                {expandedTables ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {/* Expandable Table Details */}
            {expandedTables && sqliteDb.details?.tables && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                {sqliteDb.details.tables.map((tbl) => (
                  <div
                    key={tbl.name}
                    className="p-2.5 rounded-lg border border-border bg-canvas/40 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-mono text-xs font-semibold text-text truncate" title={tbl.name}>
                        {tbl.name}
                      </span>
                      {tbl.verified ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-danger shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-text-muted">
                      <span>{tbl.modelTarget || "Core"}</span>
                      <span className="font-bold text-text tabular-nums">{tbl.rowCount} rows</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Remote Supabase / Cloud Database */}
        {remoteDb && (
          <div className="rounded-xl border border-border bg-surface-elevated/40 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-9 w-9 rounded-xl bg-canvas border border-border text-text-subtle flex items-center justify-center shrink-0">
                  <CloudOff className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-text">{remoteDb.name}</span>
                    <Badge className="bg-surface border border-border text-text-muted text-xs font-semibold">
                      Cloud Sync / Remote
                    </Badge>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    {remoteDb.details?.note ||
                      "Remote cloud database not provisioned. All four models persist to authoritative local SQLite."}
                  </p>
                </div>
              </div>

              <div className="self-end sm:self-auto">
                <Badge className="bg-surface border border-border text-text-muted font-semibold text-xs">
                  NOT CONFIGURED
                </Badge>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
