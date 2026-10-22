/**
 * SolarVision AI — Model 2: Manufacturing Data REST API Endpoints
 * 
 * Provides HTTP REST endpoints mounted at /api/v2/root-cause/...
 * Supporting client/src/features/rootCause/dataOnboardingApi.ts:
 * - POST /api/v2/root-cause/import/:entityType
 * - POST /api/v2/root-cause/links
 * - POST /api/v2/root-cause/annotations
 * - GET  /api/v2/root-cause/readiness
 * 
 * Remediated under Audit Finding F02 & F04:
 * - Server-side session authentication enforcement
 * - Reviewer identity spoofing prevention (derived from ctx.user, body ignored/rejected)
 * - Strict inspection existence and ownership verification
 * - Taxonomy and evidence validation
 */

import type { Express, Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { getInspectionById } from "../db";
import {
  commitImportCsv,
  linkInspectionToBatch,
  ImportEntityType,
  VALID_ROOT_CAUSES,
} from "./csvImport";
import {
  saveConfirmedRootCauseAnnotation,
  getRootCauseReadinessSummary,
} from "./dbContract";

/**
 * Authenticates the incoming HTTP request using the application's session/token SDK
 * or pre-populated request user context.
 */
async function authenticateRestRequest(req: Request): Promise<any | null> {
  if ((req as any).user && ((req as any).user.openId || (req as any).user.id)) {
    return (req as any).user;
  }
  try {
    const user = await sdk.authenticateRequest(req);
    return user || null;
  } catch {
    return null;
  }
}

export function registerRootCauseRestRoutes(app: Express): void {
  /**
   * POST /api/v2/root-cause/import/:entityType
   * Submits pre-validated or raw CSV items for transactional database ingestion.
   * Requires authenticated server-side identity.
   */
  app.post("/api/v2/root-cause/import/:entityType", async (req: Request, res: Response) => {
    try {
      const user = await authenticateRestRequest(req);
      if (!user) {
        return res.status(401).json({
          success: false,
          importedCount: 0,
          rejectedCount: 0,
          message: "Unauthorized: Active authenticated session required for manufacturing imports.",
          endpointStatus: "unauthorized",
        });
      }

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
          importedCount: 0,
          rejectedCount: 0,
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

      const operator = user.openId || user.name || String(user.id);
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
   * Requires authenticated session, inspection ownership, and valid foreign keys.
   */
  app.post("/api/v2/root-cause/links", async (req: Request, res: Response) => {
    try {
      const user = await authenticateRestRequest(req);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: Active authenticated session required to link inspection.",
          isPersisted: false,
        });
      }

      const { inspectionId, batchId, machineId, waferPosition } = req.body || {};
      if (!inspectionId || !batchId || !machineId) {
        return res.status(400).json({
          success: false,
          message: "inspectionId, batchId, and machineId are required.",
          isPersisted: false,
        });
      }

      // Enforce inspection existence and requester ownership
      const requester = {
        userId: user.openId || String(user.id),
        role: user.role,
      };

      const existing = await getInspectionById(inspectionId, requester);
      if (!existing) {
        const existsGlobally = await getInspectionById(inspectionId, { role: "admin" });
        if (existsGlobally) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: Access denied to inspection record.",
            isPersisted: false,
          });
        }
        return res.status(404).json({
          success: false,
          message: `Referenced inspection '${inspectionId}' does not exist.`,
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
      const msg = err.message || "Failed to link inspection.";
      const status = msg.includes("does not exist") ? 404 : 400;
      return res.status(status).json({
        success: false,
        message: msg,
        isPersisted: false,
      });
    }
  });

  /**
   * POST /api/v2/root-cause/annotations
   * Records expert-confirmed root cause ground truth.
   * Enforces:
   * - Authentication
   * - Reviewer identity derived strictly from server session (spoofing rejected)
   * - Referenced inspection existence in database
   * - Requester inspection ownership or authorized role
   * - Allowed 9-class root-cause taxonomy
   * - Valid evidence schema
   */
  app.post("/api/v2/root-cause/annotations", async (req: Request, res: Response) => {
    try {
      const user = await authenticateRestRequest(req);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: Active authenticated session required to record annotations.",
          isPersisted: false,
        });
      }

      const {
        inspectionId,
        defectId,
        confirmedCause,
        confidenceLevel,
        investigationNotes,
        supportingEvidenceFactors,
        verifiedBy: bodyVerifiedBy,
        reviewerId: bodyReviewerId,
      } = req.body || {};

      if (!inspectionId || !confirmedCause) {
        return res.status(400).json({
          success: false,
          message: "inspectionId and confirmedCause are required.",
          isPersisted: false,
        });
      }

      // Reviewer Identity Spoofing Protection
      const authUserId = user.openId || String(user.id);
      const suppliedReviewer = bodyVerifiedBy || bodyReviewerId;
      if (suppliedReviewer && suppliedReviewer !== authUserId && user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: `Reviewer identity spoofing detected: supplied reviewer '${suppliedReviewer}' does not match authenticated user '${authUserId}'.`,
          isPersisted: false,
        });
      }

      // Root-cause taxonomy validation
      if (!VALID_ROOT_CAUSES.has(confirmedCause)) {
        return res.status(422).json({
          success: false,
          message: `Invalid confirmedCause '${confirmedCause}'. Must be a recognized root cause in the taxonomy.`,
          isPersisted: false,
        });
      }

      // Confidence level validation
      const validConfidences = ["confirmed", "probable", "investigative"];
      const confLevel = confidenceLevel ? String(confidenceLevel).toLowerCase() : "confirmed";
      if (!validConfidences.includes(confLevel)) {
        return res.status(422).json({
          success: false,
          message: `Invalid confidenceLevel '${confidenceLevel}'. Must be one of: ${validConfidences.join(", ")}`,
          isPersisted: false,
        });
      }

      // Supporting evidence validation
      if (supportingEvidenceFactors !== undefined && supportingEvidenceFactors !== null) {
        if (!Array.isArray(supportingEvidenceFactors) || supportingEvidenceFactors.some(f => typeof f !== "string")) {
          return res.status(422).json({
            success: false,
            message: "supportingEvidenceFactors must be an array of strings.",
            isPersisted: false,
          });
        }
      }

      // Inspection existence and requester ownership validation
      const requester = {
        userId: authUserId,
        role: user.role,
      };

      const existing = await getInspectionById(inspectionId, requester);
      if (!existing) {
        const existsGlobally = await getInspectionById(inspectionId, { role: "admin" });
        if (existsGlobally) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: Access denied to inspection record.",
            isPersisted: false,
          });
        }
        return res.status(404).json({
          success: false,
          message: `Referenced inspection '${inspectionId}' does not exist.`,
          isPersisted: false,
        });
      }

      // Persist annotation strictly with authenticated reviewer ID
      const id = await saveConfirmedRootCauseAnnotation({
        inspectionId,
        defectId,
        confirmedCause,
        confidenceLevel: confLevel as any,
        verifiedBy: authUserId,
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
   * Requires authenticated session.
   */
  app.get("/api/v2/root-cause/readiness", async (req: Request, res: Response) => {
    try {
      const user = await authenticateRestRequest(req);
      if (!user) {
        return res.status(401).json({
          error: "Unauthorized: Active authenticated session required.",
        });
      }

      const stats = await getRootCauseReadinessSummary();
      return res.status(200).json(stats);
    } catch (err: any) {
      return res.status(500).json({
        error: `Failed to compute dataset readiness: ${err.message || String(err)}`,
      });
    }
  });
}
