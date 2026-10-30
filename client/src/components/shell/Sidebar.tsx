import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAppMode } from "@/contexts/ModeContext";
import { trpc } from "@/lib/trpc";
import { UserMenu } from "./UserMenu";
import {
  LayoutGrid,
  ScanLine,
  Scan,
  Zap,
  Wrench,
  FileClock,
  BarChart3,
  BrainCircuit,
  HeartPulse,
  Settings2,
  Compass,
  Factory,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean | ((c: boolean) => boolean)) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  modelChip?: string;
  adminOnly?: boolean;
  devOnly?: boolean;
  badge?: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { isDev } = useAppMode();
  const isAdmin = user?.role === "admin";

  const { data: systemSettings } = trpc.system.getSettings.useQuery();
  const enableRootCause = Boolean(systemSettings?.enableRootCause);

  // Queries for live model status in Dev mode
  const { data: m1Status } = trpc.model.status.useQuery(undefined, { enabled: isDev, staleTime: 30000 });
  const { data: m2Status } = trpc.model2Elpv.status.useQuery(undefined, { enabled: isDev, staleTime: 30000 });
  const { data: m3Status } = trpc.sandiaPerformance.status.useQuery(undefined, { enabled: isDev, staleTime: 30000 });
  const { data: m4Status } = trpc.predictiveMaintenance.status.useQuery(undefined, { enabled: isDev, staleTime: 30000 });

  const navGroups: NavGroup[] = [
    {
      group: "Workspace",
      items: [
        { label: "Overview", path: "/", icon: LayoutGrid },
      ],
    },
    {
      group: "Inspect & Predict",
      items: [
        { label: "Defect detection", path: "/inspection", icon: ScanLine, modelChip: "M1" },
        { label: "Cell screening", path: "/cell-screening", icon: Scan, modelChip: "M2" },
        { label: "Performance forecast", path: "/predictive-quality", icon: Zap, modelChip: "M3" },
        { label: "Equipment health", path: "/predictive-maintenance", icon: Wrench, modelChip: "M4" },
      ],
    },
    {
      group: "Records",
      items: [
        { label: "Inspection history", path: "/history", icon: FileClock },
        { label: "Defect analytics", path: "/analytics", icon: BarChart3 },
      ],
    },
    {
      group: "Engineering",
      items: [
        { label: "Model registry", path: "/model", icon: BrainCircuit, adminOnly: true },
        { label: "System health", path: "/system-health", icon: HeartPulse, adminOnly: true },
      ],
    },
    ...(enableRootCause
      ? [
          {
            group: "Experimental",
            items: [
              { label: "Root cause analysis", path: "/root-cause", icon: Compass, badge: "Beta" },
            ],
          },
        ]
      : []),
  ];

  // Helper to determine active state using canonical matching
  const isItemActive = (path: string) => {
    if (path === "/") return location === "/";
    return location === path || location.startsWith(`${path}/`);
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#2F3A58]/40 backdrop-blur-xs lg:hidden"
          onClick={closeMobile}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-[#E4E7F3] text-[#2F3A58] transition-all duration-200 select-none shadow-xs ${
          collapsed ? "w-[72px]" : "w-[248px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Brand header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-3.5">
          <Link
            href="/"
            onClick={closeMobile}
            className="flex items-center gap-2.5 overflow-hidden focus-visible:ring-2 focus-visible:ring-sapphire rounded-lg transition-transform active:scale-[0.99]"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sapphire text-white shadow-xs">
              <Factory className="h-4 w-4 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex flex-col">
                <span className="text-[15px] font-bold tracking-tight text-[#2F3A58] leading-tight">
                  SolarVision <span className="text-sapphire font-bold">AI</span>
                </span>
                <span className="text-[10px] text-text-3 font-semibold uppercase tracking-wider">
                  ENTERPRISE OPS
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden lg:grid h-7 w-7 place-items-center rounded-md text-text-3 hover:text-text hover:bg-[#D8DCED] transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-2 py-3.5 space-y-4 sidebar-scrollbar">
          {navGroups.map(group => {
            // Filter items based on Dev vs Prod & Admin permissions
            const visibleItems = group.items.filter(item => {
              if (item.devOnly && !isDev) return false;
              if (item.adminOnly && !isDev && !isAdmin) return false;
              return true;
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={group.group} className="space-y-1">
                {!collapsed && (
                  <div className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#59647D]">
                    {group.group}
                  </div>
                )}
                {visibleItems.map(item => {
                  const active = isItemActive(item.path);
                  const Icon = item.icon;

                  const navContent = (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={closeMobile}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-150 ${
                        active
                          ? "bg-[#F2DBD7] text-[#2F3A58] font-semibold shadow-xs"
                          : "text-[#59647D] hover:bg-[#D8DCED] hover:text-[#2F3A58]"
                      } ${collapsed ? "justify-center px-0 h-9 w-9 mx-auto" : "w-full"}`}
                    >
                      {/* Active indicator bar */}
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#965660]" />
                      )}
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          active ? "text-[#965660]" : "text-[#59647D] group-hover:text-[#2F3A58]"
                        }`}
                      />
                      {!collapsed && (
                        <div className="flex items-center justify-between flex-1 min-w-0">
                          <span className="truncate">{item.label}</span>
                          <div className="flex items-center gap-1.5">
                            {item.modelChip && (
                              <span className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sapphire border border-border">
                                {item.modelChip}
                              </span>
                            )}
                            {item.badge && (
                              <span className="rounded bg-soft-lavender-tint px-1.5 py-0.5 text-[10px] font-semibold text-sapphire border border-soft-lavender/40">
                                {item.badge}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </Link>
                  );

                  if (collapsed) {
                    return (
                      <Tooltip key={item.path} delayDuration={0}>
                        <TooltipTrigger asChild>{navContent}</TooltipTrigger>
                        <TooltipContent side="right" className="text-xs font-medium bg-[#2F3A58] text-white border-[#D9DDEB]">
                          {item.label} {item.modelChip ? `(${item.modelChip})` : ""}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return navContent;
                })}
              </div>
            );
          })}

          {/* Dev-only Live Status Panel */}
          {isDev && !collapsed && (
            <div className="pt-2">
              <div className="rounded-2xl border border-[#D9DDEB] bg-[#D8DCED]/60 p-3 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#59647D]">
                  <span>Live Model Status</span>
                  <span className="text-[11px] font-mono font-bold tracking-wider text-[#965660]">DEV</span>
                </div>
                <div className="space-y-1.5 text-xs text-[#2F3A58]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-medium text-[#2F3A58]">M1 YOLO26n</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          m1Status?.exists ? "bg-emerald-600" : "bg-amber-600"
                        }`}
                      />
                      <span className="text-[11px] font-mono text-[#59647D]">
                        {m1Status?.exists ? "ready" : "fallback"}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-medium text-[#2F3A58]">M2 ELPV</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          m2Status?.artifactsPresent ? "bg-emerald-600" : "bg-amber-600"
                        }`}
                      />
                      <span className="text-[11px] font-mono text-[#59647D]">
                        {m2Status?.artifactsPresent ? "ready" : "uncal"}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-medium text-[#2F3A58]">M3 Sandia</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          m3Status?.isReady ? "bg-emerald-600" : "bg-rose-600"
                        }`}
                      />
                      <span className="text-[11px] font-mono text-[#59647D]">
                        {m3Status?.isReady ? "verified" : "err"}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-medium text-[#2F3A58]">M4 AI4I Maint</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          m4Status?.isReady ? "bg-emerald-600" : "bg-amber-600"
                        }`}
                      />
                      <span className="text-[11px] font-mono text-[#59647D]">
                        {m4Status?.isReady ? "ready" : "eval"}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer: Settings & User Menu */}
        <div className="border-t border-[#D9DDEB] p-2 space-y-1 bg-[#DBE0F0]">
          <Link
            href="/settings"
            onClick={closeMobile}
            className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-150 ${
              location === "/settings"
                ? "bg-[#F2DBD7] text-[#2F3A58] font-semibold shadow-xs"
                : "text-[#59647D] hover:bg-[#D8DCED]/70 hover:text-[#2F3A58]"
            } ${collapsed ? "justify-center px-0 h-9 w-9 mx-auto" : "w-full"}`}
          >
            {location === "/settings" && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#965660]" />
            )}
            <Settings2
              className={`h-4 w-4 shrink-0 transition-colors ${
                location === "/settings" ? "text-[#2F3A58]" : "text-[#59647D] group-hover:text-[#2F3A58]"
              }`}
            />
            {!collapsed && <span>Settings</span>}
          </Link>
          <div className="pt-1">
            <UserMenu collapsed={collapsed} />
          </div>
        </div>
      </aside>
    </>
  );
}
