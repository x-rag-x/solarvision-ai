/**
 * SolarVision AI — Model 4: Assessment History Table
 * 
 * Displays historical operating condition assessments from the database
 * and allows reloading stored measurements into the simulator.
 */

import React from "react";
import {
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  Clock,
  History,
  RefreshCw,
  RotateCcw,
  Sliders,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MaintenancePredictionResult } from "../types";

interface AssessmentHistoryTableProps {
  history: MaintenancePredictionResult[];
  onReloadAssessment: (item: MaintenancePredictionResult) => void;
  onClearHistory: () => void;
  onRefreshHistory?: () => void;
  loadingHistory?: boolean;
}

export function AssessmentHistoryTable({
  history,
  onReloadAssessment,
  onClearHistory,
  onRefreshHistory,
  loadingHistory = false,
}: AssessmentHistoryTableProps) {
  if (history.length === 0) {
    return (
      <Card className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
          <History className="h-6 w-6" />
        </div>
        <h4 className="mt-3 text-base font-bold text-slate-900">
          No Recent Assessment Records
        </h4>
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
          No operating condition assessments found in the database. Execute an assessment using the simulator above to log entries to the database.
        </p>
        {onRefreshHistory && (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshHistory}
              disabled={loadingHistory}
              className="gap-2 rounded-xl text-xs text-slate-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
              Query Database for Stored Assessments
            </Button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Database Assessment History
            </span>
            <Badge className="bg-[#0B0909] text-white text-xs font-mono">
              {history.length} Record{history.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <h3 className="mt-1 text-base font-bold text-slate-900 sm:text-lg">
            Persisted Operating Condition Evaluations
          </h3>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onRefreshHistory && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshHistory}
              disabled={loadingHistory}
              className="gap-1.5 text-xs text-slate-700 rounded-xl"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onClearHistory}
            className="gap-1.5 text-xs text-slate-500 hover:text-rose-600 rounded-xl"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Local
          </Button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-xs">
              <th className="pb-3 pr-4">Timestamp</th>
              <th className="pb-3 px-4">Station / Machine</th>
              <th className="pb-3 px-4">Variant</th>
              <th className="pb-3 px-4">Speed / Torque</th>
              <th className="pb-3 px-4">Tool Wear</th>
              <th className="pb-3 px-4">Verdict</th>
              <th className="pb-3 px-4">P(Failure)</th>
              <th className="pb-3 pl-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.map((item, index) => {
              const isFail = item.classification === "FAILURE";
              const isWarn = item.classification === "WARNING";
              return (
                <tr key={index} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 pr-4 text-slate-500 font-mono text-xs">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">
                    {item.inputMeasurements.machineId || "AI4I-BENCHMARK"}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                    {item.inputMeasurements.productType}-Type
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">
                    {item.inputMeasurements.rotationalSpeedRpm} rpm • {item.inputMeasurements.torqueNm} Nm
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">
                    {item.inputMeasurements.toolWearMin} min
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge
                      className={`text-xs font-mono ${
                        isFail
                          ? "bg-rose-100 text-rose-800 border-rose-300"
                          : isWarn
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-emerald-100 text-emerald-800 border-emerald-300"
                      }`}
                    >
                      {item.classification}
                      {item.activeFailureMode ? ` (${item.activeFailureMode})` : ""}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold">
                    <span className={isFail ? "text-rose-700" : isWarn ? "text-amber-700" : "text-slate-700"}>
                      {item.failureProbability !== null
                        ? `${(item.failureProbability * 100).toFixed(1)}%`
                        : "N/A"}
                    </span>
                  </td>
                  <td className="py-3.5 pl-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onReloadAssessment(item)}
                      className="h-7 gap-1 text-xs rounded-lg text-slate-600 hover:text-slate-950"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reload
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
