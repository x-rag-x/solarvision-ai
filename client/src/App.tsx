import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
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
import { Route, Switch, useLocation } from "wouter";
import { trpc } from "./lib/trpc";
import { Compass } from "lucide-react";

function ProtectedRootCauseRoute() {
  const { data: settings, isLoading } = trpc.system.getSettings.useQuery();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0B0909] border-t-transparent" />
      </div>
    );
  }

  if (!settings?.enableRootCause) {
    return (
      <div className="mx-auto max-w-3xl py-12">
        <div className="rounded-3xl border border-amber-300 bg-white p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-800">
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 uppercase tracking-wider">
                Optional Module Disabled
              </span>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                Root Cause Analysis is Currently Disabled
              </h1>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            The experimental manufacturing root-cause analysis module is currently disabled in system settings. This feature is not trained on a verified, linked factory root-cause dataset and should not be treated as production-grade causal diagnosis.
          </p>

          <div className="rounded-xl border border-slate-200 bg-[#FAF9F5] p-4 text-xs text-slate-600 space-y-2">
            <p className="font-semibold text-slate-800">
              System Invariant &amp; Data Preservation
            </p>
            <p className="leading-relaxed">
              All previously imported batches, equipment configurations, and expert annotations remain safely preserved in the database. When enabled by an authorized administrator, the forensic correlation workflow will be instantly restored.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => setLocation("/")}
              className="rounded-xl bg-[#0B0909] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
            >
              Return to Overview
            </button>
            <button
              onClick={() => setLocation("/settings")}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
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
        <Route path="/" component={Home} />
        <Route path="/inspection" component={Inspection} />
        <Route path="/inspect" component={Inspection} />
        <Route path="/inspection/:inspectionId" component={InspectionDetail} />
        <Route path="/cell-screening" component={CellScreening} />
        <Route path="/cell%20screening" component={CellScreening} />
        <Route path="/cell_screening" component={CellScreening} />
        <Route path="/model2-screening" component={CellScreening} />
        <Route path="/root-cause" component={ProtectedRootCauseRoute} />
        <Route path="/root%20cause" component={ProtectedRootCauseRoute} />
        <Route path="/root cause" component={ProtectedRootCauseRoute} />
        <Route path="/root_cause" component={ProtectedRootCauseRoute} />
        <Route path="/root-cause/:inspectionId" component={ProtectedRootCauseRoute} />
        <Route path="/predictive-quality" component={PredictiveQualityOverview} />
        <Route path="/predictive-quality/sandia" component={PredictiveQualityOverview} />
        <Route path="/predictive-quality/secom" component={PredictiveQualityOverview} />
        <Route path="/sandia-performance" component={PredictiveQualityOverview} />
        <Route path="/predictive%20quality" component={PredictiveQualityOverview} />
        <Route path="/predictive quality" component={PredictiveQualityOverview} />
        <Route path="/predictive_quality" component={PredictiveQualityOverview} />
        <Route path="/predictive-maintenance" component={PredictiveMaintenanceOverview} />
        <Route path="/predictive%20maintenance" component={PredictiveMaintenanceOverview} />
        <Route path="/predictive maintenance" component={PredictiveMaintenanceOverview} />
        <Route path="/predictive_maintenance" component={PredictiveMaintenanceOverview} />
        <Route path="/history" component={History} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/model" component={ModelPerformance} />
        <Route path="/system-health" component={SystemHealth} />
        <Route path="/system_health" component={SystemHealth} />
        <Route path="/health" component={SystemHealth} />
        <Route path="/settings" component={Settings} />
        <Route path="/roadmap" component={Roadmap} />
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
        <TooltipProvider>
          <Toaster />
          <OperatorLoginDialog />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
