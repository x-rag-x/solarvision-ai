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
  "/roadmap": { group: "Engineering", label: "Four-Model Architecture" },
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
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur-md">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileNav}
          className="grid h-9 w-9 place-items-center rounded-lg text-text-3 hover:text-text hover:bg-surface-subtle lg:hidden"
          aria-label="Open mobile navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
          <span className="text-text-3 font-medium hidden sm:inline">{currentGroup}</span>
          <ChevronRight className="h-3.5 w-3.5 text-text-3 hidden sm:inline" />
          <span className="font-semibold text-text truncate">{currentLabel}</span>
          {subDetail && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-text-3" />
              <span className="font-mono text-text-2 bg-surface-subtle px-1.5 py-0.5 rounded border border-border truncate max-w-[140px]">
                {subDetail}
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Right: Search, Mode Switch, Status Dot, Notifications */}
      <div className="flex items-center gap-2.5">
        {/* ⌘K Search Palette button */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-surface-subtle px-2.5 py-1.5 text-xs text-text-3 hover:border-brand hover:text-text transition-colors"
          aria-label="Search screens or jump to route"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="pr-2">Search...</span>
          <kbd className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded border border-border">
            ⌘K
          </kbd>
        </button>

        {/* Real Live Pipeline Status Indicator */}
        <Link
          href="/system-health"
          className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-xs text-text-2 hover:border-brand transition-colors"
          title={`Click to view diagnostics. System status: ${statusLabel}`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isHealthy ? "bg-success" : "bg-warning animate-pulse"
            }`}
          />
          <span className="text-xs font-medium">{statusLabel}</span>
        </Link>

        {/* Dev | Prod Segmented Mode Switch */}
        <div className="flex items-center rounded-lg border border-border bg-surface-subtle p-0.5 text-xs">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setMode("dev")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  mode === "dev"
                    ? "bg-surface text-brand-text shadow-xs border border-brand/30"
                    : "text-text-3 hover:text-text"
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
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  mode === "prod"
                    ? "bg-surface text-text shadow-xs border border-border"
                    : "text-text-3 hover:text-text"
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
