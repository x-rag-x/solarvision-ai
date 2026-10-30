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
    accent: "text-sapphire bg-sapphire/10 border-sapphire/30",
  },
  {
    id: "QE-2044",
    name: "Elena Rostova",
    role: "user",
    badge: "Quality Eng.",
    roleTitle: "Reliability & Yield Specialist",
    description: "Evaluates defect clusters, SECOM quality models, and production line yield trends.",
    icon: Microscope,
    accent: "text-terracotta bg-terracotta/10 border-terracotta/30",
  },
  {
    id: "admin-marcus",
    name: "Marcus Vance",
    role: "admin",
    badge: "Plant Admin",
    roleTitle: "Quality Assurance Director",
    description: "Full factory governance, equipment calibration overrides, and operator credential provisioning.",
    icon: ShieldCheck,
    accent: "text-soft-lavender-text bg-soft-lavender-tint border-soft-lavender/40",
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
      <DialogContent className="w-[calc(100%-2rem)] max-w-xl max-h-[90vh] sm:max-h-[85vh] flex flex-col p-0 gap-0 rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden focus:outline-none">
        {/* Pinned Modal Header */}
        <div className="shrink-0 border-b border-border bg-surface px-6 pt-6 pb-4 sm:px-8 sm:pt-6 sm:pb-4">
          <DialogHeader className="text-left space-y-2 pr-8 sm:pr-10">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sapphire text-white shadow-xs">
                <Lock className="h-5 w-5 text-dusty-pink" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-sapphire">
                    Restricted Quality Zone
                  </span>
                  <span className="rounded bg-surface-subtle px-1.5 py-0.5 text-xs font-mono text-text-3 border border-border">
                    Zero-Fabrication Mode
                  </span>
                </div>
                <DialogTitle className="text-lg font-bold tracking-tight text-[#2F3A58] sm:text-xl">
                  Operator ID Authentication
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-xs leading-relaxed text-text-3 pt-0.5">
              Authenticate your quality engineering session to unlock the YOLO26n computer vision pipeline,
              execute live solar cell defect inspections, and persist results to the factory audit database.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable Content Region */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-4 sm:px-8 sm:py-5 space-y-4">
          {/* Staging Access Control: Operator Passcode */}
          <div className="rounded-xl border border-border bg-surface-subtle p-3.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <Label htmlFor="operator-passcode" className="text-xs font-semibold text-text-2 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-sapphire" />
                Operator Access Passcode
              </Label>
              {passcodeRequired ? (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300">
                  Required in Staging
                </span>
              ) : (
                <span className="text-xs text-text-3 font-mono">Optional</span>
              )}
            </div>
            <Input
              id="operator-passcode"
              type="password"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              placeholder={passcodeRequired ? "Enter operator passcode configured in Render" : "Enter passcode if configured"}
              className="h-9 rounded-lg border-border bg-surface font-mono text-xs focus-visible:ring-1 focus-visible:ring-sapphire"
            />
          </div>

          {/* Tab Selection */}
          <div className="flex rounded-lg bg-surface-subtle p-1 text-xs font-semibold border border-border">
            <button
              type="button"
              onClick={() => setActiveTab("presets")}
              className={cn(
                "flex-1 rounded-md py-1.5 transition-all text-xs",
                activeTab === "presets"
                  ? "bg-surface text-sapphire shadow-xs font-bold"
                  : "text-text-3 hover:text-text"
              )}
            >
              Certified Operator Presets (1-Click)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("custom")}
              className={cn(
                "flex-1 rounded-md py-1.5 transition-all text-xs",
                activeTab === "custom"
                  ? "bg-surface text-sapphire shadow-xs font-bold"
                  : "text-text-3 hover:text-text"
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
                    className="group flex w-full items-start gap-3.5 rounded-xl border border-border bg-surface p-3.5 text-left transition-all hover:border-sapphire hover:bg-surface-subtle hover:shadow-xs disabled:opacity-50 cursor-pointer"
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
                          <span className="truncate text-sm font-bold text-text">{op.name}</span>
                          <span className="shrink-0 font-mono text-xs text-text-3">({op.id})</span>
                        </div>
                        <span className="shrink-0 rounded-full bg-surface-subtle px-2 py-0.5 text-xs font-semibold text-text-2 border border-border">
                          {op.badge}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-text-2 truncate">{op.roleTitle}</p>
                      <p className="mt-1 text-xs leading-relaxed text-text-3">{op.description}</p>
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
                <Label htmlFor="operator-id" className="text-xs font-semibold text-text-2">
                  Operator Badge ID
                </Label>
                <Input
                  id="operator-id"
                  value={customId}
                  onChange={e => setCustomId(e.target.value)}
                  placeholder="e.g. OP-1042 or TECH-88"
                  className="h-10 rounded-xl border-border font-mono text-xs focus-visible:ring-1 focus-visible:ring-sapphire"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="operator-name" className="text-xs font-semibold text-text-2">
                  Operator Full Name
                </Label>
                <Input
                  id="operator-name"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="e.g. Jordan Miller"
                  className="h-10 rounded-xl border-border text-xs focus-visible:ring-1 focus-visible:ring-sapphire"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-text-2">Quality Access Role</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCustomRole("user")}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all cursor-pointer",
                      customRole === "user"
                        ? "border-sapphire bg-sapphire/10 font-semibold text-sapphire"
                        : "border-border bg-surface text-text-2 hover:border-sapphire/40"
                    )}
                  >
                    <UserCheck className="h-4 w-4 shrink-0 text-sapphire" />
                    <div>
                      <p className="text-xs font-semibold">Quality Operator</p>
                      <p className="text-xs text-text-3">Inspection & Analytics</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomRole("admin")}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all cursor-pointer",
                      customRole === "admin"
                        ? "border-terracotta bg-terracotta/10 font-semibold text-terracotta"
                        : "border-border bg-surface text-text-2 hover:border-terracotta/40"
                    )}
                  >
                    <ShieldCheck className="h-4 w-4 shrink-0 text-terracotta" />
                    <div>
                      <p className="text-xs font-semibold">Plant Admin</p>
                      <p className="text-xs text-text-3">Full System Governance</p>
                    </div>
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loginMutation.isPending || !customId.trim()}
                className="mt-2 h-11 w-full gap-2 rounded-xl bg-[#965660] text-xs font-semibold text-white shadow-md hover:bg-[#7E454E] disabled:opacity-50"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[#F2DBD7]" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 text-[#F2DBD7]" />
                    Sign In with Operator ID
                  </>
                )}
              </Button>
            </form>
          )}
        </div>

        {/* Pinned Modal Footer: Audit Compliance Guarantee */}
        <div className="shrink-0 border-t border-border bg-surface-subtle px-6 py-3.5 sm:px-8">
          <div className="flex items-start gap-2.5 text-left">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-3" />
            <div className="text-xs leading-relaxed text-text-2">
              <span className="font-semibold text-sapphire">Audit Compliance:</span> Every YOLO26n inspection
              run is cryptographically bound to the authenticated operator's identity and timestamped in the
              factory quality database.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
