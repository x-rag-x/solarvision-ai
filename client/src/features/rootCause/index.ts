/**
 * SolarVision AI — Phase 3 & 3B: Root Cause Analysis & Manufacturing Data Feature Module
 * 
 * Public API for Model 2 Root Cause Analysis, 6-Category CSV Onboarding,
 * Inspection Lineage Linking, Expert Ground-Truth Labeling, and Dataset Readiness.
 */

export * from "./types";
export * from "./api";
export * from "./useRootCause";
export * from "./dataOnboardingTypes";
export * from "./csvValidator";
export * from "./dataOnboardingApi";

export { RootCauseOverview } from "./RootCauseOverview";
export { SelectedInspectionPanel } from "./components/SelectedInspectionPanel";
export { ManufacturingContextSection } from "./components/ManufacturingContextSection";
export { ProbableCauseResults } from "./components/ProbableCauseResults";
export { ModelLimitationsCard } from "./components/ModelLimitationsCard";
export { HistoricalPredictionsTable } from "./components/HistoricalPredictionsTable";
export {
  ModelNotTrainedBanner,
  NoManufacturingDataBanner,
  PredictionInProgressSkeleton,
  PredictionFailureBanner,
  ModelUnavailableBanner,
} from "./components/StateBanners";

// Phase 3B Components
export { DataImportDashboard } from "./components/DataImportDashboard";
export { InspectionBatchLinker } from "./components/InspectionBatchLinker";
export { RootCauseConfirmationReview } from "./components/RootCauseConfirmationReview";
export { Model2ReadinessDashboard } from "./components/Model2ReadinessDashboard";
