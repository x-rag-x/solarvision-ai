import * as React from "react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { openOperatorLoginModal } from "@/const";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  FlaskConical,
  KeyRound,
  Lock,
  LogOut,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  User,
  UserCheck,
} from "lucide-react";
import { PageHeader } from "@/components/solarvision/PageHeader";
import { StatusBadge } from "@/components/solarvision/StatusBadge";
import { NoticeBar } from "@/components/solarvision/NoticeBar";
import {
  DEFAULT_SETTINGS,
  InspectionSettings,
  useInspectionSettings,
} from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type SettingsTab = "defaults" | "account" | "experimental";

export default function Settings() {
  const { user, isAuthenticated, logout } = useAuth();
  const { data: systemSettings, refetch: refetchSettings } = trpc.system.getSettings.useQuery();
  const updateSystemSettings = trpc.system.updateSettings.useMutation({
    onSuccess: () => {
      refetchSettings();
    },
  });

  const [activeTab, setActiveTab] = useState<SettingsTab>("defaults");
  const [settings, updateSettings] = useInspectionSettings();
  const [formValues, setFormValues] = useState<InspectionSettings>(settings);

  const isAdmin = user?.role === "admin";
  const rootCauseEnabled = Boolean(systemSettings?.enableRootCause);

  const handleSave = () => {
    updateSettings(formValues);
    toast.success(
      `Inspection preferences saved (Default threshold: ${formValues.confidenceThreshold.toFixed(2)})`
    );
  };

  const handleResetDefaults = () => {
    setFormValues(DEFAULT_SETTINGS);
    updateSettings(DEFAULT_SETTINGS);
    toast.info("Reset to production baseline defaults (Threshold: 0.25)");
  };

  const handleToggleRootCause = async (checked: boolean) => {
    if (!isAdmin) {
      toast.error("Administrator privileges required to modify experimental modules.");
      return;
    }

    try {
      await updateSystemSettings.mutateAsync({ enableRootCause: checked });
      toast.success(
        checked
          ? "Root Cause Analysis module enabled. Available in sidebar navigation."
          : "Root Cause Analysis module disabled. Preserved underlying data."
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update module settings.");
    }
  };

  const isLoweredThreshold = formValues.confidenceThreshold < 0.25;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Settings & System Preferences"
        description="Configure operator inspection defaults, runtime guardrails, operator credentials, and optional modules. Default threshold is strictly locked to 0.25 on automated production lines."
        badge={
          <StatusBadge tone={isAdmin ? "info" : "neutral"}>
            {isAdmin ? "Admin Control Plane" : "Operator Preferences"}
          </StatusBadge>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              className="h-9 gap-1.5 rounded-lg border-border bg-surface text-xs font-semibold text-text hover:bg-canvas"
            >
              <RotateCcw className="h-3.5 w-3.5 text-text-3" />
              Reset Defaults
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="h-9 gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95"
            >
              <Save className="h-3.5 w-3.5" />
              Save Settings
            </Button>
          </div>
        }
      />

      {/* Segmented Tab Bar */}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-subtle p-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab("defaults")}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 font-medium transition-colors ${
            activeTab === "defaults"
              ? "bg-surface font-semibold text-text shadow-xs"
              : "text-text-3 hover:text-text"
          }`}
        >
          <Sliders className="h-3.5 w-3.5 text-sapphire" />
          Inspection Defaults
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("account")}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 font-medium transition-colors ${
            activeTab === "account"
              ? "bg-surface font-semibold text-text shadow-xs"
              : "text-text-3 hover:text-text"
          }`}
        >
          <User className="h-3.5 w-3.5 text-sapphire" />
          Account & Profile
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("experimental")}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 font-medium transition-colors ${
            activeTab === "experimental"
              ? "bg-surface font-semibold text-text shadow-xs"
              : "text-text-3 hover:text-text"
          }`}
        >
          <FlaskConical className="h-3.5 w-3.5 text-sapphire" />
          Optional / Experimental Modules
          {rootCauseEnabled && (
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
          )}
        </button>
      </div>

      {/* Tab 1: Inspection Defaults */}
      <div className={activeTab === "defaults" ? "space-y-6" : "hidden space-y-6"}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Confidence Threshold Configuration */}
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-base font-semibold text-text">
                    Confidence Cutoff (τ Threshold)
                  </h2>
                  <p className="text-xs text-text-3 mt-0.5">
                    Controls defect sensitivity vs false alarms for Model 1 YOLO inference.
                  </p>
                </div>
                <span className="rounded-lg border border-border bg-canvas px-3 py-1 font-mono text-sm font-bold text-text tabular-nums">
                  {formValues.confidenceThreshold.toFixed(2)}
                </span>
              </div>

              {/* Threshold Quick Presets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setFormValues((curr) => ({
                      ...curr,
                      confidenceThreshold: 0.25,
                      sensitivityMode: "standard",
                    }))
                  }
                  className={`rounded-xl border p-4 text-left transition-all ${
                    formValues.confidenceThreshold === 0.25
                      ? "border-primary bg-primary/5 text-text ring-1 ring-primary/20"
                      : "border-border bg-surface text-text-3 hover:border-border hover:bg-canvas/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text">Standard Production</span>
                    <span className="font-mono text-xs font-bold text-text tabular-nums">0.25</span>
                  </div>
                  <p className="mt-1.5 text-xs text-text-3 leading-relaxed">
                    Verified production baseline. Balances crack & finger recall with zero busbar false positives.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFormValues((curr) => ({
                      ...curr,
                      confidenceThreshold: 0.10,
                      sensitivityMode: "high_sensitivity",
                    }))
                  }
                  className={`rounded-xl border p-4 text-left transition-all ${
                    formValues.confidenceThreshold === 0.10
                      ? "border-warning bg-warning-tint text-text ring-1 ring-warning/30"
                      : "border-border bg-surface text-text-3 hover:border-border hover:bg-canvas/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text">High Sensitivity</span>
                    <span className="font-mono text-xs font-bold text-text tabular-nums">0.10</span>
                  </div>
                  <p className="mt-1.5 text-xs text-text-3 leading-relaxed">
                    Surfaces faint hairline cracks; requires mandatory human operator verification.
                  </p>
                </button>
              </div>

              {/* Fine-Tuning Slider */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between text-xs text-text-3 font-medium">
                  <span>Higher Recall (0.05)</span>
                  <span>Production (0.25)</span>
                  <span>Higher Precision (0.80)</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.80"
                  step="0.05"
                  value={formValues.confidenceThreshold}
                  onChange={(e) =>
                    setFormValues((curr) => ({
                      ...curr,
                      confidenceThreshold: Number(e.target.value),
                      sensitivityMode: "custom",
                    }))
                  }
                  className="w-full accent-primary"
                />
              </div>

              {/* Threshold Warning Banner */}
              {isLoweredThreshold ? (
                <div className="flex items-start gap-3 rounded-xl border border-warning-border bg-warning-tint p-3.5 text-xs text-text">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Threshold Below 0.25 Warning:</strong> Operating below 0.25 causes significant false alarm elevation (+108% at 0.10) on multi-busbar solder joints. Do not silently lower thresholds on automated production sorting lines.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-success font-medium">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Operating at recommended production baseline threshold (0.25).</span>
                </div>
              )}
            </div>

            {/* Inference Resolution & Safeguards */}
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-5">
              <h2 className="text-base font-semibold text-text border-b border-border pb-3">
                Inference & Upload Safeguards
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-text">
                    Inference Resolution (YOLO imgsz)
                  </span>
                  <p className="text-xs text-text-3">
                    Input size passed to model. Standard baseline is 640×640.
                  </p>
                  <select
                    value={formValues.imageSize}
                    onChange={(e) =>
                      setFormValues((curr) => ({ ...curr, imageSize: Number(e.target.value) }))
                    }
                    className="w-full rounded-lg border border-border bg-surface-subtle px-3 py-2 text-xs font-medium text-text outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={640}>640 × 640 (Standard Model Input - Verified)</option>
                    <option value={960}>960 × 960 (Experimental High-Res Display)</option>
                    <option value={1024}>1024 × 1024 (Native PVELAD Sensor Dim Display)</option>
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-text">
                    Client-Side Upload Limit
                  </span>
                  <p className="text-xs text-text-3">
                    Pre-upload browser limit. Server transport ceiling is strictly 35 MB.
                  </p>
                  <select
                    value={formValues.maxUploadMb}
                    onChange={(e) =>
                      setFormValues((curr) => ({ ...curr, maxUploadMb: Number(e.target.value) }))
                    }
                    className="w-full rounded-lg border border-border bg-surface-subtle px-3 py-2 text-xs font-medium text-text outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={10}>10 MB (Standard JPG)</option>
                    <option value={20}>20 MB (High-res PNG)</option>
                    <option value={35}>35 MB (Verified Transport Ceiling - 16-bit EL/NIR)</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Physical Constraints & Scope */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-text">EL & NIR Imagery Only</h3>
              <p className="text-xs text-text-3 leading-relaxed">
                Visual defect models are trained on high-contrast electroluminescence and near-infrared sensor imagery. Standard RGB daylight camera photos yield unreliable detections and must not be used on production sorting lines.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-surface-subtle p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-text">Need Infrastructure Status?</h3>
              <p className="text-xs text-text-3 leading-relaxed">
                Live database connectivity, model checkpoint health checks, and server log consoles are housed in the dedicated engineering console.
              </p>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full h-8 text-xs font-medium border-border"
              >
                <a href="/system-health">Open System Health & Diagnostics</a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab 2: Account & Profile */}
      <div className={activeTab === "account" ? "space-y-6" : "hidden space-y-6"}>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-canvas border border-border text-text font-bold text-lg">
                <User className="h-6 w-6 text-text" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text">
                  {isAuthenticated ? user?.name || user?.openId || "Operator Session" : "Guest Operator"}
                </h2>
                <p className="text-xs text-text-3 mt-0.5">
                  {isAuthenticated
                    ? `Role: ${user?.role || "operator"} · Authenticated session active`
                    : "Unauthenticated · Read-only access enabled"}
                </p>
              </div>
            </div>

            <div>
              {isAuthenticated ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logout()}
                  className="h-9 gap-1.5 rounded-lg border-danger-border bg-danger-tint text-xs font-medium text-danger hover:bg-danger/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={openOperatorLoginModal}
                  className="h-9 gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-95"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Sign In as Operator / Admin
                </Button>
              )}
            </div>
          </div>

          {/* Permissions Matrix */}
          <div>
            <h3 className="text-sm font-semibold text-text mb-3">Role Capabilities</h3>
            <div className="rounded-xl border border-border overflow-hidden text-xs">
              <div className="grid grid-cols-3 bg-surface-subtle p-3 font-semibold text-text border-b border-border">
                <span>Operation</span>
                <span>Operator</span>
                <span>Administrator</span>
              </div>
              <div className="divide-y divide-border-subtle bg-surface">
                <div className="grid grid-cols-3 p-3 text-text-3 items-center">
                  <span className="text-text font-medium">Run Visual Defect Inspection</span>
                  <span className="text-success font-medium">Allowed</span>
                  <span className="text-success font-medium">Allowed</span>
                </div>
                <div className="grid grid-cols-3 p-3 text-text-3 items-center">
                  <span className="text-text font-medium">Export Printable A4 Reports & CSV</span>
                  <span className="text-success font-medium">Allowed</span>
                  <span className="text-success font-medium">Allowed</span>
                </div>
                <div className="grid grid-cols-3 p-3 text-text-3 items-center">
                  <span className="text-text font-medium">Tune Session Confidence Threshold</span>
                  <span className="text-success font-medium">Allowed</span>
                  <span className="text-success font-medium">Allowed</span>
                </div>
                <div className="grid grid-cols-3 p-3 text-text-3 items-center">
                  <span className="text-text font-medium">Toggle Experimental Modules</span>
                  <span className="text-text-3">Restricted</span>
                  <span className="text-success font-medium">Allowed</span>
                </div>
                <div className="grid grid-cols-3 p-3 text-text-3 items-center">
                  <span className="text-text font-medium">Flush Server Diagnostics Log</span>
                  <span className="text-text-3">Restricted</span>
                  <span className="text-success font-medium">Allowed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab 3: Optional / Experimental Modules Section (Preserving exact copy & elements) */}
      <div className={activeTab === "experimental" ? "space-y-6" : "hidden space-y-6"}>
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-canvas border border-border text-text">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-3">
                  System Architecture &amp; Governance
                </p>
                <h2 className="mt-0.5 text-xl font-semibold text-text">
                  Optional / Experimental Modules
                </h2>
              </div>
            </div>
            <span className="rounded-full border border-border bg-surface-subtle px-3 py-1 font-mono text-xs text-text-3">
              Administrative Access Control
            </span>
          </div>

          {/* Setting Card: Enable Root Cause Analysis */}
          <div className="rounded-xl border border-border bg-canvas/40 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="space-y-1 max-w-3xl">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-text">
                    Enable Root Cause Analysis
                  </h3>
                  {rootCauseEnabled ? (
                    <span className="rounded-full bg-success-tint border border-success-border px-2 py-0.5 text-xs font-semibold text-success">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-surface-subtle border border-border px-2 py-0.5 text-xs font-semibold text-text-3">
                      Disabled
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-3 leading-relaxed pt-1">
                  Show the experimental manufacturing root-cause analysis module in SolarVision. This feature is not trained on a verified, linked factory root-cause dataset and should not be treated as production-grade causal diagnosis.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Switch
                  id="enable-root-cause"
                  checked={rootCauseEnabled}
                  onCheckedChange={handleToggleRootCause}
                  disabled={!isAdmin || updateSystemSettings.isPending}
                />
                <label
                  htmlFor="enable-root-cause"
                  className="text-xs font-semibold text-text cursor-pointer select-none"
                >
                  {rootCauseEnabled ? "Enabled" : "Disabled"}
                </label>
              </div>
            </div>

            {/* Role Status & Persistent Invariant Notice */}
            <div className="border-t border-border pt-3 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2 text-text-3">
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1.5 text-success font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Administrator permissions verified. Changes persist to server SQLite storage.
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-warning font-medium">
                    <Lock className="h-3.5 w-3.5" />
                    Restricted: Administrator privileges required to toggle optional modules.
                  </span>
                )}
              </div>

              {!isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openOperatorLoginModal}
                  className="h-7 text-xs rounded-lg border-border"
                >
                  Sign in as Admin
                </Button>
              )}
            </div>

            {/* Data Preservation Guarantee */}
            <div className="rounded-xl bg-warning-tint border border-warning-border p-3.5 text-xs text-text leading-relaxed">
              <p>
                <strong>Data Preservation Guarantee:</strong> Disabling this setting removes Root Cause Analysis from the navigation sidebar and entry points, but never deletes underlying database tables, CSV imports, or confirmed annotations. If re-enabled, all previously linked batches, machines, and annotations remain intact.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
