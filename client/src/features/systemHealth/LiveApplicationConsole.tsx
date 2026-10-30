import React, { useState, useEffect, useRef } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Filter,
  Info,
  Pause,
  Play,
  RotateCcw,
  Search,
  Terminal,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { LogEntry, LogLevel, LogService } from "./types";

interface LiveApplicationConsoleProps {
  logs: LogEntry[];
  totalBuffered: number;
  isLoading: boolean;
  onRefreshLogs: () => void;
  onClearServerLogs?: () => void;
  isAdmin?: boolean;
}

const LOG_SERVICES: LogService[] = [
  "SYSTEM",
  "DATABASE",
  "FASTAPI",
  "MODEL 1",
  "MODEL 2",
  "MODEL 3",
  "MODEL 4",
  "API",
  "AUTH",
];

const LOG_LEVELS: LogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR"];

export function LiveApplicationConsole({
  logs,
  totalBuffered,
  isLoading,
  onRefreshLogs,
  onClearServerLogs,
  isAdmin = false,
}: LiveApplicationConsoleProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | "ALL">("ALL");
  const [selectedService, setSelectedService] = useState<LogService | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [limit, setLimit] = useState<number>(200);
  const [copied, setCopied] = useState(false);
  const [localCleared, setLocalCleared] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filter logs locally according to current view controls
  const filteredLogs = logs
    .filter((log) => {
      if (selectedLevel !== "ALL" && log.level !== selectedLevel) return false;
      if (selectedService !== "ALL" && log.service !== selectedService) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesMsg = log.message.toLowerCase().includes(q);
        const matchesService = log.service.toLowerCase().includes(q);
        const matchesLevel = log.level.toLowerCase().includes(q);
        if (!matchesMsg && !matchesService && !matchesLevel) return false;
      }
      return true;
    })
    .slice(-limit);

  // Auto-scroll to bottom unless paused
  useEffect(() => {
    if (!isPaused && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [logs, isPaused]);

  // Copy visible logs
  const handleCopyLogs = () => {
    const formatted = filteredLogs
      .map((l) => `[${l.formattedTime}] [${l.level}] [${l.service}] ${l.message}`)
      .join("\n");
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    toast.success("Logs copied to clipboard", {
      description: `${filteredLogs.length} events copied`,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearView = () => {
    setLocalCleared(true);
    toast.info("Console view cleared locally");
  };

  const handleRestoreView = () => {
    setLocalCleared(false);
  };

  const displayedLogs = localCleared ? [] : filteredLogs;

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case "ERROR":
        return "text-red-400 font-bold";
      case "WARN":
        return "text-amber-400 font-semibold";
      case "INFO":
        return "text-emerald-400 font-semibold";
      case "DEBUG":
        return "text-slate-400";
      default:
        return "text-slate-300";
    }
  };

  const getServiceColor = (service: LogService) => {
    switch (service) {
      case "MODEL 1":
        return "text-sky-400";
      case "MODEL 2":
        return "text-teal-400";
      case "MODEL 3":
        return "text-emerald-300";
      case "MODEL 4":
        return "text-orange-400";
      case "DATABASE":
        return "text-yellow-400";
      case "FASTAPI":
        return "text-indigo-400";
      case "AUTH":
        return "text-purple-400";
      default:
        return "text-slate-300";
    }
  };

  return (
    <Card className="border border-slate-800 bg-[#0B0909] text-slate-100 shadow-md overflow-hidden rounded-2xl">
      {/* Console Top Toolbar */}
      <div className="border-b border-slate-800 bg-[#121010] px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-slate-900 border border-slate-700 text-[#F2B941] flex items-center justify-center">
            <Terminal className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-white">
                Live Application Diagnostic Console
              </h2>
              <span
                className={cn(
                  "flex h-2 w-2 rounded-full",
                  isPaused
                    ? "bg-amber-400"
                    : "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                )}
                title={isPaused ? "Console streaming paused" : "Console streaming active"}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Showing {displayedLogs.length} events • Ring Buffer: {totalBuffered} / 500 buffered
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPaused(!isPaused)}
            className={cn(
              "h-8 px-2.5 text-xs font-semibold rounded-lg border-slate-700 gap-1.5",
              isPaused
                ? "bg-amber-950/40 text-amber-300 border-amber-600/50 hover:bg-amber-900/50"
                : "bg-slate-900 text-slate-200 hover:bg-slate-800"
            )}
          >
            {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {isPaused ? "Resume" : "Pause"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyLogs}
            disabled={displayedLogs.length === 0}
            className="h-8 px-2.5 text-xs font-semibold rounded-lg border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 gap-1.5"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy Logs"}
          </Button>

          {localCleared ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRestoreView}
              className="h-8 px-2.5 text-xs font-semibold rounded-lg border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 gap-1.5"
            >
              <RotateCcw className="h-3 w-3" />
              Restore View
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearView}
              disabled={displayedLogs.length === 0}
              className="h-8 px-2.5 text-xs font-semibold rounded-lg border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 gap-1.5"
            >
              <Trash2 className="h-3 w-3" />
              Clear View
            </Button>
          )}

          {isAdmin && onClearServerLogs && (
            <Button
              size="sm"
              variant="outline"
              onClick={onClearServerLogs}
              className="h-8 px-2.5 text-xs font-semibold rounded-lg border-red-900/40 bg-red-950/20 text-red-300 hover:bg-red-900/30 gap-1.5"
              title="Clear in-memory log buffer on the server"
            >
              <Trash2 className="h-3 w-3 text-red-400" />
              Flush Server Buffer
            </Button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="border-b border-slate-800/80 bg-[#171414] px-5 py-2.5 flex flex-wrap items-center gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            className="h-8 pl-8 pr-2.5 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 text-xs rounded-lg focus-visible:ring-1 focus-visible:ring-[#F2B941]"
          />
        </div>

        {/* Level Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-[11px] font-medium">Level:</span>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value as any)}
            className="h-8 px-2.5 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F2B941]"
          >
            <option value="ALL">ALL LEVELS</option>
            {LOG_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>
        </div>

        {/* Service Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-[11px] font-medium">Service:</span>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value as any)}
            className="h-8 px-2.5 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F2B941]"
          >
            <option value="ALL">ALL SERVICES</option>
            {LOG_SERVICES.map((srv) => (
              <option key={srv} value={srv}>
                {srv}
              </option>
            ))}
          </select>
        </div>

        {/* Record Limit */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-[11px] font-medium">Display:</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="h-8 px-2.5 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F2B941]"
          >
            <option value={50}>50 lines</option>
            <option value={100}>100 lines</option>
            <option value={200}>200 lines</option>
            <option value={500}>500 lines (All)</option>
          </select>
        </div>
      </div>

      {/* Terminal Output Area */}
      <div
        ref={scrollContainerRef}
        className="h-80 md:h-96 overflow-y-auto p-4 font-mono text-[11.5px] leading-relaxed bg-[#0B0909] text-slate-200 select-text space-y-1"
        style={{ scrollBehavior: isPaused ? "auto" : "smooth" }}
      >
        {displayedLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
            <Terminal className="h-8 w-8 text-slate-600 mb-2" />
            <p className="font-semibold text-xs text-slate-400">No diagnostic events to display</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {localCleared ? "View was cleared locally" : "Adjust filters or perform operations to generate logs"}
            </p>
          </div>
        ) : (
          displayedLogs.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2 py-0.5 hover:bg-white/[0.03] px-1 rounded transition-colors"
            >
              <span className="text-slate-500 shrink-0 select-none">
                [{entry.formattedTime}]
              </span>
              <span className={cn("shrink-0 select-none", getLevelColor(entry.level))}>
                [{entry.level}]
              </span>
              <span className={cn("shrink-0 select-none font-semibold", getServiceColor(entry.service))}>
                [{entry.service}]
              </span>
              <span className="text-slate-200 break-words flex-1">
                {entry.message}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Console Disclaimer Footer */}
      <div className="border-t border-slate-800/80 bg-[#121010] px-5 py-2.5 text-[11px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <span>
            Read-only in-memory log buffer (500 records). Sensitive credentials, passwords, session tokens, and image binaries are automatically sanitized.
          </span>
        </div>
        <div className="text-slate-500 shrink-0">
          Logs are volatile across server restarts.
        </div>
      </div>
    </Card>
  );
}

