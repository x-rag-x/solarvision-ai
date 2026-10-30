import React, { useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  FileCheck2,
  FileCode2,
  Info,
  Layers,
  Play,
  RefreshCw,
  ShieldAlert,
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

  const getStatusBadge = () => {
    switch (model.state) {
      case "ready":
      case "healthy":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold gap-1 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            READY
          </Badge>
        );
      case "degraded":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold gap-1 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            DEGRADED
          </Badge>
        );
      case "unavailable":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300 font-semibold gap-1 text-xs">
            <AlertCircle className="h-3.5 w-3.5 text-red-600" />
            UNAVAILABLE
          </Badge>
        );
      case "not_trained":
        return (
          <Badge className="bg-slate-100 text-slate-800 border-slate-300 font-semibold gap-1 text-xs">
            <AlertCircle className="h-3.5 w-3.5 text-slate-600" />
            NOT TRAINED
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-100 text-slate-800 border-slate-300 font-semibold gap-1 text-xs">
            <Activity className="h-3.5 w-3.5 text-slate-600" />
            UNKNOWN
          </Badge>
        );
    }
  };

  const getConnectivityBadge = () => {
    switch (model.backendConnectivity) {
      case "fastapi_direct":
        return (
          <Badge className="bg-sky-50 text-sky-800 border-sky-200 text-[11px] font-medium gap-1">
            <Zap className="h-3 w-3 text-sky-600" />
            FastAPI Direct
          </Badge>
        );
      case "cli_bridge":
        return (
          <Badge className="bg-purple-50 text-purple-800 border-purple-200 text-[11px] font-medium gap-1">
            <Cpu className="h-3 w-3 text-purple-600" />
            Python CLI Bridge
          </Badge>
        );
      case "node_direct":
        return (
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[11px] font-medium gap-1">
            <Layers className="h-3 w-3 text-emerald-600" />
            Node Direct
          </Badge>
        );
      case "offline":
      default:
        return (
          <Badge className="bg-red-50 text-red-800 border-red-200 text-[11px] font-medium gap-1">
            <AlertCircle className="h-3 w-3 text-red-600" />
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

  return (
    <Card className="border border-slate-200/80 bg-white shadow-sm overflow-hidden rounded-2xl flex flex-col justify-between">
      <div>
        {/* Card Header */}
        <div className="border-b border-slate-100 bg-[#FAFAF7] px-5 py-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#0B0909] text-[#F2B941] flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden select-none">
              {getModelBadge(model.modelId)}
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 leading-tight">
                {model.shortName}
              </h3>
              <p className="text-[11px] text-slate-500 truncate max-w-[220px]">
                {model.name}
              </p>
            </div>
          </div>
          <div>{getStatusBadge()}</div>
        </div>

        {/* Card Body */}
        <div className="p-5 space-y-3.5 text-xs">
          {/* Artifact Telemetry */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Model Artifact:</span>
              <span className="font-mono text-slate-800 font-semibold truncate max-w-[170px]" title={model.artifactPath}>
                {model.artifactPath?.split("/").pop() || "Not located"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Artifact Status:</span>
              <span className="font-medium text-slate-700">{model.artifactStatus}</span>
            </div>
            {model.artifactSha256Verified !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">SHA-256 Integrity:</span>
                <span className={cn("font-bold flex items-center gap-1", model.artifactSha256Verified ? "text-emerald-700" : "text-amber-700")}>
                  {model.artifactSha256Verified ? (
                    <>
                      <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
                      Verified
                    </>
                  ) : (
                    "Unverified"
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Connectivity & Persistence */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-slate-100 p-2.5 bg-white">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Backend Link</p>
              <div className="mt-1">{getConnectivityBadge()}</div>
            </div>
            <div className="rounded-lg border border-slate-100 p-2.5 bg-white">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">SQLite Storage</p>
              <p className="mt-1 font-semibold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Available
              </p>
            </div>
          </div>

          {/* Health-check Latency & Timestamps */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <span>Ping Latency:</span>
            <span className="font-mono font-semibold text-slate-800">{model.healthCheckLatencyMs} ms</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Last Attempted:</span>
            <span className="font-mono">{new Date(model.lastAttemptedCheck).toLocaleTimeString()}</span>
          </div>

          {/* Limitations / Disclaimers */}
          {model.limitations.length > 0 && (
            <div className="rounded-lg bg-amber-50/70 border border-amber-200/80 p-2.5 text-[11px] text-amber-900 space-y-1">
              <div className="flex items-center gap-1 font-semibold text-amber-800">
                <Info className="h-3 w-3 text-amber-600 shrink-0" />
                <span>Operational Governance:</span>
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-[10.5px]">
                {model.limitations.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Error Message if degraded/unavailable */}
          {model.errorMessage && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-[11px] text-red-700">
              <p className="font-semibold">Error:</p>
              <p className="font-mono text-[10px] mt-0.5 break-all">{model.errorMessage}</p>
            </div>
          )}

          {/* Self-Test Result Output */}
          {selfTestResult && selfTestResult.modelId === model.modelId && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs space-y-1.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900 flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Self-Test Verified ({selfTestResult.durationMs}ms)
                </span>
                <button
                  onClick={() => setShowSelfTestDetails(!showSelfTestDetails)}
                  className="text-[10px] text-emerald-700 hover:underline font-semibold"
                >
                  {showSelfTestDetails ? "Hide" : "Details"}
                </button>
              </div>
              <p className="text-[11px] text-emerald-800">{selfTestResult.summary}</p>

              {showSelfTestDetails && (
                <pre className="mt-2 p-2 rounded bg-white text-[10px] font-mono text-slate-800 border border-emerald-200 overflow-x-auto max-h-36">
                  {JSON.stringify(selfTestResult.verifiedOutputs, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Actions Footer */}
      <div className="border-t border-slate-100 bg-[#FAFAF7] px-5 py-3 flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onCheckHealth}
          disabled={isChecking}
          className="h-8 px-2.5 text-xs font-semibold rounded-lg border-slate-200 hover:bg-white gap-1.5"
        >
          <RefreshCw className={cn("h-3 w-3", isChecking && "animate-spin")} />
          Check Health
        </Button>

        {model.capabilities.canSelfTest && (
          <Button
            size="sm"
            onClick={onRunSelfTest}
            disabled={isSelfTesting || model.state === "unavailable"}
            className="h-8 px-3 text-xs font-semibold rounded-lg bg-[#0B0909] text-white hover:bg-slate-800 gap-1.5"
          >
            <Play className={cn("h-3 w-3 text-[#F2B941]", isSelfTesting && "animate-spin")} />
            {isSelfTesting ? "Testing..." : "Run Self-Test"}
          </Button>
        )}
      </div>
    </Card>
  );
}

