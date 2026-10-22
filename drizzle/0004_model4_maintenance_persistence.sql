-- Drizzle Phase 3 / Model 4 Migration: Predictive Maintenance Equipment Persistence & Schema Enrichment
-- Idempotent, non-destructive migration for MySQL / MariaDB

-- 1. Additive columns for Model 4 predictive maintenance data contract
ALTER TABLE `maintenance_predictions`
  ADD COLUMN IF NOT EXISTS `userId` varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS `domain` varchar(64) NOT NULL DEFAULT 'solar_factory',
  ADD COLUMN IF NOT EXISTS `dataSource` varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS `machineCategory` varchar(128) NULL,
  ADD COLUMN IF NOT EXISTS `measurementTimestamp` timestamp NULL,
  ADD COLUMN IF NOT EXISTS `sensorValues` json NULL,
  ADD COLUMN IF NOT EXISTS `healthState` varchar(32) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS `failureMode` varchar(64) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS `healthyProbability` float NULL,
  ADD COLUMN IF NOT EXISTS `confidence` float NULL,
  ADD COLUMN IF NOT EXISTS `riskFactors` json NULL,
  ADD COLUMN IF NOT EXISTS `modeProbabilities` json NULL,
  ADD COLUMN IF NOT EXISTS `isBenchmark` boolean NOT NULL DEFAULT false;
--> statement-breakpoint

-- 2. Indexes for user isolation, equipment lookup and domain filtering
CREATE INDEX IF NOT EXISTS `idx_maintenance_user_machine` 
  ON `maintenance_predictions` (`userId`, `machineId`, `createdAt` DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_maintenance_domain_bench` 
  ON `maintenance_predictions` (`domain`, `isBenchmark`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_maintenance_machine_created` 
  ON `maintenance_predictions` (`machineId`, `createdAt` DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_maintenance_urgency` 
  ON `maintenance_predictions` (`urgency`, `createdAt` DESC);
