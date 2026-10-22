/**
 * SolarVision AI — Model 2: Manufacturing Data REST API Endpoints
 * 
 * Provides HTTP REST endpoints mounted at /api/v2/root-cause/...
 * Supporting client/src/features/rootCause/dataOnboardingApi.ts:
 * - POST /api/v2/root-cause/import/:entityType
 * - POST /api/v2/root-cause/links
 * - POST /api/v2/root-cause/annotations
 * - GET  /api/v2/root-cause/readiness
 */

import type { Express, Request, Response } from "express";
import { commitImportCsv, validateAndPreviewCsv, linkInspectionToBatch, ImportEntityType } from "./csvImport";
import { saveConfirmedRootCauseAnnotation, getRootCauseReadinessSummary } from "./dbContract";

export function registerRootCauseRestRoutes(app: Express): void {
  /**
   * POST /api/v2/root-cause/import/:entityType
   * Submits pre-validated or raw CSV items for transactional database ingestion.
   */
  app.post("/api/v2/root-cause/import/:entityType", async (req: Request, res: Response) => {
    try {
      const entityType = req.params.entityType as ImportEntityType;
      const validEntities: ImportEntityType[] = [
        "batches",
        "machines",
        "sensor_readings",
        "production_events",
        "root_cause_annotations",
        "inspection_batch_links",
      ];

      if (!validEntities.includes(entityType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid entityType '${entityType}'. Must be one of: ${validEntities.join(", ")}`,
        });
      }

      const items = req.body?.items;
      const csvContent = req.body?.csvContent;

      if (!items && !csvContent) {
        return res.status(400).json({
          success: false,
          importedCount: 0,
          rejectedCount: 0,
          message: "No data payload provided. Must supply 'items' array or 'csvContent' string.",
        });
      }

      const operator = (req as any).user?.openId || (req as any).user?.id || "api_operator";
      const payload = items || csvContent;

      const result = commitImportCsv(entityType, payload, {
        operatorName: String(operator),
        filename: req.body?.filename || `rest_upload_${entityType}.csv`,
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          importedCount: result.insertedRecords,
          rejectedCount: result.rejectedRecords,
          message: result.errors[0] || "Import validation or transaction failed.",
          details: result.errors,
          endpointStatus: "failed",
        });
      }

      return res.status(200).json({
        success: true,
        importedCount: result.insertedRecords,
        rejectedCount: result.rejectedRecords,
        message: `Successfully persisted ${result.insertedRecords} ${entityType} records.`,
        endpointStatus: "live_persisted",
        auditId: result.auditId,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        importedCount: 0,
        rejectedCount: 0,
        message: `Internal server error during import: ${err.message || String(err)}`,
        endpointStatus: "failed",
      });
    }
  });

  /**
   * POST /api/v2/root-cause/links
   * Links an inspection to manufacturing batch and equipment.
   */
  app.post("/api/v2/root-cause/links", async (req: Request, res: Response) => {
    try {
      const { inspectionId, batchId, machineId, waferPosition } = req.body;
      if (!inspectionId || !batchId || !machineId) {
        return res.status(400).json({
          success: false,
          message: "inspectionId, batchId, and machineId are required.",
          isPersisted: false,
        });
      }

      await linkInspectionToBatch({
        inspectionId,
        batchId,
        machineId,
        waferPosition,
      });

      return res.status(200).json({
        success: true,
        message: "Inspection linked to manufacturing batch successfully.",
        isPersisted: true,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to link inspection.",
        isPersisted: false,
      });
    }
  });

  /**
   * POST /api/v2/root-cause/annotations
   * Records expert-confirmed root cause ground truth.
   */
  app.post("/api/v2/root-cause/annotations", async (req: Request, res: Response) => {
    try {
      const { inspectionId, defectId, confirmedCause, confidenceLevel, investigationNotes, supportingEvidenceFactors } = req.body;
      if (!inspectionId || !confirmedCause) {
        return res.status(400).json({
          success: false,
          message: "inspectionId and confirmedCause are required.",
          isPersisted: false,
        });
      }

      const verifiedBy = (req as any).user?.openId || (req as any).user?.id || req.body.verifiedBy || "quality_engineer";
      const id = await saveConfirmedRootCauseAnnotation({
        inspectionId,
        defectId,
        confirmedCause,
        confidenceLevel: confidenceLevel || "confirmed",
        verifiedBy: String(verifiedBy),
        investigationNotes,
        supportingEvidenceFactors,
      });

      return res.status(200).json({
        success: true,
        annotationId: id,
        message: "Confirmed root cause recorded in quality engineering audit log.",
        isPersisted: true,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to record annotation.",
        isPersisted: false,
      });
    }
  });

  /**
   * GET /api/v2/root-cause/readiness
   * Returns live, non-hardcoded dataset readiness statistics directly from the database.
   */
  app.get("/api/v2/root-cause/readiness", async (_req: Request, res: Response) => {
    try {
      const stats = await getRootCauseReadinessSummary();
      return res.status(200).json(stats);
    } catch (err: any) {
      return res.status(500).json({
        error: `Failed to compute dataset readiness: ${err.message || String(err)}`,
      });
    }
  });
}
