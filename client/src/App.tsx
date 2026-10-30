import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ModeProvider } from "./contexts/ModeContext";
import Analytics from "./pages/Analytics";
import Home from "./pages/Home";
import Inspection from "./pages/Inspection";
import ModelPerformance from "./pages/ModelPerformance";
import NotFound from "./pages/NotFound";
import Roadmap from "./pages/Roadmap";
import History from "./pages/History";
import Settings from "./pages/Settings";
import InspectionDetail from "./pages/InspectionDetail";
import CellScreening from "./pages/CellScreening";
import SystemHealth from "./pages/SystemHealth";
import { RootCauseOverview } from "./features/rootCause";
import { PredictiveQualityOverview } from "./features/predictiveQuality";
import { PredictiveMaintenanceOverview } from "./features/predictiveMaintenance";
import { OperatorLoginDialog } from "./components/solarvision/OperatorLoginDialog";
import { Route, Switch, Redirect, useLocation } from "wouter";
import { trpc } from "./lib/trpc";
import { Compass, AlertCircle, ArrowLeft, Settings2 } from "lucide-react";

function ProtectedRootCauseRoute() {
  const { data: settings, isLoading } = trpc.system.getSettings.useQuery();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      </div>
    );
  }

  if (!settings?.enableRootCause) {
    return (
      <div className="mx-auto max-w-2xl py-12 px-4">
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 space-y-5 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-warning-tint text-warning">
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-warning-tint px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-warning">
                  Optional Module Disabled
                </span>
                <span className="rounded bg-surface-subtle px-1.5 py-0.5 font-mono text-xs text-text-3 border border-border">
                  Beta
                </span>
              </div>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-text">
                Root Cause Analysis is Disabled
              </h1>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-text-2">
            The experimental manufacturing root-cause analysis module is currently toggled off in system settings.
            This research feature is not trained on factory-certified causal graphs and must not be used for automatic rejection.
          </p>

          <div className="rounded-xl border border-border bg-surface-subtle p-4 text-xs text-text-2 space-y-1.5">
            <p className="font-semibold text-text">
              System Invariant &amp; Data Preservation
            </p>
            <p className="leading-relaxed text-text-3">
              All previously imported batches, equipment configurations, and expert annotations remain securely preserved in the database. When enabled in Settings by an administrator, the correlation workflow will be restored instantly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => setLocation("/")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-ink/90 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Return to Overview
            </button>
            <button
              onClick={() => setLocation("/settings")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-2 shadow-xs hover:bg-surface-subtle transition-colors"
            >
              <Settings2 className="h-3.5 w-3.5 text-text-3" />
              Configure in Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <RootCauseOverview />;
}

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        {/* Canonical Routes */}
        <Route path="/" component={Home} />
        <Route path="/inspection" component={Inspection} />
        <Route path="/inspection/:inspectionId" component={InspectionDetail} />
        <Route path="/cell-screening" component={CellScreening} />
        <Route path="/predictive-quality" component={PredictiveQualityOverview} />
        <Route path="/predictive-maintenance" component={PredictiveMaintenanceOverview} />
        <Route path="/history" component={History} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/model" component={ModelPerformance} />
        <Route path="/system-health" component={SystemHealth} />
        <Route path="/roadmap" component={Roadmap} />
        <Route path="/settings" component={Settings} />
        <Route path="/root-cause" component={ProtectedRootCauseRoute} />
        <Route path="/root-cause/:inspectionId" component={ProtectedRootCauseRoute} />

        {/* Alias Redirects (§5.3: 15 canonical routes + 1 redirect rule) */}
        <Route path="/inspect">
          <Redirect to="/inspection" replace />
        </Route>
        <Route path="/cell%20screening">
          <Redirect to="/cell-screening" replace />
        </Route>
        <Route path="/cell_screening">
          <Redirect to="/cell-screening" replace />
        </Route>
        <Route path="/model2-screening">
          <Redirect to="/cell-screening" replace />
        </Route>
        <Route path="/predictive-quality/sandia">
          <Redirect to="/predictive-quality?view=sandia" replace />
        </Route>
        <Route path="/sandia-performance">
          <Redirect to="/predictive-quality?view=sandia" replace />
        </Route>
        <Route path="/predictive-quality/secom">
          <Redirect to="/predictive-quality?view=secom" replace />
        </Route>
        <Route path="/predictive%20quality">
          <Redirect to="/predictive-quality" replace />
        </Route>
        <Route path="/predictive quality">
          <Redirect to="/predictive-quality" replace />
        </Route>
        <Route path="/predictive_quality">
          <Redirect to="/predictive-quality" replace />
        </Route>
        <Route path="/predictive%20maintenance">
          <Redirect to="/predictive-maintenance" replace />
        </Route>
        <Route path="/predictive maintenance">
          <Redirect to="/predictive-maintenance" replace />
        </Route>
        <Route path="/predictive_maintenance">
          <Redirect to="/predictive-maintenance" replace />
        </Route>
        <Route path="/root%20cause">
          <Redirect to="/root-cause" replace />
        </Route>
        <Route path="/root cause">
          <Redirect to="/root-cause" replace />
        </Route>
        <Route path="/root_cause">
          <Redirect to="/root-cause" replace />
        </Route>
        <Route path="/system_health">
          <Redirect to="/system-health" replace />
        </Route>
        <Route path="/health">
          <Redirect to="/system-health" replace />
        </Route>

        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <ModeProvider>
          <TooltipProvider>
            <Toaster />
            <OperatorLoginDialog />
            <Router />
          </TooltipProvider>
        </ModeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
