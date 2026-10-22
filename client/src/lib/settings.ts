import { useEffect, useState } from "react";
import { BACKEND_TRANSPORT_MAX_MB } from "./auth-helpers";

export interface InspectionSettings {
  confidenceThreshold: number;
  sensitivityMode: "standard" | "high_sensitivity" | "custom";
  imageSize: number;
  maxUploadMb: number;
  autoPersistSupabase: boolean;
  highlightBoundaryDefects: boolean;
}

export const DEFAULT_SETTINGS: InspectionSettings = {
  confidenceThreshold: 0.25, // Default 0.25 as mandated by engineering standards
  sensitivityMode: "standard",
  imageSize: 640,
  maxUploadMb: 35, // Reconciled with backend transport limits (35MB binary payload <= 50MB express ceiling)
  autoPersistSupabase: true,
  highlightBoundaryDefects: true,
};

const STORAGE_KEY = "solarvision-settings";
const EVENT_NAME = "solarvision:settings-changed";

export function loadInspectionSettings(): InspectionSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      // Clamp confidence safely
      confidenceThreshold:
        typeof parsed.confidenceThreshold === "number" && !isNaN(parsed.confidenceThreshold)
          ? Math.max(0.01, Math.min(0.99, parsed.confidenceThreshold))
          : DEFAULT_SETTINGS.confidenceThreshold,
      // Reconcile and clamp upload limit with agreed backend transport limit (35 MB)
      maxUploadMb:
        typeof parsed.maxUploadMb === "number" && !isNaN(parsed.maxUploadMb)
          ? Math.min(Math.max(1, parsed.maxUploadMb), BACKEND_TRANSPORT_MAX_MB)
          : DEFAULT_SETTINGS.maxUploadMb,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveInspectionSettings(settings: Partial<InspectionSettings>): InspectionSettings {
  const current = loadInspectionSettings();
  const updated: InspectionSettings = {
    ...current,
    ...settings,
    maxUploadMb: settings.maxUploadMb
      ? Math.min(Math.max(1, settings.maxUploadMb), BACKEND_TRANSPORT_MAX_MB)
      : current.maxUploadMb,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: updated }));
  } catch (err) {
    console.error("Failed to save settings to localStorage:", err);
  }
  return updated;
}

export function useInspectionSettings(): [InspectionSettings, (next: Partial<InspectionSettings>) => void] {
  const [settings, setSettings] = useState<InspectionSettings>(loadInspectionSettings);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<InspectionSettings>).detail;
      if (detail) {
        setSettings(detail);
      }
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const update = (next: Partial<InspectionSettings>) => {
    const saved = saveInspectionSettings(next);
    setSettings(saved);
  };

  return [settings, update];
}
