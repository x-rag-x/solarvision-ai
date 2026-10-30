/**
 * SolarVision AI — Phase 3C: Expert Root Cause Confirmation Review
 * 
 * Quality Engineering interface for recording confirmed ground-truth root causes.
 * Fully wired to Agent 1's real authenticated tRPC procedures:
 * - trpc.rootCause.annotate (mutation persisting into SQLite root_cause_annotations)
 * - trpc.rootCause.annotations (query retrieving confirmed annotations)
 * - trpc.rootCause.readiness (invalidated on commit to refresh training gate)
 * 
 * STRICT COMPLIANCE:
 * - Persists real human-reviewed labels into database.
 * - Requires reviewer identity and physical evidence before accepting label.
 * - Strictly isolates human ground-truth labels from model predictions.
 * - Never converts optical defect classes automatically into root causes.
 * - Supports the agreed 9-class root cause taxonomy.
 */

import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Cpu,
  FileCheck,
  FileSpreadsheet,
  Info,
  Layers,
  Loader2,
  Lock,
  Microscope,
  RotateCcw,
  ScanLine,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDefectMeta } from "@/lib/defects";
import {
  ConfirmedRootCauseAnnotation,
  ConfirmationConfidenceLevel,
  ROOT_CAUSE_DETAILS,
  ROOT_CAUSE_TAXONOMY,
  RootCauseTaxonomyClass,
} from "../dataOnboardingTypes";

export interface RootCauseConfirmationReviewProps {
  preselectedInspectionId?: string;
  onAnnotationConfirmed?: (annotation: ConfirmedRootCauseAnnotation) => void;
}

const SUPPORTING_EVIDENCE_OPTIONS = [
  { id: "cross_section_microscopy", label: "Cross-Section SEM / Optical Microscopy" },
  { id: "furnace_pyrometer_log", label: "Furnace Pyrometer Excursion Log" },
  { id: "screen_printer_viscosity", label: "Paste Viscosity & Blade Force Telemetry" },
  { id: "ribbon_peel_test", label: "Soldering Ribbon Peel-Strength Test" },
  { id: "vacuum_gripper_log", label: "Cassette Gripper Pressure / Deceleration Log" },
  { id: "wafer_supplier_lot", label: "Raw Wafer Ingot Foundry Quality Certificate" },
  { id: "el_electroluminescence", label: "Electroluminescence (EL) Defect Signature" },
  { id: "operator_visual_audit", label: "In-Line Visual Quality Inspection Audit" },
];

export function RootCauseConfirmationReview({
  preselectedInspectionId = "",
  onAnnotationConfirmed,
}: RootCauseConfirmationReviewProps) {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [inspectionId, setInspectionId] = useState(preselectedInspectionId);
  const [selectedCause, setSelectedCause] = useState<RootCauseTaxonomyClass | null>(null);
  const [confidenceLevel, setConfidenceLevel] = useState<ConfirmationConfidenceLevel>("confirmed");
  const [selectedDefectId, setSelectedDefectId] = useState<number | null>(null);
  const [investigationNotes, setInvestigationNotes] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [reviewerName, setReviewerName] = useState("");
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
    details?: string;
  } | null>(null);

  // Update reviewerName when user auth is loaded
  useEffect(() => {
    if (user?.name || user?.email) {
      setReviewerName(user.name || user.email || "QA Lead Engineer");
    } else if (!reviewerName) {
      setReviewerName("SolarVision Quality Engineer");
    }
  }, [user]);

  useEffect(() => {
    if (preselectedInspectionId) {
      setInspectionId(preselectedInspectionId);
    }
  }, [preselectedInspectionId]);

  // Query inspection history for selection
  const { data: inspectionHistory, isLoading: isHistoryLoading } =
    trpc.inspection.history.useQuery({ limit: 50 });

  const historyList: any[] = Array.isArray(inspectionHistory)
    ? inspectionHistory
    : (inspectionHistory as any)?.items || [];

  // Query selected inspection detail
  const { data: detailData, isLoading: isDetailLoading, error: detailError } =
    trpc.inspection.detail.useQuery(
      { inspectionId: inspectionId || "00000000-0000-0000-0000-000000000000" },
      { enabled: Boolean(inspectionId) }
    );

  // Query real confirmed annotations from SQLite via Agent 1's tRPC procedure
  const {
    data: dbAnnotations,
    isLoading: isAnnotationsLoading,
    refetch: refetchDbAnnotations,
  } = trpc.rootCause.annotations.useQuery(
    { inspectionId: inspectionId || "00000000-0000-0000-0000-000000000000" },
    { enabled: Boolean(inspectionId) }
  );

  // Real tRPC annotation mutation
  const annotateMutation = trpc.rootCause.annotate.useMutation();

  const activeInspection = detailData?.inspection;
  const detections = (activeInspection as any)?.detections || [];

  const toggleEvidence = (evidenceId: string) => {
    setSelectedEvidence((prev) =>
      prev.includes(evidenceId) ? prev.filter((id) => id !== evidenceId) : [...prev, evidenceId]
    );
  };

  const handleResetForm = () => {
    setSelectedCause(null);
    setConfidenceLevel("confirmed");
    setSelectedDefectId(null);
    setInvestigationNotes("");
    setSelectedEvidence([]);
    setStatusMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!inspectionId.trim()) {
      setStatusMessage({ type: "error", text: "Please select an inspection to review." });
      return;
    }

    if (!activeInspection) {
      setStatusMessage({
        type: "error",
        text: "The specified Inspection ID was not found in the inspection database or access is forbidden.",
      });
      return;
    }

    if (!selectedCause) {
      setStatusMessage({
        type: "error",
        text: "Please select a confirmed root cause from the official 9-class taxonomy.",
      });
      return;
    }

    if (selectedEvidence.length === 0) {
      setStatusMessage({
        type: "error",
        text: "At least one supporting physical evidence factor must be selected (e.g. SEM microscopy, furnace log, peel test).",
      });
      return;
    }

    if (!investigationNotes.trim()) {
      setStatusMessage({
        type: "error",
        text: "Investigation notes are required. Provide physical evidence details and failure analysis justification.",
      });
      return;
    }

    if (!reviewerName.trim()) {
      setStatusMessage({
        type: "error",
        text: "Reviewer identity is required for quality engineering audit compliance.",
      });
      return;
    }

    // Format notes with evidence citations
    const fullNotes = [
      investigationNotes.trim(),
      `[Evidence: ${selectedEvidence.join(", ")}]`,
      `[Reviewer: ${reviewerName.trim()}]`,
    ].join("\n\n");

    try {
      const res = await annotateMutation.mutateAsync({
        inspectionId: inspectionId.trim(),
        defectId: selectedDefectId !== null ? String(selectedDefectId) : undefined,
        confirmedCause: selectedCause,
        confidenceLevel,
        investigationNotes: fullNotes,
      });

      if (res?.success) {
        setStatusMessage({
          type: "success",
          text: `Confirmed root cause persisted to database successfully (Audit ID: ${res.annotationId || "persisted"}).`,
          details: `Classification '${ROOT_CAUSE_DETAILS[selectedCause].label}' committed by ${reviewerName.trim()} for inspection ${inspectionId.slice(0, 8)}...`,
        });

        // Invalidate queries so readiness stats and annotations refresh immediately
        utils.rootCause.annotations.invalidate({ inspectionId: inspectionId.trim() });
        utils.rootCause.readiness.invalidate();
        refetchDbAnnotations();

        const confirmedRecord: ConfirmedRootCauseAnnotation = {
          id: res.annotationId || `rc-ann-${Date.now().toString(36)}`,
          inspectionId: inspectionId.trim(),
          defectId: selectedDefectId,
          confirmedCause: selectedCause,
          confidenceLevel,
          investigationNotes: fullNotes,
          supportingEvidenceFactors: selectedEvidence,
          verifiedBy: reviewerName.trim(),
          verifiedAt: new Date().toISOString(),
        };

        onAnnotationConfirmed?.(confirmedRecord);
      }
    } catch (err: any) {
      const isAuthErr = err.message?.includes("UNAUTHORIZED") || err.data?.code === "UNAUTHORIZED";
      const isForbidden = err.message?.includes("FORBIDDEN") || err.data?.code === "FORBIDDEN";

      setStatusMessage({
        type: "error",
        text: isAuthErr
          ? "Unauthorized: Your session has expired. Please sign in again to record confirmed annotations."
          : isForbidden
          ? "Forbidden: Access denied to this inspection record. You may only annotate inspections belonging to your operator account."
          : `Failed to persist annotation: ${err.message || String(err)}`,
        details: err.message,
      });
    }
  };

  const isSubmitting = annotateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Policy Banner: Clear separation between human ground truth and model predictions */}
      <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4 text-amber-900">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
              Ground-Truth Root Cause Review Protocol (Human-in-the-Loop)
            </h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              Human ground-truth labeling is strictly isolated from Model 2 predictions. Optical defect
              patterns (Model 1) indicate physical cell surface anomalies, but root causes must be verified
              using engineering telemetry, fabrication logs, or destructive testing.
              <strong> Optical defect classifications are never automatically converted into root causes.</strong>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Inspection Selection & Defect Context (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Inspection Selector */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ScanLine className="h-4 w-4 text-primary" />
                Target Inspection Record
              </h3>
              {activeInspection && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3" /> Valid Inspection
                </span>
              )}
            </div>

            {/* Quick Picker from Recent Inspections */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Select from Database Inspections
              </label>
              <select
                value={inspectionId}
                onChange={(e) => {
                  setInspectionId(e.target.value);
                  handleResetForm();
                }}
                disabled={isHistoryLoading}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-success"
              >
                <option value="">-- Choose an inspection from database ({historyList.length} available) --</option>
                {historyList.map((item: any) => {
                  const id = item.inspectionId || item.id;
                  return (
                    <option key={id} value={id}>
                      {item.sourceFilename || "Wafer Scan"} ({id.slice(0, 8)}...) — {item.detectionsCount ?? item.defectCount ?? 0} defects
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Manual UUID Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Or Input Inspection UUID Directly
              </label>
              <div className="relative">
                <Input
                  value={inspectionId}
                  onChange={(e) => setInspectionId(e.target.value.trim())}
                  placeholder="e.g. 84218e7c-87d0-424a-9ebf-a185459345e8"
                  className="font-mono text-xs pr-8"
                />
                {isDetailLoading && (
                  <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-slate-400" />
                )}
              </div>
            </div>

            {/* Active Inspection Summary */}
            {activeInspection ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Source Image:</span>
                  <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                    {(activeInspection as any).sourceFilename}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Inspection Time:</span>
                  <span className="font-mono text-xs text-slate-700">
                    {new Date((activeInspection as any).createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Manufacturing Batch:</span>
                  <span className="font-mono text-xs text-slate-800 font-semibold">
                    {(activeInspection as any).batchId || (
                      <span className="text-amber-600 font-normal">Unlinked (Batch ID Missing)</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Fabrication Machine:</span>
                  <span className="font-mono text-xs text-slate-800">
                    {(activeInspection as any).machineId || (
                      <span className="text-slate-400 font-normal">Unspecified</span>
                    )}
                  </span>
                </div>
              </div>
            ) : inspectionId && !isDetailLoading ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  {detailError?.message?.includes("UNAUTHORIZED")
                    ? "Session expired. Sign in to view inspection details."
                    : detailError?.message?.includes("FORBIDDEN")
                    ? "Access forbidden: Inspection belongs to another user account."
                    : "Inspection UUID not found in database. Please check the identifier."}
                </span>
              </div>
            ) : null}
          </div>

          {/* Model 1 Detected Physical Defects */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-success" />
                Detected Surface Defects (Model 1 Context)
              </h3>
              <span className="text-xs font-semibold text-slate-500">
                {detections.length} {detections.length === 1 ? "defect" : "defects"}
              </span>
            </div>

            {detections.length === 0 ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                <p className="text-xs text-slate-500">
                  {inspectionId
                    ? "No optical defects recorded for this cell inspection (Nominal wafer)."
                    : "Select an inspection to view detected defect classes."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  Select specific defect to link this root cause to, or leave unselected to apply to entire wafer:
                </p>
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {detections.map((det: any, idx: number) => {
                    const meta = getDefectMeta(det.classIndex ?? det.class_id ?? 0);
                    const isSelected = selectedDefectId === (det.id ?? idx);
                    return (
                      <div
                        key={det.id ?? idx}
                        onClick={() => setSelectedDefectId(isSelected ? null : (det.id ?? idx))}
                        className={`cursor-pointer rounded-xl border p-2.5 transition-all text-xs flex items-center justify-between ${
                          isSelected
                            ? "border-success bg-success/5 shadow-sm"
                            : "border-slate-100 bg-slate-50 hover:bg-slate-100/70"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: meta.color }}
                          />
                          <div>
                            <span className="font-semibold text-slate-800">{meta.label}</span>
                            <span className="ml-2 font-mono text-xs text-slate-500">
                              {(det.confidence * 100).toFixed(1)}% conf
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-slate-400">
                          #{idx + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Expert Annotation Form (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Microscope className="h-5 w-5 text-success" />
                Expert Ground-Truth Annotation
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Assign an expert-verified root cause from the standard 9-class manufacturing taxonomy.
                Persists directly to database failure analysis records.
              </p>
            </div>

            {/* Taxonomy Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                1. Select Confirmed Root Cause Class <span className="text-red-500">*</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {ROOT_CAUSE_TAXONOMY.map((cause) => {
                  const meta = ROOT_CAUSE_DETAILS[cause];
                  const isSelected = selectedCause === cause;
                  return (
                    <div
                      key={cause}
                      onClick={() => setSelectedCause(cause)}
                      className={`cursor-pointer rounded-xl border p-3 transition-all text-left flex flex-col justify-between ${
                        isSelected
                          ? "border-success bg-success/10 ring-2 ring-success/30"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-bold text-xs text-slate-900 leading-tight">
                            {meta.label}
                          </span>
                          <span
                            className={`rounded-full px-1.5 py-0.2 text-xs font-semibold uppercase tracking-wider ${
                              meta.category === "process"
                                ? "bg-amber-100 text-amber-800"
                                : meta.category === "equipment"
                                ? "bg-blue-100 text-blue-800"
                                : meta.category === "material"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-slate-100 text-slate-800"
                            }`}
                          >
                            {meta.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {meta.description}
                        </p>
                      </div>
                      <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between">
                        <span className="font-mono text-xs text-slate-400">{cause}</span>
                        {isSelected && (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Verification Confidence Level */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                2. Verification Confidence & Cause Status <span className="text-red-500">*</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setConfidenceLevel("confirmed")}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    confidenceLevel === "confirmed"
                      ? "border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-600/20"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Verified Cause
                  </div>
                  <p className="text-xs text-emerald-700 mt-1 leading-snug">
                    Confirmed via physical cross-section, SEM, or furnace telemetry correlation.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setConfidenceLevel("probable")}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    confidenceLevel === "probable"
                      ? "border-amber-600 bg-amber-50/70 ring-2 ring-amber-600/20"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Probable Cause
                  </div>
                  <p className="text-xs text-amber-700 mt-1 leading-snug">
                    Strong correlation with process drift, awaiting destructive lab test confirmation.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setConfidenceLevel("investigative")}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    confidenceLevel === "investigative"
                      ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-blue-900">
                    <Info className="h-4 w-4 text-blue-600" />
                    Investigative Suspect
                  </div>
                  <p className="text-xs text-blue-700 mt-1 leading-snug">
                    Suspected cause under active investigation by QA failure analysis lab.
                  </p>
                </button>
              </div>
            </div>

            {/* Supporting Physical & Telemetry Evidence */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                3. Supporting Physical Evidence Factors <span className="text-red-500">* (Select at least 1)</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUPPORTING_EVIDENCE_OPTIONS.map((opt) => {
                  const checked = selectedEvidence.includes(opt.id);
                  return (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-2 rounded-xl border p-2.5 cursor-pointer text-xs transition-colors ${
                        checked
                          ? "border-success bg-success/5 text-slate-900 font-semibold"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEvidence(opt.id)}
                        className="rounded border-slate-300 text-success focus:ring-success"
                      />
                      <span>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Investigation Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                4. Forensic Investigation Notes & Justification <span className="text-red-500">*</span>
              </label>
              <textarea
                value={investigationNotes}
                onChange={(e) => setInvestigationNotes(e.target.value)}
                rows={3}
                placeholder="Detail physical inspection observations, furnace zone logs, metallization paste lot numbers, or operator interview notes..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-success"
              />
            </div>

            {/* Reviewer Identity & Timestamp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Reviewer Identity <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    placeholder="e.g. Dr. H. Schmidt, Senior Quality Metallurgist"
                    className="text-xs pl-8"
                  />
                  <UserCheck className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Verification Timestamp (UTC)
                </label>
                <div className="relative">
                  <Input
                    value={new Date().toISOString()}
                    readOnly
                    className="text-xs font-mono bg-slate-50 pl-8 text-slate-600"
                  />
                  <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Status Message */}
            {statusMessage && (
              <div
                className={`rounded-xl border p-3.5 text-xs ${
                  statusMessage.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : statusMessage.type === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                <div className="flex items-start gap-2">
                  {statusMessage.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  ) : statusMessage.type === "warning" ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <div className="font-semibold">{statusMessage.text}</div>
                    {statusMessage.details && (
                      <div className="mt-1 text-xs opacity-90">{statusMessage.details}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetForm}
                className="text-slate-600"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Clear Form
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting || !inspectionId || !selectedCause}
                className="bg-success hover:opacity-90 text-white font-semibold text-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Persisting Ground Truth...
                  </>
                ) : (
                  <>
                    <FileCheck className="h-4 w-4 mr-1.5" />
                    Commit Confirmed Root Cause
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Real Confirmed Database Annotations from SQLite via trpc.rootCause.annotations */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-emerald-600" />
                Persisted Ground-Truth Annotations in Database ({dbAnnotations?.length ?? 0})
              </h4>
              {isAnnotationsLoading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
              )}
            </div>

            {dbAnnotations && dbAnnotations.length > 0 ? (
              <div className="space-y-2">
                {dbAnnotations.map((ann: any) => (
                  <div
                    key={ann.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-slate-900">
                        {ROOT_CAUSE_DETAILS[ann.confirmedCause as RootCauseTaxonomyClass]?.label || ann.confirmedCause}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
                          ann.confidenceLevel === "confirmed"
                            ? "bg-emerald-100 text-emerald-800"
                            : ann.confidenceLevel === "probable"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {ann.confidenceLevel}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 font-mono flex flex-wrap gap-x-4 gap-y-1">
                      <span>Inspection: {ann.inspectionId.slice(0, 8)}...</span>
                      <span>Verified by: {ann.verifiedBy}</span>
                      <span>Timestamp: {new Date(ann.verifiedAt).toLocaleString()}</span>
                    </div>

                    {ann.investigationNotes && (
                      <p className="text-xs text-slate-600 border-t border-slate-200 pt-1.5 mt-1 whitespace-pre-wrap">
                        {ann.investigationNotes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-4 bg-slate-50 rounded-xl">
                {inspectionId
                  ? "No expert annotations currently recorded in database for this inspection record."
                  : "Select an inspection to view persisted ground-truth annotations."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
