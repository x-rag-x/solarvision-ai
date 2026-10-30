import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, Home, History as HistoryIcon } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Sanitizes stack traces and error messages by stripping local filesystem paths
 * and sensitive tokens before displaying in the UI.
 */
function sanitizeErrorMessage(msg?: string | null): string {
  if (!msg) return "An unexpected client runtime error occurred.";
  return msg
    .replace(/[a-zA-Z]:\\[^\s:()]+/g, "[local-path]") // Windows absolute paths
    .replace(/\/[^\s:()]+\/solarvision[^\s:()]*/g, "[repo-path]") // Unix absolute paths
    .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer [redacted]")
    .replace(/(api[_-]?key|secret|token)=["']?[^"'\s&]+["']?/gi, "$1=[redacted]");
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      const isDev = Boolean(import.meta.env?.DEV);
      const sanitizedMessage = sanitizeErrorMessage(this.state.error?.message);
      const sanitizedStack = sanitizeErrorMessage(this.state.error?.stack);

      return (
        <div className="flex items-center justify-center min-h-screen p-6 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-6 sm:p-8 rounded-2xl border border-border bg-surface shadow-lg text-center space-y-5">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-danger-tint text-danger border border-danger/30">
              <AlertTriangle size={28} />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-text">
                An unexpected error occurred
              </h2>
              <p className="text-xs text-text-3 max-w-md mx-auto">
                {sanitizedMessage}
              </p>
            </div>

            {isDev && sanitizedStack && (
              <div className="p-3 w-full rounded-xl bg-surface-subtle border border-border overflow-auto max-h-48 text-left">
                <p className="text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-1">
                  Developer Stack Trace (Sanitized)
                </p>
                <pre className="text-xs font-mono text-text-2 whitespace-break-spaces leading-relaxed">
                  {sanitizedStack}
                </pre>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold",
                  "bg-[#965660] text-white hover:bg-[#7E454E] transition-colors shadow-xs cursor-pointer"
                )}
              >
                <RotateCcw size={14} />
                <span>Reload Page</span>
              </button>
              <a
                href="/history"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border border-border bg-surface text-text hover:bg-surface-subtle transition-colors shadow-xs"
              >
                <HistoryIcon size={14} />
                <span>Inspection Records</span>
              </a>
              <a
                href="/"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border border-border bg-surface text-text-2 hover:bg-surface-subtle hover:text-text transition-colors shadow-xs"
              >
                <Home size={14} />
                <span>Dashboard</span>
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
