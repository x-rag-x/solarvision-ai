-- Drizzle Model 3 Migration: Sandia Solar Electrical Performance Prediction Schema
-- Idempotent, non-destructive migration for MySQL / MariaDB

CREATE TABLE IF NOT EXISTS `sandia_performance_predictions` (
  `id` varchar(64) NOT NULL,
  `userId` varchar(64) NULL,
  `moduleId` varchar(64) NULL,
  `inputFeatures` json NOT NULL,
  `predictedValue` double NOT NULL,
  `predictionLabel` varchar(64) NULL,
  `targetName` varchar(64) NOT NULL,
  `targetUnit` varchar(32) NULL,
  `confidence` float NULL,
  `uncertainty` float NULL,
  `featuresUsed` json NULL,
  `modelVersion` varchar(64) NOT NULL DEFAULT '1.0.0',
  `datasetProvenance` varchar(128) NOT NULL DEFAULT 'Sandia National Laboratories PV Performance Modeling Telemetry',
  `isMock` boolean NOT NULL DEFAULT false,
  `warnings` json NULL,
  `metadata` json NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `sandia_performance_predictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_sandia_predictions_user_created`
  ON `sandia_performance_predictions` (`userId`, `createdAt` DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_sandia_predictions_module`
  ON `sandia_performance_predictions` (`moduleId`, `createdAt` DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_sandia_predictions_created`
  ON `sandia_performance_predictions` (`createdAt` DESC);
