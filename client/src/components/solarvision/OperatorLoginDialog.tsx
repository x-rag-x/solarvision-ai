import React, { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Factory,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Microscope,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Wrench,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PresetOperator {
  id: string;
  name: string;
  role: "user" | "admin";
  badge: string;
  roleTitle: string;
  description: string;
  icon: React.ElementType;
  accent: string;
}

const PRESET_OPERATORS: PresetOperator[] = [
  {
    id: "OP-7701",
    name: "Alex Rivera",
    role: "user",
    badge: "Station Lead",
    roleTitle: "EL Quality Inspector",
    description: "Authorized for YOLO26n cell inspections, defect classification, and telemetry logging.",
    icon: Factory,
    accent: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    id: "QE-2044",
    name: "Elena Rostova",
    role: "user",
    badge: "Quality Eng.",
    roleTitle: "Reliability & Yield Specialist",
    description: "Evaluates defect clusters, SECOM quality models, and production line yield trends.",
    icon: Microscope,
    accent: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    id: "admin-marcus",
    name: "Marcus Vance",
    role: "admin",
    badge: "Plant Admin",
    roleTitle: "Quality Assurance Director",
    description: "Full factory governance, equipment calibration overrides, and operator credential provisioning.",
    icon: ShieldCheck,
    accent: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
];

export function OperatorLoginDialog() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"presets" | "custom">("presets");

  // Custom Form state
  const [customId, setCustomId] = useState("OP-1042");
  const [customName, setCustomName] = useState("Shift Quality Tech");
  const [customRole, setCustomRole] = useState<"user" | "admin">("user");

  const utils = trpc.useUtils();
  const loginMutation = trpc.auth.login.useMutation();

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("solarvision:open-login", handleOpen);
    return () => window.removeEventListener("solarvision:open-login", handleOpen);
  }, []);

  const handleAuthenticate = async (operatorId: string, name: string, role: "user" | "admin") => {
    try {
      const response = await loginMutation.mutateAsync({
        operatorId,
        name,
        role,
      });

      if (response.success && response.token) {
        // 1. Mirror token into storage for persistent and cross-tab session support
        try {
          sessionStorage.removeItem("solarvision:explicit-logout");
          sessionStorage.setItem("manus-cookie", `${response.cookieName}=${response.token}; path=/;`);
          localStorage.setItem("solarvision-session-token", response.token);
          localStorage.setItem("manus-cookie", `${response.cookieName}=${response.token}; path=/;`);
          localStorage.setItem("manus-runtime-user-info", JSON.stringify(response.user));
        } catch {}

        // 2. Immediately hydrate query cache and trigger re-render of guarded components
        utils.auth.me.setData(undefined, response.user as any);
        await utils.auth.me.invalidate();
        await utils.dashboard.stats.invalidate();

        toast.success(
          `Authenticated as ${response.user?.name || operatorId} (${
            response.user?.role === "admin" ? "Quality Admin" : "Quality Operator"
          })`
        );

        setOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed. Please check operator credentials.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-2xl">
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#0B0909] text-[#F2B941] shadow-md">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#F2B941]">
                  Restricted Quality Zone
                </span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                  Zero-Fabrication Mode
                </span>
              </div>
              <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Operator ID Authentication
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs leading-relaxed text-slate-500 pt-1">
            Authenticate your quality engineering session to unlock the YOLO26n computer vision pipeline,
            execute live solar cell defect inspections, and persist results to the factory audit database.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Selection */}
        <div className="mt-4 flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("presets")}
            className={cn(
              "flex-1 rounded-lg py-2 transition-all",
              activeTab === "presets"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            )}
          >
            Certified Operator Presets (1-Click)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("custom")}
            className={cn(
              "flex-1 rounded-lg py-2 transition-all",
              activeTab === "custom"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            )}
          >
            Custom Badge ID
          </button>
        </div>

        {activeTab === "presets" ? (
          <div className="mt-4 space-y-3">
            {PRESET_OPERATORS.map(op => {
              const Icon = op.icon;
              const isPending = loginMutation.isPending;
              return (
                <button
                  key={op.id}
                  disabled={isPending}
                  type="button"
                  onClick={() => handleAuthenticate(op.id, op.name, op.role)}
                  className="group flex w-full items-start gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 text-left transition-all hover:border-[#F2B941] hover:bg-[#FFFDF5] hover:shadow-sm disabled:opacity-50"
                >
                  <div
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors group-hover:scale-105",
                      op.accent
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{op.name}</span>
                        <span className="font-mono text-[10px] text-slate-400">({op.id})</span>
                      </div>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200">
                        {op.badge}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-slate-700">{op.roleTitle}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{op.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <form
            onSubmit={e => {
              e.preventDefault();
              if (!customId.trim()) {
                toast.error("Please enter an Operator Badge ID.");
                return;
              }
              handleAuthenticate(customId.trim(), customName.trim() || customId.trim(), customRole);
            }}
            className="mt-4 space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="operator-id" className="text-xs font-semibold text-slate-700">
                Operator Badge ID
              </Label>
              <Input
                id="operator-id"
                value={customId}
                onChange={e => setCustomId(e.target.value)}
                placeholder="e.g. OP-1042 or TECH-88"
                className="h-10 rounded-xl border-slate-300 font-mono text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="operator-name" className="text-xs font-semibold text-slate-700">
                Operator Full Name
              </Label>
              <Input
                id="operator-name"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="e.g. Jordan Miller"
                className="h-10 rounded-xl border-slate-300 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Quality Access Role</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCustomRole("user")}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all",
                    customRole === "user"
                      ? "border-[#F2B941] bg-[#FFF3C4] font-semibold text-[#0B0909]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  )}
                >
                  <UserCheck className="h-4 w-4 shrink-0 text-[#F2B941]" />
                  <div>
                    <p className="text-xs">Quality Operator</p>
                    <p className="text-[10px] text-slate-500">Inspection & Analytics</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCustomRole("admin")}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all",
                    customRole === "admin"
                      ? "border-[#F2B941] bg-[#FFF3C4] font-semibold text-[#0B0909]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  )}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" />
                  <div>
                    <p className="text-xs">Plant Admin</p>
                    <p className="text-[10px] text-slate-500">Full System Governance</p>
                  </div>
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loginMutation.isPending || !customId.trim()}
              className="mt-2 h-11 w-full gap-2 rounded-xl bg-[#0B0909] text-xs font-semibold text-white shadow-md hover:bg-slate-800 disabled:opacity-50"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-[#F2B941]" />
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 text-[#F2B941]" />
                  Sign In with Operator ID
                </>
              )}
            </Button>
          </form>
        )}

        {/* Security & Audit Guarantee */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 text-left">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <div className="text-[11px] leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-900">Audit Compliance:</span> Every YOLO26n inspection
              run is cryptographically bound to the authenticated operator's identity and timestamped in the
              factory quality database.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
