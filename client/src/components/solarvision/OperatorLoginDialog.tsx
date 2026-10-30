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
  Factory,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Microscope,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
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
  const authConfigQuery = trpc.auth.config.useQuery();
  const passcodeRequired = Boolean(authConfigQuery.data?.passcodeRequired);
  const [passcode, setPasscode] = useState(
    () => (typeof window !== "undefined" && typeof sessionStorage !== "undefined" ? sessionStorage.getItem("solarvision:operator-passcode") || "" : "")
  );

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
        passcode: passcode.trim() || undefined,
      });

      if (response.success && response.token) {
        if (passcode.trim()) {
          sessionStorage.setItem("solarvision:operator-passcode", passcode.trim());
        }

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
      <DialogContent className="w-[calc(100%-2rem)] max-w-xl max-h-[90vh] sm:max-h-[85vh] flex flex-col p-0 gap-0 rounded-3xl border border-slate-200/90 bg-white shadow-2xl overflow-hidden focus:outline-none">
        {/* Pinned Modal Header */}
        <div className="shrink-0 border-b border-slate-100 bg-white px-6 pt-6 pb-4 sm:px-8 sm:pt-7 sm:pb-5">
          <DialogHeader className="text-left space-y-2 pr-8 sm:pr-10">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary shadow-md">
                <Lock className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    Restricted Quality Zone
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-600">
                    Zero-Fabrication Mode
                  </span>
                </div>
                <DialogTitle className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                  Operator ID Authentication
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-xs leading-relaxed text-slate-500 pt-0.5">
              Authenticate your quality engineering session to unlock the YOLO26n computer vision pipeline,
              execute live solar cell defect inspections, and persist results to the factory audit database.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable Content Region */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-4 sm:px-8 sm:py-5 space-y-4">
          {/* Staging Access Control: Operator Passcode */}
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-3.5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <Label htmlFor="operator-passcode" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-primary" />
                Operator Access Passcode
              </Label>
              {passcodeRequired ? (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300">
                  Required in Staging
                </span>
              ) : (
                <span className="text-xs text-slate-400 font-mono">Optional</span>
              )}
            </div>
            <Input
              id="operator-passcode"
              type="password"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              placeholder={passcodeRequired ? "Enter operator passcode configured in Render" : "Enter passcode if configured"}
              className="h-9 rounded-xl border-slate-300 bg-white font-mono text-xs focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>

          {/* Tab Selection */}
          <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
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
            <div className="space-y-2.5">
              {PRESET_OPERATORS.map(op => {
                const Icon = op.icon;
                const isPending = loginMutation.isPending;
                return (
                  <button
                    key={op.id}
                    disabled={isPending}
                    type="button"
                    onClick={() => handleAuthenticate(op.id, op.name, op.role)}
                    className="group flex w-full items-start gap-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 text-left transition-all hover:border-primary hover:bg-canvas hover:shadow-sm disabled:opacity-50"
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
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate text-sm font-bold text-slate-900">{op.name}</span>
                          <span className="shrink-0 font-mono text-xs text-slate-400">({op.id})</span>
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                          {op.badge}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-slate-700 truncate">{op.roleTitle}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{op.description}</p>
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
              className="space-y-3.5"
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
                  className="h-10 rounded-xl border-slate-300 font-mono text-xs focus-visible:ring-1 focus-visible:ring-primary"
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
                  className="h-10 rounded-xl border-slate-300 text-xs focus-visible:ring-1 focus-visible:ring-primary"
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
                        ? "border-primary bg-surface-elevated font-semibold text-primary-foreground"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    )}
                  >
                    <UserCheck className="h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-xs">Quality Operator</p>
                      <p className="text-xs text-slate-500">Inspection & Analytics</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomRole("admin")}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all",
                      customRole === "admin"
                        ? "border-primary bg-surface-elevated font-semibold text-primary-foreground"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    )}
                  >
                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" />
                    <div>
                      <p className="text-xs">Plant Admin</p>
                      <p className="text-xs text-slate-500">Full System Governance</p>
                    </div>
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loginMutation.isPending || !customId.trim()}
                className="mt-2 h-11 w-full gap-2 rounded-xl bg-primary text-xs font-semibold text-white shadow-md hover:bg-slate-800 disabled:opacity-50"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 text-primary" />
                    Sign In with Operator ID
                  </>
                )}
              </Button>
            </form>
          )}
        </div>

        {/* Pinned Modal Footer: Audit Compliance Guarantee */}
        <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-6 py-3.5 sm:px-8">
          <div className="flex items-start gap-2.5 text-left">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
            <div className="text-xs leading-relaxed text-slate-600">
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
