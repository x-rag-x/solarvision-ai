import React, { useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  Play,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ModelHealthInfo, ModelSelfTestResult } from "./types";

interface ModelHealthCardProps {
  model: ModelHealthInfo;
  isChecking: boolean;
  isSelfTesting: boolean;
  selfTestResult?: ModelSelfTestResult | null;
  onCheckHealth: () => void;
  onRunSelfTest: () => void;
}

export function ModelHealthCard({
  model,
  isChecking,
  isSelfTesting,
  selfTestResult,
  onCheckHealth,
  onRunSelfTest,
}: ModelHealthCardProps) {
  const [showSelfTestDetails, setShowSelfTestDetails] = useState(false);

  const isReady = model.state === "ready" || model.state === "healthy";
  const isDegraded = model.state === "degraded";

  const getStatusBadge = () => {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold border shrink-0",
          isReady
            ? "bg-success-tint text-success border-success/30"
            : isDegraded
            ? "bg-warning-tint text-warning border-warning/30"
            : "bg-danger-tint text-danger border-danger/30"
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            isReady ? "bg-success" : isDegraded ? "bg-warning" : "bg-danger"
          )}
        />
        <span>{isReady ? "READY" : isDegraded ? "DEGRADED" : "OFFLINE"}</span>
      </span>
    );
  };

  const getConnectivityBadge = () => {
    switch (model.backendConnectivity) {
      case "fastapi_direct":
        return (
          <Badge className="bg-info-tint text-info border-info/30 text-xs font-medium px-2 py-0.5 gap-1 shrink-0">
            <Zap className="h-3 w-3 text-info shrink-0" />
            FastAPI Direct
          </Badge>
        );
      case "cli_bridge":
        return (
          <Badge className="bg-surface-subtle text-text-2 border-border text-xs font-medium px-2 py-0.5 gap-1 shrink-0">
            <Cpu className="h-3 w-3 text-text-3 shrink-0" />
            Python CLI
          </Badge>
        );
      case "node_direct":
        return (
          <Badge className="bg-success-tint text-success border-success/30 text-xs font-medium px-2 py-0.5 gap-1 shrink-0">
            <Layers className="h-3 w-3 text-success shrink-0" />
            Node Direct
          </Badge>
        );
      case "offline":
      default:
        return (
          <Badge className="bg-danger-tint text-danger border-danger/30 text-xs font-medium px-2 py-0.5 gap-1 shrink-0">
            <AlertCircle className="h-3 w-3 text-danger shrink-0" />
            Offline
          </Badge>
        );
    }
  };

  const getModelBadge = (id: string) => {
    if (id.includes("m1") || id.includes("model1")) return "M1";
    if (id.includes("m2") || id.includes("model2")) return "M2";
    if (id.includes("m3") || id.includes("model3")) return "M3";
    if (id.includes("m4") || id.includes("model4")) return "M4";
    return "AI";
  };

  // Clean, concise subtitle without repeating "Model X — "
  const cleanSubtitle = model.name.replace(/^Model\s+\d+\s*[-—]\s*/i, "");

  return (
    <Card className="border border-border bg-surface shadow-xs overflow-hidden rounded-2xl flex flex-col justify-between">
      <div>
        {/* Card Header: Guaranteed no squishing */}
        <div className="border-b border-border bg-surface-subtle/60 px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-ink text-surface flex items-center justify-center font-bold font-mono text-xs shrink-0 select-none shadow-xs">
              {getModelBadge(model.modelId)}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-text leading-tight truncate">
                {model.shortName}
              </h3>
              <p className="text-xs text-text-3 truncate mt-0.5" title={cleanSubtitle}>
                {cleanSubtitle}
              </p>
            </div>
          </div>
          <div className="shrink-0">{getStatusBadge()}</div>
        </div>

        {/* Card Body */}
        <div className="p-4 space-y-3 text-xs">
          {/* Artifact Telemetry Box: Clean 2-tier layout */}
          <div className="rounded-xl border border-border bg-canvas/60 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-text-3 font-medium shrink-0">Model Artifact</span>
              <span
                className="font-mono text-xs font-semibold text-text truncate max-w-[140px] text-right"
                title={model.artifactPath}
              >
                {model.artifactPath?.split("/").pop() || "Not located"}
              </span>
            </div>
            <div className="border-t border-border/60 pt-2">
              <span className="text-text-3 font-medium text-xs block mb-0.5">
                Artifact Status
              </span>
              <p
                className="text-xs font-medium text-text leading-snug break-words"
                title={model.artifactStatus}
              >
                {model.artifactStatus}
              </p>
            </div>
          </div>

          {/* Model Telemetry & Connectivity */}
          <div className="space-y-2 pt-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-3 font-medium">Persistence DB:</span>
              <span className="font-medium text-text">
                {model.dbPersistenceAvailable ? "SQLite Active" : "Memory Only"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-3 font-medium">Latency:</span>
              <span className="font-mono font-medium text-text tabular-nums">
                {model.healthCheckLatencyMs}ms
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-3 font-medium">Backend Bridge:</span>
              {getConnectivityBadge()}
            </div>
          </div>

          {/* Self-Test Result Box */}
          {selfTestResult && (
            <div className="rounded-xl border border-success/30 bg-success-tint p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-success flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  Self-Test Verified ({selfTestResult.durationMs}ms)
                </span>
                <button
                  onClick={() => setShowSelfTestDetails(!showSelfTestDetails)}
                  className="text-xs text-success hover:underline font-semibold"
                >
                  {showSelfTestDetails ? "Hide" : "Details"}
                </button>
              </div>
              <p className="text-xs text-success">{selfTestResult.summary}</p>

              {showSelfTestDetails && (
                <pre className="mt-2 p-2 rounded bg-surface text-xs font-mono text-text border border-success/30 overflow-x-auto max-h-36">
                  {JSON.stringify(selfTestResult.verifiedOutputs, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Actions Footer: Balanced flex-1 buttons preventing clipping */}
      <div className="border-t border-border bg-surface-subtle/40 p-3 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onCheckHealth}
          disabled={isChecking}
          title="Execute health check"
          className="flex-1 h-8 px-2 text-xs font-semibold rounded-lg border-border hover:bg-surface gap-1.5"
        >
          <RefreshCw className={cn("h-3 w-3 shrink-0", isChecking && "animate-spin")} />
          <span className="truncate">Check</span>
        </Button>

        {model.capabilities.canSelfTest && (
          <Button
            size="sm"
            onClick={onRunSelfTest}
            disabled={isSelfTesting || model.state === "unavailable"}
            title="Execute self-test"
            className="flex-1 h-8 px-2 text-xs font-semibold rounded-lg bg-ink text-surface hover:bg-ink/90 gap-1.5 shadow-xs"
          >
            <Play className={cn("h-3 w-3 shrink-0", isSelfTesting && "animate-spin")} />
            <span className="truncate">{isSelfTesting ? "Testing..." : "Self-Test"}</span>
          </Button>
        )}
      </div>
    </Card>
  );
}
