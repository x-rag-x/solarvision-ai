import React, { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useLocation } from "wouter";
import { useAppMode } from "@/contexts/ModeContext";
import {
  LayoutDashboard,
  ScanLine,
  Scan,
  Zap,
  Wrench,
  FileClock,
  BarChart3,
  BrainCircuit,
  HeartPulse,
  Settings2,
  Compass,
  Laptop,
  Flame,
  Search,
} from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [, setLocation] = useLocation();
  const { mode, setMode } = useAppMode();
  const [query, setQuery] = useState("");

  // Global ⌘K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const runCommand = (command: () => void) => {
    command();
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4 bg-sapphire-dark/50 backdrop-blur-xs">
      <div
        className="fixed inset-0"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <Command
          className="flex flex-col w-full h-full"
          value={query}
          onChange={e => setQuery((e.target as HTMLInputElement).value)}
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3 bg-surface">
            <Search className="h-4 w-4 text-sapphire shrink-0" />
            <Command.Input
              autoFocus
              placeholder="Type a command or search screens..."
              className="w-full bg-transparent text-sm text-text placeholder:text-text-3 outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-surface-subtle px-2 py-0.5 text-xs font-mono text-text-3 border border-border">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[340px] overflow-y-auto p-2">
            <Command.Empty className="p-6 text-center text-xs text-text-3">
              No results found for "{query}".
            </Command.Empty>

            <Command.Group heading="Navigation" className="px-2 py-1.5 text-xs font-semibold text-[#965660] uppercase tracking-wider">
              <Command.Item
                onSelect={() => runCommand(() => setLocation("/"))}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-text cursor-pointer hover:bg-[#F2DBD7] hover:text-[#2F3A58] aria-selected:bg-[#F2DBD7] aria-selected:text-[#2F3A58] transition-colors"
              >
                <LayoutDashboard className="h-4 w-4 text-text-3" />
                <span>Overview</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => setLocation("/inspection"))}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-text cursor-pointer hover:bg-[#F2DBD7] hover:text-[#2F3A58] aria-selected:bg-[#F2DBD7] aria-selected:text-[#2F3A58] transition-colors"
              >
                <ScanLine className="h-4 w-4 text-text-3" />
                <span>Defect Detection (Model 1)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => setLocation("/cell-screening"))}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-text cursor-pointer hover:bg-[#F2DBD7] hover:text-[#2F3A58] aria-selected:bg-[#F2DBD7] aria-selected:text-[#2F3A58] transition-colors"
              >
                <Scan className="h-4 w-4 text-text-3" />
                <span>Cell Screening (Model 2)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => setLocation("/predictive-quality"))}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-text cursor-pointer hover:bg-[#F2DBD7] hover:text-[#2F3A58] aria-selected:bg-[#F2DBD7] aria-selected:text-[#2F3A58] transition-colors"
              >
                <Zap className="h-4 w-4 text-text-3" />
                <span>Performance Forecast (Model 3)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => setLocation("/predictive-maintenance"))}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-text cursor-pointer hover:bg-[#F2DBD7] hover:text-[#2F3A58] aria-selected:bg-[#F2DBD7] aria-selected:text-[#2F3A58] transition-colors"
              >
                <Wrench className="h-4 w-4 text-text-3" />
                <span>Equipment Health (Model 4)</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => setLocation("/history"))}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-text cursor-pointer hover:bg-[#F2DBD7] hover:text-[#2F3A58] aria-selected:bg-[#F2DBD7] aria-selected:text-[#2F3A58] transition-colors"
              >
                <FileClock className="h-4 w-4 text-text-3" />
                <span>Inspection History</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => setLocation("/analytics"))}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-text cursor-pointer hover:bg-[#F2DBD7] hover:text-[#2F3A58] aria-selected:bg-[#F2DBD7] aria-selected:text-[#2F3A58] transition-colors"
              >
                <BarChart3 className="h-4 w-4 text-text-3" />
                <span>Defect Analytics</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Engineering & System" className="px-2 py-1.5 text-xs font-semibold text-[#965660] uppercase tracking-wider">
              <Command.Item
                onSelect={() => runCommand(() => setLocation("/model"))}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-text cursor-pointer hover:bg-[#F2DBD7] hover:text-[#2F3A58] aria-selected:bg-[#F2DBD7] aria-selected:text-[#2F3A58] transition-colors"
              >
                <BrainCircuit className="h-4 w-4 text-text-3" />
                <span>Model Registry & Performance</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => setLocation("/system-health"))}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-text cursor-pointer hover:bg-[#F2DBD7] hover:text-[#2F3A58] aria-selected:bg-[#F2DBD7] aria-selected:text-[#2F3A58] transition-colors"
              >
                <HeartPulse className="h-4 w-4 text-text-3" />
                <span>System Health & Diagnostics</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => setLocation("/settings"))}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-text cursor-pointer hover:bg-[#F2DBD7] hover:text-[#2F3A58] aria-selected:bg-[#F2DBD7] aria-selected:text-[#2F3A58] transition-colors"
              >
                <Settings2 className="h-4 w-4 text-text-3" />
                <span>System Settings</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="App Mode" className="px-2 py-1.5 text-xs font-semibold text-[#965660] uppercase tracking-wider">
              <Command.Item
                onSelect={() => runCommand(() => setMode("dev"))}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-text cursor-pointer hover:bg-[#F2DBD7] hover:text-[#2F3A58] aria-selected:bg-[#F2DBD7] aria-selected:text-[#2F3A58] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Laptop className="h-4 w-4 text-[#965660]" />
                  <span>Switch to Dev Mode (Explain & Experiment)</span>
                </div>
                {mode === "dev" && (
                  <span className="text-xs font-semibold text-white bg-[#2F3A58] px-2 py-0.5 rounded shadow-xs">
                    Active
                  </span>
                )}
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => setMode("prod"))}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-text cursor-pointer hover:bg-[#F2DBD7] hover:text-[#2F3A58] aria-selected:bg-[#F2DBD7] aria-selected:text-[#2F3A58] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Flame className="h-4 w-4 text-[#965660]" />
                  <span>Switch to Prod Mode (Operator Report)</span>
                </div>
                {mode === "prod" && (
                  <span className="text-xs font-semibold text-white bg-[#2F3A58] px-2 py-0.5 rounded shadow-xs">
                    Active
                  </span>
                )}
              </Command.Item>
            </Command.Group>
          </Command.List>

          <div className="border-t border-border px-4 py-2 bg-surface-subtle flex items-center justify-between text-xs text-text-3">
            <span>Press <kbd className="font-mono bg-surface border border-border px-1 rounded">↑</kbd> <kbd className="font-mono bg-surface border border-border px-1 rounded">↓</kbd> to navigate</span>
            <span><kbd className="font-mono bg-surface border border-border px-1 rounded">Alt+M</kbd> toggle mode</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
