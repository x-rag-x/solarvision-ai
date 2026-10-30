import React from "react";
import { Printer, Download, Share2, RotateCcw, ArrowLeft, Copy, Check, FileText } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { formatInspectionDate } from "@/lib/date";

interface ReportLayoutProps {
  title: string;
  reportId: string;
  timestamp: Date | string | number | null | undefined;
  operatorName?: string;
  modelBadge: React.ReactNode;
  statusBadge: React.ReactNode;
  verdictHeadline: string;
  verdictTone?: "success" | "warning" | "danger" | "neutral";
  verdictStats?: Array<{ label: string; value: React.ReactNode; unit?: string }>;
  evidenceNode: React.ReactNode;
  findingsNode: React.ReactNode;
  mandatoryNoticeNode: React.ReactNode;
  actionsNode?: React.ReactNode;
  onRunAnother?: () => void;
  onExportCsv?: () => void;
  className?: string;
}

export function ReportLayout({
  title = "Inspection Report",
  reportId = "—",
  timestamp,
  operatorName = "Authorized Operator",
  modelBadge,
  statusBadge,
  verdictHeadline,
  verdictTone = "neutral",
  verdictStats = [],
  evidenceNode,
  findingsNode,
  mandatoryNoticeNode,
  actionsNode,
  onRunAnother,
  onExportCsv,
  className = "",
}: ReportLayoutProps) {
  const [copied, setCopied] = React.useState(false);

  const reportTitle = title || "Inspection Report";
  const displayReportId = reportId || "—";
  const displayOperator = operatorName || "Authorized Operator";
  const formattedDate = formatInspectionDate(timestamp);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Report URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const verdictToneStyles = {
    success: "border-success/30 bg-success-tint/40 text-success",
    warning: "border-warning/30 bg-warning-tint/40 text-terracotta",
    danger: "border-danger/30 bg-danger-tint/40 text-danger",
    neutral: "border-border bg-surface-subtle text-text",
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Action / Navigation Bar (Hidden when printed) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <Link
          href="/history"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-3 hover:text-text transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Inspection Records</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {actionsNode}
          {onExportCsv && (
            <button
              onClick={onExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-2 hover:bg-surface-subtle hover:text-text transition-colors shadow-xs"
            >
              <Download className="h-3.5 w-3.5 text-text-3" />
              <span>Export CSV</span>
            </button>
          )}
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-2 hover:bg-surface-subtle hover:text-text transition-colors shadow-xs"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Share2 className="h-3.5 w-3.5 text-text-3" />}
            <span>{copied ? "Link Copied" : "Share"}</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-2 hover:bg-surface-subtle hover:text-text transition-colors shadow-xs"
            title="Generate printable A4 PDF documentation"
          >
            <Printer className="h-3.5 w-3.5 text-text-3" />
            <span>Print Report (A4)</span>
          </button>
          {onRunAnother && (
            <button
              onClick={onRunAnother}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#965660] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#7E454E] transition-colors shadow-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#F2DBD7]" />
              <span>Run Another</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Printable Report Sheet */}
      <article className="rounded-2xl border border-border bg-surface p-6 sm:p-8 space-y-6 shadow-xs print:p-0 print:border-none print:shadow-none">
        {/* Report Header */}
        <header className="border-b border-border pb-5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono uppercase tracking-widest text-text-3">
                  SolarVision AI Quality Operations Report
                </span>
                <span className="text-border-strong">•</span>
                <span className="font-mono text-xs text-text-3">ISO-Traceable Evidence</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-text">
                {reportTitle}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {modelBadge}
              {statusBadge}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-text-3 pt-1">
            <div>
              <span>Timestamp: </span>
              <span className="font-mono font-medium text-text">{formattedDate}</span>
            </div>
            <div>
              <span>Operator: </span>
              <span className="font-medium text-text">{displayOperator}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>ID: </span>
              <span className="font-mono font-medium text-text">{displayReportId}</span>
            </div>
          </div>
        </header>

        {/* Verdict Row */}
        <section
          aria-label="Inspection Verdict"
          className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border p-4 sm:p-5 ${verdictToneStyles[verdictTone]}`}
        >
          <div className="space-y-0.5">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
              Operational Verdict
            </span>
            <p className="text-lg sm:text-xl font-bold text-text leading-tight">
              {verdictHeadline}
            </p>
          </div>

          {verdictStats.length > 0 && (
            <div className="flex flex-wrap items-center gap-6 sm:border-l sm:border-border sm:pl-6 shrink-0">
              {verdictStats.map((stat, idx) => {
                const displayVal =
                  stat.value instanceof Date
                    ? formatInspectionDate(stat.value)
                    : stat.value === null || stat.value === undefined
                    ? "—"
                    : stat.value;
                return (
                  <div key={idx} className="space-y-0.5">
                    <span className="text-xs text-text-3 block">{stat.label}</span>
                    <span className="font-mono text-xl font-bold text-text tabular-nums">
                      {displayVal}
                      {stat.unit && <span className="text-xs font-normal text-text-3 ml-1">{stat.unit}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Mandatory Provenance & Caveat Line (§9 Invariants) */}
        <div className="print-break-inside-avoid">
          {mandatoryNoticeNode}
        </div>

        {/* Side-by-side Evidence & Diagnostic Findings Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start print:grid-cols-1">
          {/* Evidence View (Visual Inspection Image or Telemetry) */}
          <section aria-label="Visual Evidence" className="space-y-2 print-break-inside-avoid">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Primary Visual & Metric Evidence
            </h2>
            {evidenceNode}
          </section>

          {/* Findings Detail List/Table */}
          <section aria-label="Detailed Findings" className="space-y-2 print-break-inside-avoid">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Itemized Diagnostic Findings
            </h2>
            {findingsNode}
          </section>
        </div>

        {/* Print-only footer */}
        <footer className="hidden print:block pt-6 mt-8 border-t border-border text-xs font-mono text-text-3">
          <div className="flex justify-between items-center">
            <span>SolarVision AI — Automated Quality Intelligence Platform</span>
            <span>Document Checksum: {displayReportId ? displayReportId.slice(0, 16) : "—"}</span>
          </div>
        </footer>
      </article>
    </div>
  );
}

export default ReportLayout;
