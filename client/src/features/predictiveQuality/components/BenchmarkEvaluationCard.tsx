/**
 * SolarVision AI — Model 3: Predictive Quality Monitoring
 * UCI SECOM Benchmark Evaluation Dashboard & Held-out Metrics Card
 */

import React, { useState } from "react";
import {
  Activity,
  Award,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Database,
  ExternalLink,
  FileCode,
  FileText,
  Info,
  Layers,
  Percent,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { VERIFIED_BENCHMARK_METADATA } from "../benchmarkData";
import { ArtifactProvenanceModal } from "./ArtifactProvenanceModal";

export function BenchmarkEvaluationCard() {
  const [modalOpen, setModalOpen] = useState(false);
  const meta = VERIFIED_BENCHMARK_METADATA;
  const m = meta.metrics;

  return (
    <div className="space-y-6">
      {/* Overview & Dataset Provenance Header */}
      <Card className="rounded-3xl border border-border bg-surface p-6 shadow-xs sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-sapphire text-white text-xs font-mono tracking-wider uppercase shadow-xs">
                {meta.modelVersion}
              </Badge>
              <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-semibold">
                Evaluation Verified
              </Badge>
              <span className="text-xs text-text-3 font-mono">
                SHA-256: {meta.sha256Hash.slice(0, 12)}...
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-sapphire sm:text-2xl">
              {meta.modelName.replace(/_/g, " ")}
            </h2>
            <p className="text-xs text-text-2 sm:text-sm max-w-2xl">
              Genuine supervised benchmark trained on the official UCI Machine Learning Repository SECOM dataset. Evaluates high-dimensional sparse in-line sensor signals for wafer yield excursions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:self-start lg:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(true)}
              className="gap-2 rounded-xl border-border text-xs font-semibold text-text hover:bg-surface-subtle hover:border-sapphire/40"
            >
              <FileCode className="h-3.5 w-3.5 text-sapphire" />
              Artifact Provenance
            </Button>
            <a
              href="https://archive.ics.uci.edu/dataset/179/secom"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-subtle px-3 py-2 text-xs font-semibold text-text hover:bg-surface transition-colors"
            >
              <span>UCI Repo #{meta.datasetDoi.split("/").pop()}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Dataset Breakdown Grid */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-6 sm:grid-cols-4">
          <div className="rounded-2xl border border-border bg-surface-subtle p-4">
            <div className="flex items-center gap-2 text-text-3 text-xs font-medium">
              <Database className="h-4 w-4 text-sapphire" />
              <span>Total Wafer Runs</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-sapphire">
              {meta.totalSamples.toLocaleString()}
            </p>
            <p className="text-xs text-text-3 mt-0.5">
              1,096 train / 235 val / 236 test
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-surface-subtle p-4">
            <div className="flex items-center gap-2 text-text-3 text-xs font-medium">
              <Layers className="h-4 w-4 text-sapphire" />
              <span>Sensor Channels</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-sapphire">
              590 <span className="text-xs font-normal text-text-3">→ 444</span>
            </p>
            <p className="text-xs text-text-3 mt-0.5">
              116 zero-var, 28 NaN pruned
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-surface-subtle p-4">
            <div className="flex items-center gap-2 text-text-3 text-xs font-medium">
              <Scale className="h-4 w-4 text-terracotta" />
              <span>Class Imbalance</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-terracotta">
              {meta.classDistribution.imbalanceRatio} : 1
            </p>
            <p className="text-xs text-text-3 mt-0.5">
              1,463 Pass vs 104 Fail
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-surface-subtle p-4">
            <div className="flex items-center gap-2 text-text-3 text-xs font-medium">
              <Award className="h-4 w-4 text-sapphire" />
              <span>Decision Threshold</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-sapphire font-mono">
              τ* = {m.thresholdUsed}
            </p>
            <p className="text-xs text-text-3 mt-0.5">
              Cost-sensitive failure recall
            </p>
          </div>
        </div>

        {/* Pass/Fail Class Distribution Visual Bar */}
        <div className="mt-6 rounded-2xl border border-border bg-surface-subtle p-4">
          <div className="flex items-center justify-between text-xs font-medium text-text-2 mb-2">
            <span>Pass / Fail Class Distribution (Rare Event Challenge)</span>
            <span className="font-mono text-text-3">
              {meta.classDistribution.passCount} Pass ({meta.classDistribution.passPct}%) | {meta.classDistribution.failCount} Fail ({meta.classDistribution.failPct}%)
            </span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-border">
            <div
              className="bg-emerald-600 transition-all"
              style={{ width: `${meta.classDistribution.passPct}%` }}
              title={`Pass: ${meta.classDistribution.passPct}%`}
            />
            <div
              className="bg-terracotta transition-all"
              style={{ width: `${meta.classDistribution.failPct}%` }}
              title={`Fail: ${meta.classDistribution.failPct}%`}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-text-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <span>Conforming Wafers (93.36%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-terracotta" />
              <span>Scrap Excursions (6.64%)</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Held-Out Test Evaluation Metrics Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Metric 1: Balanced Accuracy */}
        <Card className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Balanced Accuracy
            </p>
            <Badge className="bg-surface-subtle text-text-2 border border-border text-xs font-mono">
              Held-Out Test
            </Badge>
          </div>
          <p className="mt-3 text-3xl font-bold text-sapphire font-mono">
            {(m.balancedAccuracy * 100).toFixed(1)}%
          </p>
          <div className="mt-3 flex items-center justify-between text-xs text-text-3">
            <span>Raw Accuracy: {(m.accuracy * 100).toFixed(1)}%</span>
            <span>Pass Spec: {(m.specificityPass * 100).toFixed(1)}%</span>
          </div>
          <p className="mt-2 text-xs text-text-3 leading-snug">
            Arithmetic mean of sensitivity and specificity, correcting for extreme class imbalance.
          </p>
        </Card>

        {/* Metric 2: Failure Recall & Precision */}
        <Card className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Failure Recall (Sensitivity)
            </p>
            <Badge className="bg-warning-tint text-warning border-warning-border text-xs font-mono">
              Cost-Sensitive
            </Badge>
          </div>
          <p className="mt-3 text-3xl font-bold text-terracotta font-mono">
            {(m.recallFail * 100).toFixed(1)}%
          </p>
          <div className="mt-3 flex items-center justify-between text-xs text-text-3">
            <span>Precision: {(m.precisionFail * 100).toFixed(1)}%</span>
            <span>Fail F1: {m.f1Fail.toFixed(3)}</span>
          </div>
          <p className="mt-2 text-xs text-text-3 leading-snug">
            Captures 44.4% of yield scrap wafers at τ = 0.07 threshold (vs 0.0% with standard 0.50 cutoff).
          </p>
        </Card>

        {/* Metric 3: Discrimination (ROC-AUC & PR-AUC) */}
        <Card className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Discrimination Metrics
            </p>
            <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-mono">
              Ranking
            </Badge>
          </div>
          <div className="mt-3 flex items-baseline gap-4">
            <div>
              <p className="text-xs text-text-3">ROC-AUC</p>
              <p className="text-2xl font-bold text-sapphire font-mono">{m.rocAuc.toFixed(3)}</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-xs text-text-3">PR-AUC</p>
              <p className="text-2xl font-bold text-sapphire font-mono">{m.prAuc.toFixed(4)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-text-3 leading-snug">
            Chronological split temporal drift accounts for the drop from 0.821 (stratified) to 0.637 (chronological).
          </p>
        </Card>

        {/* Metric 4: Calibration & Brier Score */}
        <Card className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Calibration & Brier Score
            </p>
            <Badge className="bg-info-tint text-info border-info-border text-xs font-mono">
              Probability
            </Badge>
          </div>
          <div className="mt-3 flex items-baseline gap-4">
            <div>
              <p className="text-xs text-text-3">Brier Score</p>
              <p className="text-2xl font-bold text-sapphire font-mono">{m.brierScore.toFixed(4)}</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-xs text-text-3">ECE Gap</p>
              <p className="text-2xl font-bold text-sapphire font-mono">{m.ece.toFixed(4)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-text-3 leading-snug">
            Expected Calibration Error (ECE) is 3.04%, indicating well-calibrated posterior probabilities without softmax artifacts.
          </p>
        </Card>

        {/* Metric 5: Macro & Weighted F1 */}
        <Card className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-3">
              F1 Harmonic Means
            </p>
            <Badge className="bg-surface-subtle text-text-2 border border-border text-xs font-mono">
              Aggregate
            </Badge>
          </div>
          <div className="mt-3 flex items-baseline gap-4">
            <div>
              <p className="text-xs text-text-3">Macro F1</p>
              <p className="text-2xl font-bold text-sapphire font-mono">{m.macroF1.toFixed(3)}</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-xs text-text-3">Weighted F1</p>
              <p className="text-2xl font-bold text-sapphire font-mono">{m.weightedF1.toFixed(3)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-text-3 leading-snug">
            Pass F1 = {m.f1Pass.toFixed(3)} reflects strong specificity on conforming silicon runs.
          </p>
        </Card>

        {/* Metric 6: Benchmark Constraints */}
        <Card className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Operational Scope
            </p>
            <Badge className="bg-warning-tint text-warning border-warning-border text-xs">
              Microchip Only
            </Badge>
          </div>
          <p className="mt-3 text-sm font-bold text-sapphire">
            Freescale Semiconductor Fab
          </p>
          <p className="mt-1 text-xs text-text-3">
            590 anonymized channels recorded over 3 months in 2008.
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-warning font-medium">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>Unsuitable for solar-cell lines</span>
          </div>
        </Card>
      </div>

      <ArtifactProvenanceModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        metadata={meta}
      />
    </div>
  );
}
