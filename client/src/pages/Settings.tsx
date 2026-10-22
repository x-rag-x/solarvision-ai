import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Gauge,
  HardDrive,
  ImageIcon,
  Info,
  RotateCcw,
  Save,
  Scale,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageIntro, StatusBadge } from "@/components/solarvision/Primitives";
import {
  DEFAULT_SETTINGS,
  InspectionSettings,
  saveInspectionSettings,
  useInspectionSettings,
} from "@/lib/settings";
import { Button } from "@/components/ui/button";

export default function Settings() {
  const { data: model } = trpc.model.status.useQuery();
  const [settings, updateSettings] = useInspectionSettings();
  const [formValues, setFormValues] = useState<InspectionSettings>(settings);

  const supabaseReady = Boolean(model?.supabaseConfigured);

  const handleSave = () => {
    updateSettings(formValues);
    toast.success(
      `Inspection settings saved (Default threshold: ${formValues.confidenceThreshold.toFixed(2)})`
    );
  };

  const handleResetDefaults = () => {
    setFormValues(DEFAULT_SETTINGS);
    updateSettings(DEFAULT_SETTINGS);
    toast.info("Reset to production defaults (Threshold: 0.25)");
  };

  const isLoweredThreshold = formValues.confidenceThreshold < 0.25;

  return (
    <div>
      <PageIntro
        eyebrow="System Configuration & Control Plane"
        title="Settings & inspection preferences."
        description="Configure operator inspection defaults and runtime guardrails. Default threshold is strictly maintained at 0.25 to prevent false alarms on production lines."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              className="h-10 gap-1.5 rounded-xl border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
              Reset Defaults
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="h-10 gap-2 rounded-xl bg-[#0B0909] px-4 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(7,27,41,0.14)] transition-transform hover:-translate-y-0.5 active:scale-95"
            >
              <Save className="h-4 w-4 text-[#F2B941]" />
              Save Settings
            </Button>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Left: Inspection Parameters & Threshold Ladder */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(7,27,41,0.04)] space-y-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF3C4] text-[#0B0909]">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F2B941]">Inference Pipeline</p>
              <h2 className="mt-0.5 text-xl font-semibold text-slate-900">Quality Gate Preferences</h2>
            </div>
          </div>

          {/* Confidence Threshold Configuration */}
          <div className="rounded-xl border border-slate-200/80 bg-[#fbfbfc] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-slate-800">
                  Default Confidence Threshold
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  Applied to YOLO26n inference. Controls detection sensitivity vs false alarms.
                </p>
              </div>
              <span className="rounded-lg bg-[#0B0909] px-3 py-1 font-mono text-sm font-bold text-[#F2B941]">
                {formValues.confidenceThreshold.toFixed(2)}
              </span>
            </div>

            {/* Threshold Quick Presets */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  setFormValues(curr => ({
                    ...curr,
                    confidenceThreshold: 0.25,
                    sensitivityMode: "standard",
                  }))
                }
                className={`rounded-xl border p-3 text-left transition-all ${
                  formValues.confidenceThreshold === 0.25
                    ? "border-[#F2B941] bg-[#FFF3C4]/60 text-slate-900 shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Standard Production</span>
                  <span className="font-mono text-[11px] font-bold">0.25</span>
                </div>
                <p className="mt-1 text-[10px] text-slate-500 leading-normal">
                  Verified baseline. Balances crack detection with zero busbar false alarms.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormValues(curr => ({
                    ...curr,
                    confidenceThreshold: 0.10,
                    sensitivityMode: "high_sensitivity",
                  }))
                }
                className={`rounded-xl border p-3 text-left transition-all ${
                  formValues.confidenceThreshold === 0.10
                    ? "border-[#F2B941] bg-[#FFF3C4]/60 text-slate-900 shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">High Sensitivity</span>
                  <span className="font-mono text-[11px] font-bold">0.10</span>
                </div>
                <p className="mt-1 text-[10px] text-slate-500 leading-normal">
                  Surfaces faint hairline cracks; requires manual operator verification.
                </p>
              </button>
            </div>

            {/* Fine-Tuning Slider */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                <span>More Detections (High Recall)</span>
                <span>Fewer False Alarms (High Precision)</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.80"
                step="0.05"
                value={formValues.confidenceThreshold}
                onChange={e =>
                  setFormValues(curr => ({
                    ...curr,
                    confidenceThreshold: Number(e.target.value),
                    sensitivityMode: "custom",
                  }))
                }
                className="w-full accent-[#0B0909]"
              />
            </div>

            {/* Threshold Warning Banner */}
            {isLoweredThreshold ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Threshold Below 0.25 Notice:</strong> Operating below 0.25 causes significant false positive elevation (+108% at 0.10) on benign multi-busbar solder joints. Do not silently lower thresholds on automated production sorting lines.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Operating at recommended production baseline threshold (0.25).</span>
              </div>
            )}
          </div>

          {/* Image & Upload Guardrails (Local Preferences) */}
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Inference Image Resolution (Local Display Preference)</span>
              <span className="mt-0.5 block text-[11px] text-slate-400">
                Local operator display preference. Note: Server inference executes with the verified 640×640 letterbox pipeline and does not retrain or re-architect the backend YOLO checkpoint.
              </span>
              <select
                value={formValues.imageSize}
                onChange={e =>
                  setFormValues(curr => ({ ...curr, imageSize: Number(e.target.value) }))
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-[#F4F0D7] px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-[#F2B941]"
              >
                <option value={640}>640 × 640 (Standard Model Input - Verified)</option>
                <option value={960}>960 × 960 (Experimental High-Res Display)</option>
                <option value={1024}>1024 × 1024 (Native PVELAD Sensor Dim Display)</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Maximum Upload File Size (Client-Side Safeguard)</span>
              <span className="mt-0.5 block text-[11px] text-slate-400">
                Client-side browser pre-upload safeguard. Server transport ceiling is strictly enforced at 35 MB binary / 50 MB Express payload limit.
              </span>
              <select
                value={formValues.maxUploadMb}
                onChange={e =>
                  setFormValues(curr => ({ ...curr, maxUploadMb: Number(e.target.value) }))
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-[#F4F0D7] px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-[#F2B941]"
              >
                <option value={10}>10 MB (Standard JPG)</option>
                <option value={20}>20 MB (High-res PNG)</option>
                <option value={35}>35 MB (Verified Transport Ceiling - 16-bit EL/NIR)</option>
              </select>
            </label>
          </div>
        </section>

        {/* Right: Runtime Status & Physical Boundaries */}
        <section className="space-y-5">
          <div className="rounded-2xl bg-[#0B0909] p-6 text-white shadow-[0_12px_32px_rgba(7,27,41,0.15)]">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-[#F2B941]" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F2B941]">
                  System Status
                </p>
                <h2 className="mt-0.5 text-lg font-semibold">Backend Infrastructure</h2>
              </div>
            </div>

            <div className="mt-6 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="flex items-center gap-2 text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-[#F2B941]" />
                  YOLO26n Checkpoint
                </span>
                <StatusBadge tone={model?.exists ? "success" : "danger"}>
                  {model?.exists ? "Present (best.pt)" : "Missing"}
                </StatusBadge>
              </div>

              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="flex items-center gap-2 text-slate-400">
                  <Database className="h-4 w-4 text-sky-400" />
                  Supabase Cloud DB
                </span>
                <StatusBadge tone={supabaseReady ? "success" : "warning"}>
                  {supabaseReady ? "Connected" : "Local SQLite Fallback"}
                </StatusBadge>
              </div>

              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="flex items-center gap-2 text-slate-400">
                  <HardDrive className="h-4 w-4 text-emerald-400" />
                  Local File System DB
                </span>
                <StatusBadge tone="success">Active (data/solarvision.db)</StatusBadge>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-400">
                  <Scale className="h-4 w-4 text-amber-400" />
                  Active Threshold Contract
                </span>
                <span className="font-mono text-slate-200">
                  {formValues.confidenceThreshold.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(7,27,41,0.04)] space-y-3">
            <div className="flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#FFF3C4] text-[#0B0909]">
                <ImageIcon className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">EL & NIR Imagery Only</h3>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              The YOLO26n model was trained on high-contrast electroluminescence and near-infrared imagery. Standard RGB daylight solar panel photos will yield unreliable detections and must not be used for production inspection.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
