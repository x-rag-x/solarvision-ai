import React, { useState, useEffect } from "react";
import { X, Copy, Check, Terminal, Clock, HardDrive, Cpu, FileJson, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface InspectorProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  data: {
    resultSummary?: Record<string, any>;
    requestInfo?: Record<string, any>;
    rawResponse?: any;
    modelInfo?: Record<string, any>;
    timingMs?: {
      inference?: number;
      roundTrip?: number;
      preparation?: number;
    };
    storageInfo?: {
      target?: string;
      recordId?: string;
      persisted?: boolean;
    };
    errorInfo?: any;
  };
}

export function Inspector({ open, onClose, title = "Telemetry & Pipeline Inspector", data }: InspectorProps) {
  const [activeTab, setActiveTab] = useState<"result" | "response" | "request" | "model" | "timing" | "storage">("result");
  const [copied, setCopied] = useState(false);

  // 'I' keyboard shortcut toggle listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "i" || e.key === "I") && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        // Toggle inspector handled by parent
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const copyJson = (obj: any) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
      setCopied(true);
      toast.success("JSON copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy JSON");
    }
  };

  if (!open) return null;

  return (
    <aside
      className="fixed inset-y-0 right-0 z-50 flex w-full sm:w-[440px] flex-col border-l border-border bg-surface shadow-2xl animate-in slide-in-from-right duration-200 select-none"
      aria-label="Developer Inspector Drawer"
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4 bg-surface-subtle">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-brand-text" />
          <h3 className="text-xs font-semibold text-text truncate">{title}</h3>
          <span className="rounded bg-brand-tint px-1.5 py-0.5 font-mono text-xs font-bold text-brand-text">
            DEV
          </span>
        </div>
        <button
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-lg text-text-3 hover:text-text hover:bg-surface transition-colors"
          aria-label="Close inspector drawer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-2 bg-surface text-xs font-medium overflow-x-auto">
        {(["result", "response", "request", "model", "timing", "storage"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 px-3 py-2.5 capitalize transition-colors ${
              activeTab === tab
                ? "border-brand text-text font-semibold"
                : "border-transparent text-text-3 hover:text-text"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 text-xs space-y-4">
        {activeTab === "result" && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Verdict & Key Outputs
            </h4>
            <div className="rounded-xl border border-border bg-surface-subtle p-3 space-y-2">
              {data.resultSummary ? (
                Object.entries(data.resultSummary).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-baseline gap-2">
                    <span className="font-mono text-text-3 text-xs">{key}:</span>
                    <span className="font-mono font-semibold text-text text-right truncate">
                      {typeof val === "object" ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-text-3">No active execution result.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "response" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-3">
                Raw JSON Contract
              </span>
              <button
                onClick={() => copyJson(data.rawResponse || data)}
                className="inline-flex items-center gap-1 rounded bg-surface-subtle border border-border px-2 py-1 text-xs text-text-2 hover:text-text hover:bg-surface transition-colors"
              >
                {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <pre className="max-h-[500px] overflow-auto rounded-xl border border-border bg-ink p-3 font-mono text-xs text-emerald-400 leading-relaxed">
              {JSON.stringify(data.rawResponse || data, null, 2)}
            </pre>
          </div>
        )}

        {activeTab === "request" && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Request Payload Parameters
            </h4>
            <div className="rounded-xl border border-border bg-surface-subtle p-3 space-y-2">
              {data.requestInfo ? (
                Object.entries(data.requestInfo).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-baseline gap-2">
                    <span className="font-mono text-text-3 text-xs">{key}:</span>
                    <span className="font-mono font-semibold text-text text-right truncate">
                      {String(val)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-text-3">No client request data recorded.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "model" && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Checkpoint & Inference Engine
            </h4>
            <div className="rounded-xl border border-border bg-surface-subtle p-3 space-y-2">
              {data.modelInfo ? (
                Object.entries(data.modelInfo).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-baseline gap-2">
                    <span className="font-mono text-text-3 text-xs">{key}:</span>
                    <span className="font-mono font-semibold text-text text-right truncate">
                      {String(val)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-text-3">No model metadata attached.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "timing" && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Latency & Profiling (ms)
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border bg-surface-subtle p-3">
                <span className="text-xs text-text-3 block">Inference</span>
                <span className="font-mono text-lg font-semibold text-text tabular-nums">
                  {data.timingMs?.inference ? `${data.timingMs.inference.toFixed(1)} ms` : "—"}
                </span>
              </div>
              <div className="rounded-xl border border-border bg-surface-subtle p-3">
                <span className="text-xs text-text-3 block">Round-Trip Total</span>
                <span className="font-mono text-lg font-semibold text-text tabular-nums">
                  {data.timingMs?.roundTrip ? `${data.timingMs.roundTrip.toFixed(0)} ms` : "—"}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "storage" && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-3">
              Persistence & Traceability
            </h4>
            <div className="rounded-xl border border-border bg-surface-subtle p-3 space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-text-3">Storage Target:</span>
                <span className="font-mono font-semibold text-text">
                  {data.storageInfo?.target || "SQLite (local)"}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-text-3">Record ID:</span>
                <span className="font-mono text-text truncate max-w-[200px]">
                  {data.storageInfo?.recordId || "—"}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-text-3">Persisted:</span>
                <span className="font-mono font-semibold text-success">
                  {data.storageInfo?.persisted !== false ? "Confirmed" : "In-Memory"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-2.5 bg-surface-subtle flex justify-between items-center text-xs text-text-3">
        <span>Press <kbd className="font-mono bg-surface border border-border px-1 rounded">I</kbd> to toggle</span>
        <button
          onClick={onClose}
          className="text-text-2 hover:text-text font-medium"
        >
          Close Drawer
        </button>
      </div>
    </aside>
  );
}

export default Inspector;
