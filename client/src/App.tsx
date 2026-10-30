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
import { RootCauseOverview } from "./features/rootCause";
import { PredictiveQualityOverview } from "./features/predictiveQuality";
import { PredictiveMaintenanceOverview } from "./features/predictiveMaintenance";
import { OperatorLoginDialog } from "./components/solarvision/OperatorLoginDialog";
import { Route, Switch } from "wouter";

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
        <Route path="/root-cause" component={RootCauseOverview} />
        <Route path="/root%20cause" component={RootCauseOverview} />
        <Route path="/root cause" component={RootCauseOverview} />
        <Route path="/root_cause" component={RootCauseOverview} />
        <Route path="/root-cause/:inspectionId" component={RootCauseOverview} />
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
