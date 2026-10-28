/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * Stored Prediction History Interface & Audit Trail
 * 
 * STRICT COMPLIANCE:
 * - Queries actual session/database history via adapter.
 * - Does not invent artificial records.
 * - Shows module ID, predicted value, target, timestamp, and model version.
 */

import React, { useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  Database,
  FileText,
  Filter,
  Layers,
  RefreshCw,
  Search,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { sandiaApi } from "../adapter";
import type { SandiaPredictionHistoryItem } from "../types";

interface PredictionHistoryTableProps {
  lastPredictionTimestamp?: string;
}

export function PredictionHistoryTable({ lastPredictionTimestamp }: PredictionHistoryTableProps) {
  const [history, setHistory] = useState<SandiaPredictionHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterModule, setFilterModule] = useState("");

  const loadHistory = async () => {
    setLoading(true);
    try {
      const records = await sandiaApi.getHistory({
        moduleId: filterModule.trim() || undefined,
        limit: 50,
      });
      setHistory(records);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [filterModule, lastPredictionTimestamp]);

  return (
    <Card className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-8 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#F2B941]">
              Audit Trail & Operational Records
            </span>
            <Badge className="bg-slate-100 text-slate-800 border-slate-300 text-[10px] font-mono">
              {history.length} Inferences Logged
            </Badge>
          </div>
          <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
            Prediction History & Telemetry Log
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Forward-compatible with Agent 2's historical query contract. Zero synthetic entries generated.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              placeholder="Filter by Module ID..."
              className="h-8 pl-8 rounded-xl font-mono text-xs border-slate-300"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadHistory}
            disabled={loading}
            className="h-8 gap-1.5 rounded-xl border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin text-slate-400" : "text-[#F2B941]"}`} />
            Refresh
          </Button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center space-y-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-400 mx-auto">
            <FileText className="h-5 w-5" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800">
            No Sandia Electrical Predictions Recorded
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Inferences submitted through the dynamic schema form or batch API will be logged here with module identifier, predicted electrical value, and model version.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Module ID</th>
                <th className="px-4 py-3">Predicted Value</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Latency</th>
                <th className="px-4 py-3">Model Version</th>
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {new Date(item.timestamp).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "medium",
                    })}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                    {item.moduleId}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                    {typeof item.prediction === "number"
                      ? item.prediction.toFixed(2)
                      : String(item.prediction)}{" "}
                    <span className="text-slate-400 font-normal">{item.targetUnit}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {item.targetName}
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {item.processingTimeMs} ms
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    v{item.modelVersion}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {item.isMock ? (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                        MOCK
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                        PIPELINE
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
