/**
 * SolarVision AI — Model 4: Artifact Provenance & Academic Citation Modal
 */

import React from "react";
import {
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  ExternalLink,
  Layers,
  ShieldCheck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VERIFIED_BENCHMARK_METADATA } from "../benchmarkData";

interface ArtifactProvenanceModalProps {
  open: boolean;
  onClose: () => void;
}

export function ArtifactProvenanceModal({
  open,
  onClose,
}: ArtifactProvenanceModalProps) {
  const [copied, setCopied] = React.useState(false);
  const meta = VERIFIED_BENCHMARK_METADATA;

  if (!open) return null;

  const handleCopyCitation = () => {
    navigator.clipboard.writeText(meta.datasetCitation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sapphire text-dusty-pink">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Dataset Provenance & Certification
              </span>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs">
                Audited
              </Badge>
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              AI4I 2020 Predictive Maintenance
            </h3>
          </div>
        </div>

        {/* Provenance Metadata Table */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 text-xs">
          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500 font-medium">Dataset Registry</span>
            <span className="font-semibold text-slate-800">UCI Machine Learning Repository</span>
          </div>

          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500 font-medium">Permanent Digital Object Identifier (DOI)</span>
            <a
              href={`https://doi.org/${meta.datasetDoi}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono font-semibold text-emerald-700 hover:underline flex items-center gap-1"
            >
              {meta.datasetDoi}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500 font-medium">Author / Originating Institution</span>
            <span className="font-semibold text-slate-800">{meta.datasetAuthor}</span>
          </div>

          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500 font-medium">Intellectual Property License</span>
            <span className="font-semibold text-slate-800">{meta.datasetLicense}</span>
          </div>

          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500 font-medium">Model Framework & Baseline</span>
            <span className="font-mono font-semibold text-slate-800">{meta.framework}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Classification Paradigm</span>
            <span className="font-semibold text-slate-800">
              Operating-Condition Failure Assessment (Not RUL)
            </span>
          </div>
        </div>

        {/* Academic Citation Block */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-sapphire" />
              Official Scientific Citation (IEEE Format)
            </label>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyCitation}
              className="h-7 gap-1.5 text-xs rounded-lg"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 text-slate-400" />
                  Copy Citation
                </>
              )}
            </Button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-100/80 p-3 font-mono text-xs leading-relaxed text-slate-800">
            {meta.datasetCitation}
          </div>
        </div>

        {/* Model Limitations List */}
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
            Audited Benchmark Boundaries & Limitations:
          </p>
          <ul className="space-y-1.5 text-xs text-slate-600">
            {meta.limitations.map((lim, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                <span>{lim}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Modal Action */}
        <div className="mt-6 flex justify-end">
          <Button
            onClick={onClose}
            className="rounded-xl bg-[#965660] text-white text-xs px-5 hover:bg-[#7E454E]"
          >
            Close Provenance Details
          </Button>
        </div>
      </div>
    </div>
  );
}
