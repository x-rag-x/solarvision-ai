import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";

const COLLAPSED_STORAGE_KEY = "solarvision-sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const setCollapsed = (val: boolean | ((c: boolean) => boolean)) => {
    setCollapsedState(prev => {
      const next = typeof val === "function" ? val(prev) : val;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-canvas text-text">
      {/* Grouped Sidebar */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <div
        className={`min-h-screen flex flex-col transition-[padding] duration-200 ${
          collapsed ? "lg:pl-[72px]" : "lg:pl-[248px]"
        }`}
      >
        <Topbar
          onOpenMobileNav={() => setMobileOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />

        <main className="flex-1 w-full max-w-[1280px] mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-150">
          {children}
        </main>
      </div>

      {/* ⌘K Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
    </div>
  );
}

export default AppShell;
