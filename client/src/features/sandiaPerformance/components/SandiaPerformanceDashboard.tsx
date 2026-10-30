/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * Main Integrated Industrial Dashboard & Operational View
 * 
 * STRICT ARCHITECTURAL CONVENTIONS:
 * - Employs SolarVision AI design system (yellow/gold #F2B941, deep slate #0B0909, light #EBE8D2).
 * - Full schema-driven prediction form.
 * - Displays genuine model results, latencies, and limitations.
 * - History view forward-compatible with Agent 2's tRPC backend.
 */

import React, { useState } from "react";
import {
  Activity,
  BarChart2,
  Calendar,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  History,
  Layers,
  Play,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sun,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DynamicPredictionForm } from "./DynamicPredictionForm";
import { ModelEvaluationSection } from "./ModelEvaluationSection";
import { ModelStatusCard } from "./ModelStatusCard";
import { ModelVariantsRoadmapCard } from "./ModelVariantsRoadmapCard";
import { PredictionHistoryTable } from "./PredictionHistoryTable";
import { PredictionResultDisplay } from "./PredictionResultDisplay";
import { useSandiaModel } from "../hooks/useSandiaModel";
import { useSandiaPrediction } from "../hooks/useSandiaPrediction";
import type { ModelVariantId, SandiaPredictionInput } from "../types";

export function SandiaPerformanceDashboard() {
  const {
    status,
    schema,
    schemaStatus,
    targetDefinition,
    sampleInput,
    metadata,
    loading,
    error: statusError,
    refresh,
  } = useSandiaModel();

  const {
    isSubmitting,
    result,
    error: predError,
    limitations,
    executePrediction,
    reset,
  } = useSandiaPrediction();

  const [activeSubTab, setActiveSubTab] = useState<string>("prediction");
  const [selectedVariant, setSelectedVariant] = useState<ModelVariantId>("sandia_tabular");
  const [lastPredTimestamp, setLastPredTimestamp] = useState<string>("");

  const handlePredictSubmit = async (input: SandiaPredictionInput) => {
    const res = await executePrediction(input);
    if (res && res.prediction) {
      setLastPredTimestamp(new Date().toISOString());
    }
    return res;
  };

  return (
    <div className="space-y-8">
      {/* Top Model Status & Artifact Provenance Card */}
      <ModelStatusCard
        status={status}
        loading={loading}
        onRefresh={refresh}
        isRunning={isSubmitting}
      />

      {/* Internal Navigation Tabs for Sandia Feature */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <div className="border-b border-slate-200">
          <TabsList className="h-12 w-full justify-start rounded-none bg-transparent p-0 gap-2 sm:gap-6 overflow-x-auto">
            <TabsTrigger
              value="prediction"
              className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-3 sm:px-4 pb-3 pt-2 text-xs font-semibold text-slate-500 transition-all hover:text-slate-900 data-[state=active]:border-sapphire data-[state=active]:text-sapphire data-[state=active]:shadow-none"
            >
              <Zap className="mr-2 h-4 w-4 text-sapphire" />
              Electrical Inference & Telemetry
            </TabsTrigger>
            <TabsTrigger
              value="evaluation"
              className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-3 sm:px-4 pb-3 pt-2 text-xs font-semibold text-slate-500 transition-all hover:text-slate-900 data-[state=active]:border-sapphire data-[state=active]:text-sapphire data-[state=active]:shadow-none"
            >
              <BarChart2 className="mr-2 h-4 w-4 text-slate-700" />
              Model Evaluation
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-3 sm:px-4 pb-3 pt-2 text-xs font-semibold text-slate-500 transition-all hover:text-slate-900 data-[state=active]:border-sapphire data-[state=active]:text-sapphire data-[state=active]:shadow-none"
            >
              <History className="mr-2 h-4 w-4 text-slate-700" />
              Prediction History
            </TabsTrigger>
            <TabsTrigger
              value="variants"
              className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-3 sm:px-4 pb-3 pt-2 text-xs font-semibold text-slate-500 transition-all hover:text-slate-900 data-[state=active]:border-sapphire data-[state=active]:text-sapphire data-[state=active]:shadow-none"
            >
              <Layers className="mr-2 h-4 w-4 text-purple-600" />
              Model Variants & Roadmap
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Inference & Dynamic Form */}
        <TabsContent value="prediction" className="mt-6 space-y-6">
          <DynamicPredictionForm
            schema={schema}
            schemaStatus={schemaStatus}
            modelStatus={status}
            sampleInput={sampleInput}
            targetDefinition={targetDefinition}
            onSubmit={handlePredictSubmit}
            isSubmitting={isSubmitting}
          />

          {/* Results Presentation */}
          <PredictionResultDisplay
            result={result}
            error={predError}
            limitations={limitations}
          />
        </TabsContent>

        {/* Tab 2: Model Evaluation Section */}
        <TabsContent value="evaluation" className="mt-6 space-y-6">
          <ModelEvaluationSection
            metrics={(metadata as any)?.evaluationMetrics}
            isModelReady={Boolean(status?.is_ready)}
          />
        </TabsContent>

        {/* Tab 3: Prediction History Interface */}
        <TabsContent value="history" className="mt-6 space-y-6">
          <PredictionHistoryTable lastPredictionTimestamp={lastPredTimestamp} />
        </TabsContent>

        {/* Tab 4: Future Model Variants Roadmap */}
        <TabsContent value="variants" className="mt-6 space-y-6">
          <ModelVariantsRoadmapCard
            selectedVariant={selectedVariant}
            onSelectVariant={setSelectedVariant}
            isTabularReady={Boolean(status?.is_ready)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
