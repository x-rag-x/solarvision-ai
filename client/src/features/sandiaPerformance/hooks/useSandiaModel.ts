/**
 * SolarVision AI — Model 3: Sandia Solar Electrical Performance Prediction
 * React Hook for Model Status, Dynamic Schema Discovery, and Target Ingestion
 */

import { useCallback, useEffect, useState } from "react";
import { sandiaApi } from "../adapter";
import type {
  FeatureSchemaManifest,
  SandiaMetadataResponse,
  SandiaModelStatusResponse,
  TargetDefinitionManifest,
} from "../types";

export interface UseSandiaModelReturn {
  status: SandiaModelStatusResponse | null;
  schema: FeatureSchemaManifest | null;
  schemaStatus: "loaded" | "pending_trainer" | "loading" | "error";
  targetDefinition: TargetDefinitionManifest | null;
  sampleInput: Record<string, any> | null;
  metadata: SandiaMetadataResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSandiaModel(): UseSandiaModelReturn {
  const [status, setStatus] = useState<SandiaModelStatusResponse | null>(null);
  const [schema, setSchema] = useState<FeatureSchemaManifest | null>(null);
  const [schemaStatus, setSchemaStatus] = useState<"loaded" | "pending_trainer" | "loading" | "error">("loading");
  const [targetDefinition, setTargetDefinition] = useState<TargetDefinitionManifest | null>(null);
  const [sampleInput, setSampleInput] = useState<Record<string, any> | null>(null);
  const [metadata, setMetadata] = useState<SandiaMetadataResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Model Status
      const statusRes = await sandiaApi.getStatus();
      setStatus(statusRes);

      // Extract schema if present in status response
      const schemaFromStatus =
        statusRes.feature_schema || statusRes.featureSchema;
      if (schemaFromStatus && schemaFromStatus.features?.length > 0) {
        setSchema(schemaFromStatus);
        setSchemaStatus("loaded");
      } else {
        // Query schema procedure
        const schemaRes = await sandiaApi.getSchema();
        const features = schemaRes?.features || [];
        if (
          (schemaRes?.status === "loaded" || features.length > 0) &&
          features.length > 0
        ) {
          setSchema({
            schema_version:
              schemaRes.schemaVersion || schemaRes.schema_version || "1.0.0",
            dataset_name: schemaRes.datasetName || schemaRes.dataset_name,
            features,
            metadata: schemaRes.metadata,
          });
          setSchemaStatus("loaded");
        } else {
          setSchema(null);
          setSchemaStatus("pending_trainer");
        }
      }

      // Extract target definition
      const targetFromStatus =
        statusRes.target_definition || statusRes.targetDefinition;
      if (targetFromStatus) {
        setTargetDefinition(targetFromStatus);
      } else {
        const targetRes = await sandiaApi.getTargetDefinition();
        const targetDef =
          targetRes?.targetDefinition || targetRes?.target_definition;
        if (targetDef) {
          setTargetDefinition(targetDef);
        } else {
          setTargetDefinition(null);
        }
      }

      // Extract sample input
      const sampleFromStatus =
        statusRes.sample_input || statusRes.sampleInput;
      if (sampleFromStatus) {
        setSampleInput(sampleFromStatus);
      } else {
        const sampleRes = await sandiaApi.getSampleInput();
        const sampleInputVal =
          sampleRes?.sampleInput || sampleRes?.sample_input;
        if (sampleInputVal) {
          setSampleInput(sampleInputVal);
        } else {
          setSampleInput(null);
        }
      }

      // Extract metadata
      const metaRes = await sandiaApi.getMetadata().catch(() => null);
      setMetadata(metaRes);
    } catch (err: any) {
      setError(err?.message || "Failed to load Sandia model status.");
      setSchemaStatus("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    status,
    schema,
    schemaStatus,
    targetDefinition,
    sampleInput,
    metadata,
    loading,
    error,
    refresh: fetchAll,
  };
}
