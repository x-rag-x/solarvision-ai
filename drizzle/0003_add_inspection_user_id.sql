-- Drizzle Phase 2 Security Migration: Inspection User Ownership (SEC-02)
-- Idempotent and non-destructive for MySQL / MariaDB

ALTER TABLE `inspections` ADD COLUMN IF NOT EXISTS `userId` varchar(64) NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_inspections_user_id` ON `inspections` (`userId`);
