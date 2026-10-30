import React, { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CloudOff,
  Database,
  HardDrive,
  Info,
  Layers,
  Server,
  Table,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DatabaseHealthInfo } from "./types";

interface DatabaseHealthCardProps {
  databases: DatabaseHealthInfo[];
}

export function DatabaseHealthCard({ databases }: DatabaseHealthCardProps) {
  const [expandedTables, setExpandedTables] = useState(false);

  const sqliteDb = databases.find((d) => d.type === "sqlite");
  const remoteDb = databases.find((d) => d.type === "supabase" || d.name.toLowerCase().includes("remote"));

  return (
    <Card className="border border-slate-200/80 bg-white shadow-sm overflow-hidden rounded-2xl">
      <div className="border-b border-slate-200/80 px-6 py-4 flex items-center justify-between bg-[#FAFAF7]">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Database Connectivity & Table Telemetry
            </h2>
            <p className="text-xs text-slate-500">
              Direct verification of database connections, read-only ping latency, and model persistence tables
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Authoritative SQLite Database Card */}
        {sqliteDb && (
          <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <HardDrive className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900">{sqliteDb.name}</span>
                    <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-semibold">
                      SQLite 3 (WAL Mode)
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Path: <code className="font-mono text-slate-700 text-[11px]">{sqliteDb.details?.path || "data/solarvision.db"}</code>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                {sqliteDb.state === "connected" ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold gap-1 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    CONNECTED (SELECT 1: {sqliteDb.pingLatencyMs}ms)
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 border-red-300 font-semibold gap-1 text-xs">
                    <XCircle className="h-3.5 w-3.5 text-red-600" />
                    DISCONNECTED
                  </Badge>
                )}
              </div>
            </div>

            {sqliteDb.errorMessage && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                Error: {sqliteDb.errorMessage}
              </div>
            )}

            {/* Tables Breakdown Header */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Table className="h-3.5 w-3.5 text-slate-500" />
                <span>
                  Persistence Tables Verified ({sqliteDb.details?.tablesVerified || 0} /{" "}
                  {sqliteDb.details?.tables?.length || 0})
                </span>
              </div>
              <button
                onClick={() => setExpandedTables(!expandedTables)}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 transition-colors"
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
                    className="p-2.5 rounded-lg border border-slate-100 bg-[#FAFAF7] flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-mono text-xs font-semibold text-slate-800 truncate" title={tbl.name}>
                        {tbl.name}
                      </span>
                      {tbl.verified ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{tbl.modelTarget || "Core"}</span>
                      <span className="font-bold text-slate-800">{tbl.rowCount} rows</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Remote Supabase / Cloud Database */}
        {remoteDb && (
          <div className="rounded-xl border border-slate-200/60 bg-slate-50/70 p-4.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-9 w-9 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                  <CloudOff className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-700">{remoteDb.name}</span>
                    <Badge className="bg-slate-200 text-slate-700 border-slate-300 text-[10px] font-semibold">
                      Cloud Sync / Remote
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {remoteDb.details?.note ||
                      "Remote cloud database not provisioned. All four models persist to authoritative local SQLite."}
                  </p>
                </div>
              </div>

              <div className="self-end sm:self-auto">
                <Badge className="bg-slate-200 text-slate-700 border-slate-300 font-semibold text-xs">
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

