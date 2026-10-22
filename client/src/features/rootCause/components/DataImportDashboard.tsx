/**
 * SolarVision AI — Phase 3C: Manufacturing Data Onboarding Dashboard
 * 
 * Supports:
 * - 6-Category CSV selection & template downloading
 * - In-browser schema, type, enum, and duplicate detection
 * - Import preview (first rows & rejected diagnostics)
 * - Server validation preview & Confirm commit workflow
 * - Real readiness invalidation on commit
 * - Truthful zero-simulation persistence reporting
 */

import React, { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  HelpCircle,
  Layers,
  Loader2,
  RefreshCw,
  Send,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  ENTITY_TEMPLATES,
  generateTemplateCsv,
  parseAndValidateCsv,
} from "../csvValidator";
import {
  ImportEntityType,
  ImportValidationReport,
} from "../dataOnboardingTypes";
import { submitImportRows, ImportSubmissionResult } from "../dataOnboardingApi";

export interface DataImportDashboardProps {
  onImportSuccess?: () => void;
}

export function DataImportDashboard({ onImportSuccess }: DataImportDashboardProps = {}) {
  const utils = trpc.useUtils();

  const [selectedEntity, setSelectedEntity] = useState<ImportEntityType>("batches");
  const [csvContent, setCsvContent] = useState<string>("");
  const [uploadedFilename, setUploadedFilename] = useState<string>("");
  const [report, setReport] = useState<ImportValidationReport | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "errors" | "schema">("preview");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<ImportSubmissionResult | null>(null);

  // Real tRPC mutations connecting directly to Agent 1's backend importer
  const importPreviewMutation = trpc.rootCause.importPreview.useMutation();
  const importCommitMutation = trpc.rootCause.importCommit.useMutation();

  const currentTemplate = ENTITY_TEMPLATES[selectedEntity];

  const handleEntityChange = (entity: ImportEntityType) => {
    setSelectedEntity(entity);
    setCsvContent("");
    setUploadedFilename("");
    setReport(null);
    setSubmissionResult(null);
    setActiveTab("preview");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFilename(file.name);
    setSubmissionResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      const valReport = parseAndValidateCsv(selectedEntity, text, file.name);
      setReport(valReport);
      if (!valReport.isValid && valReport.rowErrors.length > 0) {
        setActiveTab("errors");
      } else {
        setActiveTab("preview");
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const csvData = generateTemplateCsv(selectedEntity);
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", currentTemplate.sampleFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePreviewSubmit = async () => {
    if (!report || report.parsedRows.length === 0) return;

    setIsSubmitting(true);
    setSubmissionResult(null);
    try {
      if (csvContent) {
        const res = await importPreviewMutation.mutateAsync({
          entityType: selectedEntity,
          csvContent,
          filename: uploadedFilename || `${selectedEntity}.csv`,
        });

        setSubmissionResult({
          success: res.isValid,
          importedCount: res.validRows,
          rejectedCount: res.invalidRows,
          message: res.isValid
            ? `Server validated all ${res.validRows} rows against official ${selectedEntity} schema contract.`
            : `Server validation detected ${res.invalidRows} rejected rows out of ${res.totalRows} total records.`,
          endpointStatus: "live_persisted",
          action: "preview",
          details: res.rowErrors?.map((e) => `Row #${e.rowNumber}: ${e.message}`) || [],
        });

        if (!res.isValid && res.rejectedRows?.length > 0) {
          setActiveTab("errors");
        }
        return;
      }

      const result = await submitImportRows(selectedEntity, report.parsedRows, { action: "preview" });
      setSubmissionResult(result);
    } catch (err: any) {
      const fallback = await submitImportRows(selectedEntity, report.parsedRows, { action: "preview" });
      setSubmissionResult(fallback);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommitSubmit = async () => {
    if (!report || report.parsedRows.length === 0) return;

    setIsSubmitting(true);
    setSubmissionResult(null);
    try {
      if (csvContent) {
        const res = await importCommitMutation.mutateAsync({
          entityType: selectedEntity,
          csvContent,
          filename: uploadedFilename || `${selectedEntity}.csv`,
        });

        if (res.success && res.status === "SUCCESS") {
          setSubmissionResult({
            success: true,
            importedCount: res.insertedRecords,
            rejectedCount: res.rejectedRecords,
            message: `Successfully persisted ${res.insertedRecords} records to ${selectedEntity} table in database.`,
            endpointStatus: "live_persisted",
            action: "commit",
            details: [
              `Audit Log ID: ${res.auditId}`,
              `Total Processed: ${res.totalRecords}`,
              `Inserted: ${res.insertedRecords}`,
              `Rejected: ${res.rejectedRecords}`,
            ],
          });

          // Invalidate backend caches so readiness stats and entity lists refresh
          utils.rootCause.readiness.invalidate();
          utils.rootCause.batches.invalidate();
          utils.rootCause.machines.invalidate();
          utils.inspection.history.invalidate();
          onImportSuccess?.();
          return;
        }

        setSubmissionResult({
          success: false,
          importedCount: res.insertedRecords ?? 0,
          rejectedCount: res.rejectedRecords ?? (res.totalRecords || 0),
          message: `Database commit rejected: ${res.errors?.join("; ") || "Integrity violation"}`,
          endpointStatus: "failed",
          action: "commit",
          details: res.errors,
        });
        return;
      }

      const result = await submitImportRows(selectedEntity, report.parsedRows, { action: "commit" });
      setSubmissionResult(result);
      if (result.success) {
        utils.rootCause.readiness.invalidate();
        utils.rootCause.batches.invalidate();
        utils.rootCause.machines.invalidate();
        utils.inspection.history.invalidate();
        onImportSuccess?.();
      }
    } catch (err: any) {
      const fallback = await submitImportRows(selectedEntity, report.parsedRows, { action: "commit" });
      setSubmissionResult(fallback);
      if (fallback.success) {
        utils.rootCause.readiness.invalidate();
        utils.rootCause.batches.invalidate();
        utils.rootCause.machines.invalidate();
        utils.inspection.history.invalidate();
        onImportSuccess?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Manufacturing Telemetry Ingestion
          </span>
          <h2 className="text-lg font-black tracking-tight text-slate-900 sm:text-xl">
            Factory Data Onboarding & Schema Validation
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 max-w-2xl">
            Import production lots, machine assets, furnace readings, and failure analysis labels
            strictly verified against official Model 2 schemas.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadTemplate}
          className="border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm shrink-0"
        >
          <Download className="mr-1.5 h-3.5 w-3.5 text-[#F2B941]" />
          Download {currentTemplate.displayName} Template
        </Button>
      </div>

      {/* Category Selector Tabs */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-800 block">
          Select Data Category to Import
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {(Object.keys(ENTITY_TEMPLATES) as ImportEntityType[]).map((key) => {
            const tmpl = ENTITY_TEMPLATES[key];
            const isSelected = selectedEntity === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleEntityChange(key)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? "border-[#F2B941] bg-[#FFFDF5] shadow-[0_4px_16px_rgba(242,185,65,0.12)] ring-1 ring-[#F2B941]"
                    : "border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-900 leading-tight">
                    {tmpl.displayName}
                  </span>
                  {isSelected && <span className="h-2 w-2 rounded-full bg-[#F2B941]" />}
                </div>
                <p className="mt-1 text-[10px] text-slate-500 line-clamp-2">
                  {tmpl.requiredColumns.length} required fields
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Upload Zone & Instructions */}
      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-6 text-center hover:bg-slate-50 transition-colors">
        <input
          type="file"
          id="csv-file-input"
          accept=".csv,text/csv"
          onChange={handleFileUpload}
          className="hidden"
        />
        <label
          htmlFor="csv-file-input"
          className="cursor-pointer flex flex-col items-center justify-center"
        >
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF3C4] text-[#0B0909] shadow-sm mb-2">
            <UploadCloud className="h-6 w-6 text-[#0B0909]" />
          </div>
          <span className="text-sm font-bold text-slate-900">
            {uploadedFilename ? `Selected: ${uploadedFilename}` : "Click or drag CSV file to validate"}
          </span>
          <span className="mt-1 text-xs text-slate-500 max-w-sm">
            Target schema: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px] text-slate-800">{currentTemplate.sampleFilename}</code>
          </span>
        </label>
      </div>

      {/* Validation Report & Statistics Banner */}
      {report && (
        <div className="space-y-4">
          <div
            className={`rounded-xl border p-4.5 ${
              report.isValid
                ? "border-emerald-300 bg-emerald-50/80 text-emerald-950"
                : "border-amber-300 bg-amber-50/80 text-amber-950"
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                {report.isValid ? (
                  <CheckCircle2 className="h-6 w-6 text-[#087e6d] shrink-0" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
                )}
                <div>
                  <h4 className="text-sm font-bold">
                    {report.isValid
                      ? "CSV Conforms to Schema Contract"
                      : "Schema Validation Excursions Detected"}
                  </h4>
                  <p className="text-xs opacity-90">
                    File: <span className="font-mono font-semibold">{report.filename}</span> •
                    Validated at {new Date(report.validatedAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* Statistics Counters */}
              <div className="flex items-center gap-3 text-xs shrink-0 font-medium">
                <span className="rounded-lg bg-white/80 px-2.5 py-1 border border-slate-200 text-slate-800">
                  Total: <strong>{report.totalRows}</strong>
                </span>
                <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-emerald-900 border border-emerald-300">
                  Valid: <strong>{report.validRows}</strong>
                </span>
                {report.invalidRows > 0 && (
                  <span className="rounded-lg bg-rose-100 px-2.5 py-1 text-rose-900 border border-rose-300">
                    Rejected: <strong>{report.invalidRows}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Missing columns warning */}
            {report.missingRequiredColumns.length > 0 && (
              <div className="mt-3 rounded-lg bg-rose-100 p-2.5 text-xs text-rose-900 border border-rose-300">
                <strong>Missing Required Header Columns:</strong>{" "}
                {report.missingRequiredColumns.map((c) => (
                  <code key={c} className="mx-1 bg-white px-1 py-0.5 rounded font-mono font-bold">
                    {c}
                  </code>
                ))}
              </div>
            )}
          </div>

          {/* Tab Navigation: Preview vs Rejected Records vs Schema */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-2">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab("preview")}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
                  activeTab === "preview"
                    ? "border-[#F2B941] text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Valid Row Preview ({report.validRows})
              </button>
              <button
                onClick={() => setActiveTab("errors")}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
                  activeTab === "errors"
                    ? "border-[#F2B941] text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Rejected Records ({report.rejectedRows.length})
              </button>
              <button
                onClick={() => setActiveTab("schema")}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
                  activeTab === "schema"
                    ? "border-[#F2B941] text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Schema Specification
              </button>
            </div>

            {/* Submission Actions: Preview & Commit */}
            {report.validRows > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handlePreviewSubmit}
                  disabled={isSubmitting}
                  className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold h-8"
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                  Validate on Server
                </Button>

                <Button
                  onClick={handleCommitSubmit}
                  disabled={isSubmitting}
                  className="bg-[#0B0909] text-white hover:bg-slate-800 text-xs font-semibold h-8 shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Committing...
                    </>
                  ) : (
                    <>
                      <Send className="mr-1.5 h-3.5 w-3.5 text-[#F2B941]" />
                      Confirm & Commit {report.validRows} Records
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Submission Feedback Result (Truthful: never simulates fake database writes) */}
          {submissionResult && (
            <div
              className={`rounded-xl border p-4 text-xs ${
                submissionResult.endpointStatus === "live_persisted"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                  : submissionResult.endpointStatus === "backend_unmounted"
                  ? "border-blue-300 bg-blue-50 text-blue-950"
                  : "border-rose-300 bg-rose-50 text-rose-950"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <Database className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-bold">
                    {submissionResult.endpointStatus === "live_persisted"
                      ? submissionResult.action === "preview"
                        ? "Server Validation Succeeded"
                        : "Records Persisted to Database"
                      : submissionResult.endpointStatus === "backend_unmounted"
                      ? "Client-Side Schema Verification Complete (Backend Importer Standby)"
                      : "Submission Rejected"}
                  </p>
                  <p className="leading-relaxed">{submissionResult.message}</p>
                  {submissionResult.details && (
                    <ul className="list-disc pl-4 space-y-0.5 mt-1 font-mono text-[11px]">
                      {submissionResult.details.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: Valid Rows Preview */}
          {activeTab === "preview" && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              {report.parsedRows.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Zero valid rows to preview. Check rejected records tab for diagnostics.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      {currentTemplate.allColumns.map((col) => (
                        <th key={col} className="py-2.5 px-3 whitespace-nowrap">
                          {col}
                          {currentTemplate.requiredColumns.includes(col) && (
                            <span className="text-amber-600 ml-0.5">*</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.parsedRows.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 font-mono text-[11px]">
                        <td className="py-2 px-3 text-slate-400 font-sans">{idx + 1}</td>
                        {currentTemplate.allColumns.map((col) => (
                          <td key={col} className="py-2 px-3 truncate max-w-[160px]">
                            {row[col] !== undefined && row[col] !== null ? String(row[col]) : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {report.parsedRows.length > 10 && (
                <div className="bg-slate-50 p-2 text-center text-[11px] text-slate-500 border-t border-slate-200">
                  Showing first 10 rows of {report.parsedRows.length} valid records.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Rejected Records */}
          {activeTab === "errors" && (
            <div className="space-y-3">
              {report.rejectedRows.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 text-center text-xs text-emerald-800">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-[#087e6d] mb-1" />
                  Zero rejected rows. All records passed validation.
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {report.rejectedRows.map((rej, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-rose-900 font-bold">
                        <span className="flex items-center gap-1.5">
                          <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                          Row #{rej.rowNumber} Failed Validation
                        </span>
                        <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-rose-200">
                          {rej.errors.length} excursion{rej.errors.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <ul className="list-disc pl-5 text-[11px] text-rose-800 space-y-0.5">
                        {rej.errors.map((err, eIdx) => (
                          <li key={eIdx}>{err}</li>
                        ))}
                      </ul>
                      <div className="rounded bg-white/80 p-2 font-mono text-[10px] text-slate-700 border border-slate-200 truncate">
                        Raw data: {JSON.stringify(rej.data)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Schema Specification */}
          {activeTab === "schema" && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Column</th>
                    <th className="py-2.5 px-3">Required</th>
                    <th className="py-2.5 px-3">Data Type</th>
                    <th className="py-2.5 px-3">Allowed Values / Constraints</th>
                    <th className="py-2.5 px-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentTemplate.allColumns.map((col) => {
                    const spec = currentTemplate.columnSpecs[col];
                    const isReq = currentTemplate.requiredColumns.includes(col);
                    return (
                      <tr key={col} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{col}</td>
                        <td className="py-2.5 px-3">
                          {isReq ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                              MANDATORY
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Optional</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {spec?.type || "string"}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-600 font-mono max-w-[220px] truncate">
                          {spec?.allowedValues ? spec.allowedValues.join(" | ") : "Any valid format"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {spec?.description || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
