import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type AppMode = "dev" | "prod";

interface ModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
  isDev: boolean;
  isProd: boolean;
}

const STORAGE_KEY = "solarvision-mode";

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => {
    // 1. Check URL query param (?mode=dev or ?mode=prod)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlMode = params.get("mode");
      if (urlMode === "dev" || urlMode === "prod") {
        return urlMode;
      }

      // 2. Check localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "dev" || stored === "prod") {
          return stored;
        }
      } catch {
        // Ignore storage errors
      }
    }

    // 3. Environment default
    const envMode = import.meta.env.VITE_APP_MODE;
    if (envMode === "development" || envMode === "dev") return "dev";
    if (envMode === "production" || envMode === "prod") return "prod";

    return import.meta.env.DEV ? "dev" : "prod";
  });

  const setMode = useCallback((newMode: AppMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
      window.dispatchEvent(new CustomEvent("solarvision:mode-changed", { detail: { mode: newMode } }));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "dev" ? "prod" : "dev");
  }, [mode, setMode]);

  // Keyboard shortcut Alt + M to toggle mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        toggleMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleMode]);

  return (
    <ModeContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        isDev: mode === "dev",
        isProd: mode === "prod",
      }}
    >
      {/* Dev Mode Visual Indicator Ribbon across the top */}
      {mode === "dev" && (
        <div
          className="fixed top-0 left-0 right-0 h-1 bg-amber-400 z-50 pointer-events-none transition-all"
          title="Dev Mode Active: Extended telemetry, inspector drawer, batch upload, benchmarks enabled"
        />
      )}
      {children}
    </ModeContext.Provider>
  );
}

const DEFAULT_MODE_CONTEXT: ModeContextType = {
  mode: "dev",
  isDev: true,
  isProd: false,
  setMode: () => {},
  toggleMode: () => {},
};

export function useAppMode(): ModeContextType {
  const context = useContext(ModeContext);
  return context ?? DEFAULT_MODE_CONTEXT;
}
