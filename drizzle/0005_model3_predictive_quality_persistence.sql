-- Drizzle Phase Final / Model 3 Migration: Predictive Quality Forecasting Schema Enrichment
-- Idempotent, non-destructive migration for MySQL / MariaDB

-- 1. Additive columns for Model 3 predictive quality canonical contract
ALTER TABLE `predictive_quality_forecasts`
  ADD COLUMN IF NOT EXISTS `userId` varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS `machineId` varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS `waferId` varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS `modelVersion` varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS `domain` varchar(64) NOT NULL DEFAULT 'solar_cell_manufacturing',
  ADD COLUMN IF NOT EXISTS `isBenchmark` boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS `dataSource` varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS `provenance` varchar(128) NULL,
  ADD COLUMN IF NOT EXISTS `qualityOutcome` varchar(32) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS `failureProbability` float NULL,
  ADD COLUMN IF NOT EXISTS `confidence` float NULL,
  ADD COLUMN IF NOT EXISTS `confidenceInterval` text NULL,
  ADD COLUMN IF NOT EXISTS `forecastHorizon` text NULL,
  ADD COLUMN IF NOT EXISTS `dominantRiskDefect` text NULL,
  ADD COLUMN IF NOT EXISTS `predictedLossPercentage` float NULL,
  ADD COLUMN IF NOT EXISTS `topRiskFactors` json NULL,
  ADD COLUMN IF NOT EXISTS `probabilities` json NULL,
  ADD COLUMN IF NOT EXISTS `inputReference` text NULL,
  ADD COLUMN IF NOT EXISTS `recommendedAction` text NULL,
  ADD COLUMN IF NOT EXISTS `generatedAt` timestamp NULL;
--> statement-breakpoint

-- 2. Indexes for user isolation, domain filtering, and batch lookups
CREATE INDEX IF NOT EXISTS `idx_quality_forecast_user` 
  ON `predictive_quality_forecasts` (`userId`, `createdAt` DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_quality_forecast_domain` 
  ON `predictive_quality_forecasts` (`domain`, `isBenchmark`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_quality_forecast_created` 
  ON `predictive_quality_forecasts` (`createdAt` DESC);
