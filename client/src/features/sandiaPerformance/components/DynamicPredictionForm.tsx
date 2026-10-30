/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * Dynamic Feature Schema-Driven Prediction Form
 * 
 * STRICT COMPLIANCE:
 * - Dynamically renders fields from trainer's FeatureSchemaManifest.
 * - Zero hardcoding of assumed features.
 * - Validates required fields and physical sensor bounds (min_value, max_value).
 * - Honest unavailable state when feature schema is pending trainer handoff.
 */

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  FileDown,
  Info,
  Loader2,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  FeatureSchemaManifest,
  FeatureSpec,
  SandiaModelStatusResponse,
  SandiaPredictionInput,
  TargetDefinitionManifest,
} from "../types";

interface DynamicPredictionFormProps {
  schema: FeatureSchemaManifest | null;
  schemaStatus: "loaded" | "pending_trainer" | "loading" | "error";
  modelStatus: SandiaModelStatusResponse | null;
  sampleInput: Record<string, any> | null;
  targetDefinition: TargetDefinitionManifest | null;
  onSubmit: (input: SandiaPredictionInput) => Promise<any>;
  isSubmitting: boolean;
}

export function DynamicPredictionForm({
  schema,
  schemaStatus,
  modelStatus,
  sampleInput,
  targetDefinition,
  onSubmit,
  isSubmitting,
}: DynamicPredictionFormProps) {
  const [moduleId, setModuleId] = useState<string>("PV-MOD-2026-X1");
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const isModelReady = Boolean(modelStatus?.is_ready);
  const features = schema?.features || [];

  // Initialize defaults from schema or sample input
  useEffect(() => {
    if (features.length > 0) {
      const initial: Record<string, any> = {};
      features.forEach((feat) => {
        if (sampleInput && sampleInput[feat.name] !== undefined) {
          initial[feat.name] = sampleInput[feat.name];
        } else if (sampleInput?.features && sampleInput.features[feat.name] !== undefined) {
          initial[feat.name] = sampleInput.features[feat.name];
        } else {
          initial[feat.name] = "";
        }
      });
      setFieldValues(initial);
    }
  }, [schema, sampleInput]);

  const handleFieldChange = (name: string, value: string, spec: FeatureSpec) => {
    const updated = { ...fieldValues, [name]: value };
    setFieldValues(updated);

    // Validate on change
    const errors = { ...fieldErrors };
    if (spec.required && (value === "" || value === undefined || value === null)) {
      errors[name] = `Feature '${spec.name}' is required by model contract.`;
    } else if (spec.type === "float" || spec.type === "int") {
      const num = Number(value);
      if (value !== "" && isNaN(num)) {
        errors[name] = `Must be a valid numeric ${spec.type}.`;
      } else if (value !== "") {
        if (spec.min_value !== undefined && spec.min_value !== null && num < spec.min_value) {
          errors[name] = `Value ${num} is below physical lower bound of ${spec.min_value} ${spec.unit || ""}.`;
        } else if (spec.max_value !== undefined && spec.max_value !== null && num > spec.max_value) {
          errors[name] = `Value ${num} exceeds physical upper bound of ${spec.max_value} ${spec.unit || ""}.`;
        } else {
          delete errors[name];
        }
      } else {
        delete errors[name];
      }
    } else {
      delete errors[name];
    }
    setFieldErrors(errors);
  };

  const handleLoadSample = () => {
    if (!sampleInput) return;
    const sampleFeatures = sampleInput.features || sampleInput;
    const updated: Record<string, any> = { ...fieldValues };
    features.forEach((feat) => {
      if (sampleFeatures[feat.name] !== undefined) {
        updated[feat.name] = sampleFeatures[feat.name];
      }
    });
    setFieldValues(updated);
    setFieldErrors({});
    setGeneralError(null);
  };

  const handleReset = () => {
    const cleared: Record<string, any> = {};
    features.forEach((feat) => {
      cleared[feat.name] = "";
    });
    setFieldValues(cleared);
    setFieldErrors({});
    setGeneralError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    // Validate all required features
    const errors: Record<string, string> = {};
    const parsedFeatures: Record<string, any> = {};

    features.forEach((feat) => {
      const rawVal = fieldValues[feat.name];
      if (feat.required && (rawVal === "" || rawVal === undefined || rawVal === null)) {
        errors[feat.name] = `Required feature '${feat.name}' cannot be empty.`;
      } else if (rawVal !== "" && rawVal !== undefined) {
        if (feat.type === "float" || feat.type === "int") {
          const num = Number(rawVal);
          if (isNaN(num)) {
            errors[feat.name] = "Must be a valid numeric value.";
          } else {
            if (feat.min_value !== null && feat.min_value !== undefined && num < feat.min_value) {
              errors[feat.name] = `Must be >= ${feat.min_value}`;
            }
            if (feat.max_value !== null && feat.max_value !== undefined && num > feat.max_value) {
              errors[feat.name] = `Must be <= ${feat.max_value}`;
            }
            parsedFeatures[feat.name] = feat.type === "int" ? Math.round(num) : num;
          }
        } else {
          parsedFeatures[feat.name] = String(rawVal);
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setGeneralError("Please resolve missing or out-of-bounds feature fields before submitting.");
      return;
    }

    const payload: SandiaPredictionInput = {
      module_id: moduleId.trim() || undefined,
      timestamp: new Date().toISOString(),
      features: parsedFeatures,
      metadata: {
        submittedFrom: "SolarVision-Model3-Sandia-Dashboard",
        schemaVersion: schema?.schema_version || "1.0.0",
      },
    };

    await onSubmit(payload);
  };

  // State A: Schema is pending trainer delivery
  if (schemaStatus === "pending_trainer" || (!schema && schemaStatus !== "loading")) {
    return (
      <Card className="rounded-3xl border border-dashed border-border bg-surface-subtle p-8 shadow-xs">
        <div className="flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-surface border border-border text-sapphire shadow-xs">
            <Sliders className="h-6 w-6" />
          </div>
          <Badge className="bg-surface text-sapphire border border-border text-xs font-mono">
            SCHEMA_PENDING_TRAINER
          </Badge>
          <h3 className="text-lg font-bold text-sapphire">
            Feature Input Form Awaiting Trainer Contract
          </h3>
          <p className="text-xs text-text-3 leading-relaxed">
            In accordance with zero-fabrication standards, feature input fields are generated dynamically from the trainer's <code className="font-mono text-sapphire bg-soft-lavender-tint px-1 py-0.5 rounded border border-soft-lavender/40">feature_schema.json</code>. No arbitrary sensor fields are assumed or hardcoded.
          </p>
          <div className="pt-2">
            <span className="text-xs text-text-3 font-mono">
              Listening for contract delivery at: /sandia-performance/schema
            </span>
          </div>
        </div>
      </Card>
    );
  }

  // State B: Schema is loading
  if (schemaStatus === "loading") {
    return (
      <Card className="rounded-3xl border border-border bg-surface p-8 shadow-xs">
        <div className="flex flex-col items-center justify-center py-10 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-sapphire" />
          <p className="text-xs font-semibold text-text-2">
            Discovering and parsing trainer feature contract...
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border border-border bg-surface p-6 shadow-xs sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-sapphire">
              Contract-Driven Telemetry Input
            </span>
            <Badge className="bg-surface-subtle text-text-2 border border-border text-xs font-mono">
              {features.length} Features Defined
            </Badge>
            {targetDefinition && (
              <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 text-xs font-mono">
                Target: {targetDefinition.target_name || (targetDefinition as any).targetName} ({targetDefinition.target_unit || (targetDefinition as any).targetUnit || "raw"})
              </Badge>
            )}
          </div>
          <h3 className="mt-1 text-lg font-bold tracking-tight text-sapphire">
            Dynamic Photovoltaic Operating Point Input
          </h3>
          <p className="text-xs text-text-3 mt-0.5">
            Schema version: {schema?.schema_version || "1.0.0"} • Dataset: {schema?.dataset_name || "Sandia PSEL"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {sampleInput && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLoadSample}
              className="gap-1.5 rounded-lg border-border text-xs font-semibold text-text hover:bg-surface-subtle"
            >
              <FileDown className="h-3.5 w-3.5 text-sapphire" />
              Load Sample Telemetry
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="gap-1 rounded-lg text-xs text-text-3 hover:text-sapphire"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Module Header Input */}
        <div className="rounded-xl bg-surface-subtle p-4 border border-border">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="module-id" className="text-xs font-semibold text-text-2">
                PV Module Identifier
              </Label>
              <Input
                id="module-id"
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                placeholder="e.g. PV-MOD-2026-X1"
                className="h-9 rounded-lg border-border bg-surface font-mono text-xs focus:ring-sapphire"
              />
              <p className="text-xs text-text-3">
                Optional array, string, or coupon identifier for audit tracking.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-text-2">Target Output Variable</Label>
              <div className="flex items-center h-9 px-3 rounded-lg border border-border bg-surface text-xs text-text-2 font-mono">
                {targetDefinition?.target_name || "Pmp (Maximum Power Output)"}{" "}
                <span className="ml-1 text-text-3">[{targetDefinition?.target_unit || "W"}]</span>
              </div>
              <p className="text-xs text-text-3">
                Dynamically mapped from trainer target_definition.json.
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Schema Feature Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feat) => {
            const val = fieldValues[feat.name] ?? "";
            const err = fieldErrors[feat.name];

            return (
              <div
                key={feat.name}
                className={`space-y-1.5 rounded-2xl border p-3.5 transition-colors ${
                  err ? "border-rose-300 bg-rose-50/40" : "border-border bg-surface hover:border-sapphire/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Label
                      htmlFor={`feat-${feat.name}`}
                      className="text-xs font-semibold text-text truncate"
                      title={feat.name}
                    >
                      {feat.name}
                      {feat.required && <span className="text-rose-600 ml-0.5">*</span>}
                    </Label>
                    {feat.description && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-text-3 shrink-0 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="text-xs max-w-xs">{feat.description}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>

                  {feat.unit && (
                    <Badge variant="outline" className="text-xs font-mono px-1.5 py-0 border-border bg-surface-subtle text-text-2">
                      {feat.unit}
                    </Badge>
                  )}
                </div>

                <div className="relative">
                  <Input
                    id={`feat-${feat.name}`}
                    type={feat.type === "float" || feat.type === "int" ? "number" : "text"}
                    step={feat.type === "float" ? "any" : feat.type === "int" ? "1" : undefined}
                    value={val}
                    onChange={(e) => handleFieldChange(feat.name, e.target.value, feat)}
                    placeholder={`Enter ${feat.type}${feat.min_value !== undefined && feat.min_value !== null ? ` (>= ${feat.min_value})` : ""}`}
                    className={`h-9 rounded-xl font-mono text-xs border-border bg-surface ${
                      err ? "border-rose-400 focus:ring-rose-400" : "focus:ring-sapphire"
                    }`}
                  />
                </div>

                {/* Helper / Boundary Constraints */}
                <div className="flex items-center justify-between text-xs text-text-3">
                  <span>Type: {feat.type}</span>
                  {(feat.min_value !== undefined || feat.max_value !== undefined) && (
                    <span>
                      Range: [{feat.min_value ?? "-∞"}, {feat.max_value ?? "+∞"}]
                    </span>
                  )}
                </div>

                {err && <p className="text-xs text-rose-600 font-medium">{err}</p>}
              </div>
            );
          })}
        </div>

        {generalError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-border pt-5">
          <div className="text-xs text-text-3">
            {!isModelReady ? (
              <span className="text-warning flex items-center gap-1.5 font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                Model pipeline unready: submissions will report HTTP 503 until artifact is loaded.
              </span>
            ) : (
              <span className="text-emerald-700 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Pipeline verified. Inferences are executed directly on trained scikit-learn pipeline.
              </span>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || features.length === 0}
            className="gap-2 rounded-lg bg-[#965660] px-6 text-xs font-semibold text-white shadow-xs hover:bg-[#7E454E] transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#F2DBD7]" />
                Executing Sandia Inference...
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5 text-[#F2DBD7]" />
                Predict Electrical Performance
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
