-- Drizzle Phase 2 Migration: Indexes, Integrity Constraints, and Future Model Schema Readiness
-- Idempotent / safe migration for MySQL / MariaDB

-- 1. Index optimization for existing inspection and detection tables
CREATE INDEX IF NOT EXISTS `idx_detections_inspection_id` ON `detections` (`inspectionId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_detections_defect_type` ON `detections` (`defectType`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_inspections_created_at` ON `inspections` (`createdAt` DESC);
--> statement-breakpoint

-- 2. Schema enrichment on inspections table for traceability and Industry 4.0 integration
ALTER TABLE `inspections` 
  ADD COLUMN IF NOT EXISTS `batchId` varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS `machineId` varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS `modelVersionId` varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS `operatorId` varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS `isFlagged` boolean NOT NULL DEFAULT false;
--> statement-breakpoint

-- 3. Model versions registry
CREATE TABLE IF NOT EXISTS `model_versions` (
  `id` varchar(64) NOT NULL,
  `modelName` varchar(128) NOT NULL,
  `version` varchar(64) NOT NULL,
  `framework` varchar(64) NOT NULL,
  `artifactUri` text,
  `metrics` json,
  `status` varchar(32) NOT NULL DEFAULT 'active',
  `description` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `model_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

-- 4. Manufacturing batches
CREATE TABLE IF NOT EXISTS `manufacturing_batches` (
  `id` varchar(64) NOT NULL,
  `batchNumber` varchar(64) NOT NULL,
  `waferType` varchar(64) NOT NULL,
  `cellLine` varchar(64) NOT NULL,
  `targetQuantity` int NOT NULL,
  `actualQuantity` int NOT NULL DEFAULT 0,
  `status` varchar(32) NOT NULL DEFAULT 'in_progress',
  `startTime` timestamp NOT NULL DEFAULT (now()),
  `endTime` timestamp NULL,
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `manufacturing_batches_id` PRIMARY KEY(`id`),
  CONSTRAINT `manufacturing_batches_batch_unique` UNIQUE(`batchNumber`)
);
--> statement-breakpoint

-- 5. Manufacturing machines
CREATE TABLE IF NOT EXISTS `manufacturing_machines` (
  `id` varchar(64) NOT NULL,
  `machineCode` varchar(64) NOT NULL,
  `machineType` varchar(64) NOT NULL,
  `lineId` varchar(64) NOT NULL,
  `location` varchar(128),
  `status` varchar(32) NOT NULL DEFAULT 'operational',
  `lastMaintenanceAt` timestamp NULL,
  `nextMaintenanceDue` timestamp NULL,
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `manufacturing_machines_id` PRIMARY KEY(`id`),
  CONSTRAINT `manufacturing_machines_code_unique` UNIQUE(`machineCode`)
);
--> statement-breakpoint

-- 6. Sensor measurements
CREATE TABLE IF NOT EXISTS `sensor_measurements` (
  `id` varchar(64) NOT NULL,
  `machineId` varchar(64) NOT NULL,
  `batchId` varchar(64) NULL,
  `sensorType` varchar(64) NOT NULL,
  `measurementValue` double NOT NULL,
  `unit` varchar(32) NOT NULL,
  `isAnomaly` boolean NOT NULL DEFAULT false,
  `anomalyScore` float NULL,
  `recordedAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `sensor_measurements_id` PRIMARY KEY(`id`),
  CONSTRAINT `fk_sensor_machine` FOREIGN KEY (`machineId`) REFERENCES `manufacturing_machines`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sensor_machine_time` ON `sensor_measurements` (`machineId`, `recordedAt` DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sensor_recorded_at` ON `sensor_measurements` (`recordedAt` DESC);
--> statement-breakpoint

-- 7. Production events
CREATE TABLE IF NOT EXISTS `production_events` (
  `id` varchar(64) NOT NULL,
  `machineId` varchar(64) NULL,
  `batchId` varchar(64) NULL,
  `eventType` varchar(64) NOT NULL,
  `severity` varchar(32) NOT NULL DEFAULT 'info',
  `message` text NOT NULL,
  `details` json,
  `startedAt` timestamp NOT NULL,
  `resolvedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `production_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_production_events_started` ON `production_events` (`startedAt` DESC);
--> statement-breakpoint

-- 8. Root-cause predictions
CREATE TABLE IF NOT EXISTS `root_cause_predictions` (
  `id` varchar(64) NOT NULL,
  `inspectionId` varchar(64) NOT NULL,
  `defectId` int NULL,
  `modelVersionId` varchar(64) NULL,
  `predictedCause` varchar(128) NOT NULL,
  `confidence` float NOT NULL,
  `featureImportance` json,
  `contributingFactors` json,
  `recommendedAction` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `root_cause_predictions_id` PRIMARY KEY(`id`),
  CONSTRAINT `fk_rc_inspection` FOREIGN KEY (`inspectionId`) REFERENCES `inspections`(`inspectionId`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_root_cause_inspection` ON `root_cause_predictions` (`inspectionId`);
--> statement-breakpoint

-- 9. Predictive quality forecasts
CREATE TABLE IF NOT EXISTS `predictive_quality_forecasts` (
  `id` varchar(64) NOT NULL,
  `batchId` varchar(64) NOT NULL,
  `modelVersionId` varchar(64) NULL,
  `predictedDefectRate` float NOT NULL,
  `predictedYield` float NOT NULL,
  `riskLevel` varchar(32) NOT NULL DEFAULT 'low',
  `forecastHorizonHours` int NOT NULL DEFAULT 24,
  `confidenceIntervalLow` float NULL,
  `confidenceIntervalHigh` float NULL,
  `factors` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `predictive_quality_forecasts_id` PRIMARY KEY(`id`),
  CONSTRAINT `fk_forecast_batch` FOREIGN KEY (`batchId`) REFERENCES `manufacturing_batches`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_quality_forecast_batch` ON `predictive_quality_forecasts` (`batchId`);
--> statement-breakpoint

-- 10. Maintenance predictions
CREATE TABLE IF NOT EXISTS `maintenance_predictions` (
  `id` varchar(64) NOT NULL,
  `machineId` varchar(64) NOT NULL,
  `modelVersionId` varchar(64) NULL,
  `componentName` varchar(128) NOT NULL,
  `remainingUsefulLifeHours` float NOT NULL,
  `failureProbability` float NOT NULL,
  `urgency` varchar(32) NOT NULL DEFAULT 'routine',
  `recommendedServiceDate` timestamp NULL,
  `explanation` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `maintenance_predictions_id` PRIMARY KEY(`id`),
  CONSTRAINT `fk_maint_machine` FOREIGN KEY (`machineId`) REFERENCES `manufacturing_machines`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_maintenance_machine` ON `maintenance_predictions` (`machineId`, `urgency`);
--> statement-breakpoint

-- 11. Alert records
CREATE TABLE IF NOT EXISTS `alert_records` (
  `id` varchar(64) NOT NULL,
  `sourceType` varchar(64) NOT NULL,
  `sourceId` varchar(128) NOT NULL,
  `severity` varchar(32) NOT NULL DEFAULT 'info',
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `acknowledged` boolean NOT NULL DEFAULT false,
  `acknowledgedBy` varchar(64) NULL,
  `acknowledgedAt` timestamp NULL,
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `alert_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_alerts_severity_ack` ON `alert_records` (`acknowledged`, `severity`, `createdAt` DESC);
