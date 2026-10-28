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
      if (statusRes.feature_schema && statusRes.feature_schema.features?.length > 0) {
        setSchema(statusRes.feature_schema);
        setSchemaStatus("loaded");
      } else {
        // Query /schema endpoint
        const schemaRes = await sandiaApi.getSchema();
        if (schemaRes?.status === "loaded" && schemaRes.features?.length > 0) {
          setSchema({
            schema_version: schemaRes.schemaVersion || "1.0.0",
            dataset_name: schemaRes.datasetName,
            features: schemaRes.features,
            metadata: schemaRes.metadata,
          });
          setSchemaStatus("loaded");
        } else {
          setSchema(null);
          setSchemaStatus("pending_trainer");
        }
      }

      // Extract target definition
      if (statusRes.target_definition) {
        setTargetDefinition(statusRes.target_definition);
      } else {
        const targetRes = await sandiaApi.getTargetDefinition();
        if (targetRes?.status === "loaded" && targetRes.targetDefinition) {
          setTargetDefinition(targetRes.targetDefinition);
        } else {
          setTargetDefinition(null);
        }
      }

      // Extract sample input
      if (statusRes.sample_input) {
        setSampleInput(statusRes.sample_input);
      } else {
        const sampleRes = await sandiaApi.getSampleInput();
        if (sampleRes?.status === "loaded" && sampleRes.sampleInput) {
          setSampleInput(sampleRes.sampleInput);
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
