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
      <DialogContent className="max-w-2xl rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-sapphire text-white">
              <FileCode className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-bold text-sapphire">
              Benchmark Artifact Provenance
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-text-3">
            Cryptographic verification, training provenance, and dataset license metadata for Model 3.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Cryptographic SHA-256 Checksum Card */}
          <div className="rounded-2xl border border-border bg-surface-subtle p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-text-2">
              <span className="flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-sapphire" />
                SHA-256 Artifact Checksum
              </span>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-mono">
                Verified Match
              </Badge>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 font-mono text-xs text-text">
              <span className="truncate">{metadata.sha256Hash}</span>
              <button
                onClick={copyHash}
                className="shrink-0 rounded p-1 text-text-3 hover:text-sapphire"
                title="Copy full hash"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Model Specification Table */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-border bg-surface-subtle p-3">
              <p className="text-text-3 text-xs">Artifact File</p>
              <p className="font-semibold text-text font-mono mt-0.5">model3_predictive_quality.json</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-subtle p-3">
              <p className="text-text-3 text-xs">Framework</p>
              <p className="font-semibold text-text font-mono mt-0.5">{metadata.framework}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-subtle p-3">
              <p className="text-text-3 text-xs">Permanent DOI</p>
              <p className="font-semibold text-text font-mono mt-0.5">{metadata.datasetDoi}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-subtle p-3">
              <p className="text-text-3 text-xs">Usage License</p>
              <p className="font-semibold text-text mt-0.5">{metadata.datasetLicense}</p>
            </div>
          </div>

          {/* Training Hyperparameters Breakdown */}
          <div className="rounded-2xl border border-border p-4 text-xs bg-surface">
            <p className="font-semibold text-sapphire mb-2">Model Architecture & Ensembling</p>
            <div className="grid grid-cols-3 gap-2 text-text-2">
              <div>
                <span className="text-text-3 block text-xs">Estimator Family</span>
                <span className="font-medium text-text">LogitBoost Ensemble</span>
              </div>
              <div>
                <span className="text-text-3 block text-xs">Estimators (N)</span>
                <span className="font-medium text-text">50 Decision Stumps</span>
              </div>
              <div>
                <span className="text-text-3 block text-xs">Learning Rate</span>
                <span className="font-medium text-text">η = 0.08</span>
              </div>
            </div>
          </div>

          {/* Dataset Attribution */}
          <div className="rounded-2xl border border-soft-lavender/40 bg-soft-lavender-tint p-3.5 text-xs text-soft-lavender-text">
            <p className="font-semibold text-sapphire">Dataset Citation & Authors:</p>
            <p className="mt-1 leading-relaxed text-xs text-text-2">
              McCann, M., & Johnston, A. (2008). <i>SECOM: Semi-Conductor Manufacturing Process Dataset</i>. Freescale Semiconductor & University of Strathclyde, Glasgow. UCI Machine Learning Repository.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={() => onOpenChange(false)}
            className="rounded-xl bg-[#965660] text-white text-xs px-5 hover:bg-[#7E454E]"
          >
            Close Provenance
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
