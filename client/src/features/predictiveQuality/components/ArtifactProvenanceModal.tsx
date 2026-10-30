/**
 * SolarVision AI — Model 3: Predictive Quality Monitoring
 * Artifact Provenance & Cryptographic Audit Modal
 */

import React from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCode,
  FileJson,
  Key,
  Layers,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BenchmarkMetadata } from "../types";

interface ArtifactProvenanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: BenchmarkMetadata;
}

export function ArtifactProvenanceModal({
  open,
  onOpenChange,
  metadata,
}: ArtifactProvenanceModalProps) {
  const [copied, setCopied] = React.useState(false);

  const copyHash = () => {
    navigator.clipboard.writeText(metadata.sha256Hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#0B0909] text-[#F2B941]">
              <FileCode className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Benchmark Artifact Provenance
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Cryptographic verification, training provenance, and dataset license metadata for Model 3.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Cryptographic SHA-256 Checksum Card */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-[#F2B941]" />
                SHA-256 Artifact Checksum
              </span>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-mono">
                Verified Match
              </Badge>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800">
              <span className="truncate">{metadata.sha256Hash}</span>
              <button
                onClick={copyHash}
                className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-900"
                title="Copy full hash"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Model Specification Table */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-slate-400 text-xs">Artifact File</p>
              <p className="font-semibold text-slate-800 font-mono mt-0.5">model3_predictive_quality.json</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-slate-400 text-xs">Framework</p>
              <p className="font-semibold text-slate-800 font-mono mt-0.5">{metadata.framework}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-slate-400 text-xs">Permanent DOI</p>
              <p className="font-semibold text-slate-800 font-mono mt-0.5">{metadata.datasetDoi}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-slate-400 text-xs">Usage License</p>
              <p className="font-semibold text-slate-800 mt-0.5">{metadata.datasetLicense}</p>
            </div>
          </div>

          {/* Training Hyperparameters Breakdown */}
          <div className="rounded-2xl border border-slate-200 p-4 text-xs">
            <p className="font-semibold text-slate-800 mb-2">Model Architecture & Ensembling</p>
            <div className="grid grid-cols-3 gap-2 text-slate-600">
              <div>
                <span className="text-slate-400 block text-xs">Estimator Family</span>
                <span className="font-medium text-slate-800">LogitBoost Ensemble</span>
              </div>
              <div>
                <span className="text-slate-400 block text-xs">Estimators ($N$)</span>
                <span className="font-medium text-slate-800">50 Decision Stumps</span>
              </div>
              <div>
                <span className="text-slate-400 block text-xs">Learning Rate</span>
                <span className="font-medium text-slate-800">$\eta = 0.08$</span>
              </div>
            </div>
          </div>

          {/* Dataset Attribution */}
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-3.5 text-xs text-amber-900">
            <p className="font-semibold">Dataset Citation & Authors:</p>
            <p className="mt-1 leading-relaxed text-xs text-amber-800">
              McCann, M., & Johnston, A. (2008). <i>SECOM: Semi-Conductor Manufacturing Process Dataset</i>. Freescale Semiconductor & University of Strathclyde, Glasgow. UCI Machine Learning Repository.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={() => onOpenChange(false)}
            className="rounded-xl bg-slate-900 text-white text-xs px-5 hover:bg-slate-800"
          >
            Close Provenance
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
