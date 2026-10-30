import React from "react";
import { useLocation, Link } from "wouter";
import { useAppMode } from "@/contexts/ModeContext";
import { trpc } from "@/lib/trpc";
import NotificationCenter from "@/components/solarvision/NotificationCenter";
import {
  Menu,
  Search,
  ChevronRight,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TopbarProps {
  onOpenMobileNav: () => void;
  onOpenCommandPalette: () => void;
}

// Route breadcrumb metadata mapping
const routeMeta: Record<string, { group: string; label: string }> = {
  "/": { group: "Workspace", label: "Overview" },
  "/inspection": { group: "Inspect & Predict", label: "Defect Detection" },
  "/cell-screening": { group: "Inspect & Predict", label: "Cell Screening" },
  "/predictive-quality": { group: "Inspect & Predict", label: "Performance Forecast" },
  "/predictive-maintenance": { group: "Inspect & Predict", label: "Equipment Health" },
  "/history": { group: "Records", label: "Inspection History" },
  "/analytics": { group: "Records", label: "Defect Analytics" },
  "/model": { group: "Engineering", label: "Model Registry" },
  "/system-health": { group: "Engineering", label: "System Health" },
  "/root-cause": { group: "Experimental", label: "Root-Cause Analysis" },
  "/settings": { group: "Preferences", label: "System Settings" },
};

export function Topbar({ onOpenMobileNav, onOpenCommandPalette }: TopbarProps) {
  const [location] = useLocation();
  const { mode, setMode } = useAppMode();

  // Query real system status
  const { data: modelStatus } = trpc.model.status.useQuery(undefined, {
    staleTime: 15000,
    refetchInterval: 30000,
  });

  // Calculate breadcrumbs accurately
  let currentGroup = "Workspace";
  let currentLabel = "Overview";
  let subDetail: string | null = null;

  if (routeMeta[location]) {
    currentGroup = routeMeta[location].group;
    currentLabel = routeMeta[location].label;
  } else if (location.startsWith("/inspection/")) {
    currentGroup = "Inspect & Predict";
    currentLabel = "Defect Detection";
    const id = location.split("/")[2];
    subDetail = `Record #${id ? id.slice(0, 8) : "Detail"}`;
  } else if (location.startsWith("/root-cause/")) {
    currentGroup = "Experimental";
    currentLabel = "Root-Cause Analysis";
    const id = location.split("/")[2];
    subDetail = `Analysis #${id ? id.slice(0, 8) : "Detail"}`;
  }

  // Real status dot computation
  const isHealthy = modelStatus?.exists ?? true;
  const statusLabel = isHealthy ? "Pipeline Online" : "Degraded Engine";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur-md shadow-xs">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileNav}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-white text-text-3 hover:text-sapphire hover:border-sapphire/50 hover:bg-surface-subtle transition-all shadow-xs lg:hidden"
          aria-label="Open mobile navigation"
        >
          <Menu className="h-4 w-4" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs min-w-0">
          <span className="text-text-3 font-medium hidden sm:inline">{currentGroup}</span>
          <ChevronRight className="h-3.5 w-3.5 text-text-3/50 shrink-0 hidden sm:inline" />
          <span className="font-semibold text-text truncate">{currentLabel}</span>
          {subDetail && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-text-3/50 shrink-0" />
              <span className="font-mono text-[11px] font-medium text-sapphire bg-surface-subtle px-2 py-0.5 rounded-md border border-border truncate max-w-[150px] shadow-2xs">
                {subDetail}
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Right: Search, Mode Switch, Status Dot, Notifications */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* ⌘K Search Palette button */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden md:flex h-9 min-w-[190px] lg:min-w-[230px] items-center justify-between rounded-lg border border-border bg-white px-3 text-xs text-text-3 hover:border-sapphire/50 hover:text-text transition-all shadow-xs"
          aria-label="Search screens or jump to route"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="h-3.5 w-3.5 text-text-3 shrink-0" />
            <span className="truncate">Search commands, routes...</span>
          </div>
          <kbd className="font-mono text-[10px] font-semibold text-text-3 bg-surface-subtle px-1.5 py-0.5 rounded border border-border shrink-0 ml-2">
            ⌘K
          </kbd>
        </button>

        {/* Real Live Pipeline Status Indicator */}
        <Link
          href="/system-health"
          className="hidden sm:inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-2.5 text-xs text-text-2 hover:border-sapphire/50 hover:text-sapphire transition-all shadow-xs shrink-0"
          title={`Click to view diagnostics. System status: ${statusLabel}`}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isHealthy ? "bg-emerald-400 animate-ping" : "bg-amber-400 animate-ping"
              }`}
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                isHealthy ? "bg-emerald-600" : "bg-amber-600"
              }`}
            />
          </span>
          <span className="text-xs font-medium text-[#2F3A58]">{statusLabel}</span>
        </Link>

        {/* Dev | Prod Segmented Mode Switch */}
        <div className="flex h-9 items-center rounded-lg border border-[#D9DDEB] bg-[#E4E7F3] p-0.5 text-xs shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setMode("dev")}
                className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-all ${
                  mode === "dev"
                    ? "bg-[#2F3A58] text-white shadow-xs"
                    : "text-[#59647D] hover:text-[#2F3A58] hover:bg-[#F2DBD7]/60"
                }`}
                aria-pressed={mode === "dev"}
              >
                <Laptop className="h-3 w-3" />
                <span>Dev</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Explain & Experiment (inspectors, samples, batch upload, benchmarks)
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setMode("prod")}
                className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-all ${
                  mode === "prod"
                    ? "bg-[#2F3A58] text-white shadow-xs"
                    : "text-[#59647D] hover:text-[#2F3A58] hover:bg-[#F2DBD7]/60"
                }`}
                aria-pressed={mode === "prod"}
              >
                <span>Prod</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Final Operator Outcome (clean report layouts, printable view)
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Real Notifications */}
        <NotificationCenter />
      </div>
    </header>
  );
}
