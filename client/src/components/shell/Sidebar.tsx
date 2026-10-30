import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAppMode } from "@/contexts/ModeContext";
import { trpc } from "@/lib/trpc";
import { UserMenu } from "./UserMenu";
import {
  LayoutDashboard,
  ScanLine,
  Scan,
  Zap,
  Wrench,
  FileClock,
  BarChart3,
  BrainCircuit,
  HeartPulse,
  Route as RouteIcon,
  Settings2,
  Compass,
  Factory,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
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
        { label: "Overview", path: "/", icon: LayoutDashboard },
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
        { label: "Architecture", path: "/roadmap", icon: RouteIcon, devOnly: true },
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
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-xs lg:hidden"
          onClick={closeMobile}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-surface transition-all duration-200 select-none ${
          collapsed ? "w-[72px]" : "w-[248px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Brand header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <Link
            href="/"
            onClick={closeMobile}
            className="flex items-center gap-2.5 overflow-hidden focus-visible:ring-2 focus-visible:ring-focus rounded-lg"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-ink shadow-xs">
              <Factory className="h-4 w-4" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex flex-col">
                <span className="text-sm font-semibold tracking-tight text-text leading-tight">
                  SolarVision <span className="text-brand-text font-bold">AI</span>
                </span>
                <span className="text-xs text-text-3 font-medium uppercase tracking-wider">
                  Quality Ops
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden lg:grid h-7 w-7 place-items-center rounded-md text-text-3 hover:text-text hover:bg-surface-subtle transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5">
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
                  <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-text-3">
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
                      className={`group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${
                        active
                          ? "bg-brand-tint text-text font-semibold shadow-xs"
                          : "text-text-2 hover:bg-surface-subtle hover:text-text"
                      } ${collapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "w-full"}`}
                    >
                      {/* Active indicator bar */}
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-brand" />
                      )}
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          active ? "text-text" : "text-text-3 group-hover:text-text"
                        }`}
                      />
                      {!collapsed && (
                        <div className="flex items-center justify-between flex-1 min-w-0">
                          <span className="truncate">{item.label}</span>
                          <div className="flex items-center gap-1.5">
                            {isDev && item.modelChip && (
                              <span className="rounded bg-surface-subtle px-1.5 py-0.5 font-mono text-xs text-text-3 border border-border">
                                {item.modelChip}
                              </span>
                            )}
                            {item.badge && (
                              <span className="rounded bg-brand-tint px-1.5 py-0.5 text-xs font-semibold text-brand-text">
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
                        <TooltipContent side="right" className="text-xs font-medium">
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
              <div className="rounded-xl border border-border bg-surface-subtle p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-3">
                  <span>Live Model Status</span>
                  <span className="text-xs font-mono text-brand-text">DEV</span>
                </div>
                <div className="space-y-1.5 text-xs text-text-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">M1 YOLO26n</span>
                    <span className="inline-flex items-center gap-1">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          m1Status?.exists ? "bg-success" : "bg-warning"
                        }`}
                      />
                      <span className="text-xs font-mono text-text-3">
                        {m1Status?.exists ? "ready" : "fallback"}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">M2 ELPV</span>
                    <span className="inline-flex items-center gap-1">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          m2Status?.artifactsPresent ? "bg-success" : "bg-warning"
                        }`}
                      />
                      <span className="text-xs font-mono text-text-3">
                        {m2Status?.artifactsPresent ? "ready" : "uncal"}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">M3 Sandia</span>
                    <span className="inline-flex items-center gap-1">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          m3Status?.isReady ? "bg-success" : "bg-danger"
                        }`}
                      />
                      <span className="text-xs font-mono text-text-3">
                        {m3Status?.isReady ? "verified" : "err"}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">M4 AI4I Maint</span>
                    <span className="inline-flex items-center gap-1">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          m4Status?.isReady ? "bg-success" : "bg-warning"
                        }`}
                      />
                      <span className="text-xs font-mono text-text-3">
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
        <div className="border-t border-border p-2.5 space-y-1.5 bg-surface">
          <Link
            href="/settings"
            onClick={closeMobile}
            className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
              location === "/settings"
                ? "bg-brand-tint text-text font-semibold"
                : "text-text-2 hover:bg-surface-subtle hover:text-text"
            } ${collapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "w-full"}`}
          >
            <Settings2 className="h-4 w-4 shrink-0 text-text-3" />
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
