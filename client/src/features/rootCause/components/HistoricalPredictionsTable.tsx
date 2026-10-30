/**
 * SolarVision AI — Phase 3: Historical Root Cause Prediction Table
 * 
 * Displays historical root cause diagnoses:
 * - Search by inspection ID or predicted cause
 * - Filter by defect type, machine, and verification status
 * - Displays confidence, category, and review status
 * - Action to load past inspection evidence
 */

import React, { useMemo, useState } from "react";
import {
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Compass,
  Database,
  ExternalLink,
  Filter,
  History,
  Layers,
  Search,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDefectMeta } from "@/lib/defects";
import type { HistoricalPrediction } from "../types";

export interface HistoricalPredictionsTableProps {
  history: HistoricalPrediction[];
  onSelectInspection?: (inspectionId: string) => void;
  isLoading?: boolean;
}

export function HistoricalPredictionsTable({
  history,
  onSelectInspection,
  isLoading = false,
}: HistoricalPredictionsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [defectFilter, setDefectFilter] = useState<string>("all");

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      // Search text match
      const query = searchQuery.toLowerCase().trim();
      if (
        query &&
        !item.inspectionId.toLowerCase().includes(query) &&
        !item.topCause.toLowerCase().includes(query) &&
        !(item.batchNumber && item.batchNumber.toLowerCase().includes(query)) &&
        !(item.machineCode && item.machineCode.toLowerCase().includes(query))
      ) {
        return false;
      }

      // Status filter
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      // Defect filter
      if (defectFilter !== "all" && item.defectType !== defectFilter) {
        return false;
      }

      return true;
    });
  }, [history, searchQuery, statusFilter, defectFilter]);

  const uniqueDefects = useMemo(() => {
    return Array.from(new Set(history.map((h) => h.defectType))).filter(Boolean);
  }, [history]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      {/* Table Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Audit Trail & Retrospective
          </span>
          <h3 className="text-sm font-bold text-slate-900">
            Historical Root-Cause Diagnoses ({filteredHistory.length} Record{filteredHistory.length === 1 ? "" : "s"})
          </h3>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-48">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search diagnosis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-slate-50 border-slate-200"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="dismissed">Dismissed</option>
          </select>

          {uniqueDefects.length > 0 && (
            <select
              value={defectFilter}
              onChange={(e) => setDefectFilter(e.target.value)}
              className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700"
            >
              <option value="all">All Defects</option>
              {uniqueDefects.map((def) => (
                <option key={def} value={def}>
                  {def}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Table Body */}
      {filteredHistory.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
          <History className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-xs font-semibold text-slate-700">No Historical Records Found</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Past root cause predictions will appear here once Model 2 performs real inferences.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-3">Date / Time</th>
                <th className="py-2.5 px-3">Inspection ID</th>
                <th className="py-2.5 px-3">Defect Class</th>
                <th className="py-2.5 px-3">MES Context</th>
                <th className="py-2.5 px-3">Top Predicted Cause</th>
                <th className="py-2.5 px-3">Confidence</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.map((item) => {
                const meta = getDefectMeta(item.defectType);
                const confPct = Math.round(item.topConfidence * 100);

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3 px-3 text-slate-500 font-mono text-xs whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    {/* Inspection ID */}
                    <td className="py-3 px-3 font-mono text-xs text-slate-800 font-semibold max-w-[120px] truncate">
                      {item.inspectionId}
                    </td>

                    {/* Defect Class */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-bold ${meta.badgeBg} ${meta.badgeBorder} ${meta.badgeText}`}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: meta.color }}
                        />
                        {meta.label}
                      </span>
                    </td>

                    {/* MES Context */}
                    <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
                      <div>Batch: {item.batchNumber || "—"}</div>
                      <div className="text-xs text-slate-400">
                        Mach: {item.machineCode || "—"}
                      </div>
                    </td>

                    {/* Predicted Cause */}
                    <td className="py-3 px-3 font-medium text-slate-900 max-w-[200px] truncate">
                      {item.topCause}
                    </td>

                    {/* Confidence */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{confPct}%</span>
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${
                              confPct >= 70
                                ? "bg-success"
                                : confPct >= 40
                                ? "bg-primary"
                                : "bg-slate-400"
                            }`}
                            style={{ width: `${confPct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Verification Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                          item.status === "verified"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.status === "dismissed"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item.status === "verified" && <CheckCircle2 className="h-3 w-3" />}
                        {item.status === "dismissed" && <XCircle className="h-3 w-3" />}
                        {item.status === "pending" && <Clock className="h-3 w-3" />}
                        {item.status}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {onSelectInspection && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectInspection(item.inspectionId)}
                          className="h-7 text-xs text-slate-600 hover:text-slate-900"
                        >
                          Inspect
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
