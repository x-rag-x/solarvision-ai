import React from "react";
import { openOperatorLoginModal } from "@/const";
import { ShieldCheck, LogIn, Lock } from "lucide-react";

interface AuthPromptProps {
  variant?: "inline" | "banner" | "card";
  title?: string;
  description?: string;
  actionText?: string;
  className?: string;
}

export function AuthPrompt({
  variant = "card",
  title = "Authentication Required",
  description = "You must be signed in with an authorized operator credentials to execute inference pipelines and commit inspection records to factory persistence.",
  actionText = "Sign In as Operator",
  className = "",
}: AuthPromptProps) {
  if (variant === "banner") {
    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning-tint/50 px-4 py-3 text-xs ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <Lock className="h-4 w-4 text-warning shrink-0" />
          <span className="font-medium text-text">{description}</span>
        </div>
        <button
          onClick={() => openOperatorLoginModal()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink/90 transition-colors shrink-0 shadow-xs"
        >
          <LogIn className="h-3.5 w-3.5 text-brand" />
          <span>{actionText}</span>
        </button>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className={`text-xs text-text-3 flex items-center gap-2 ${className}`}>
        <span>Sign in required to view live data.</span>
        <button
          onClick={() => openOperatorLoginModal()}
          className="font-semibold text-brand-text hover:underline inline-flex items-center gap-1"
        >
          <LogIn className="h-3 w-3" />
          <span>Sign In</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-6 sm:p-8 text-center space-y-4 shadow-xs ${className}`}
    >
      <div className="grid h-12 w-12 mx-auto place-items-center rounded-2xl bg-surface-subtle text-text border border-border">
        <ShieldCheck className="h-6 w-6 text-brand-text" />
      </div>

      <div className="max-w-md mx-auto space-y-1.5">
        <h3 className="text-base font-semibold text-text">{title}</h3>
        <p className="text-xs text-text-3 leading-relaxed">{description}</p>
      </div>

      <div className="pt-2">
        <button
          onClick={() => openOperatorLoginModal()}
          className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-xs font-semibold text-white hover:bg-ink/90 transition-all shadow-sm active:scale-95"
        >
          <LogIn className="h-4 w-4 text-brand" />
          <span>{actionText}</span>
        </button>
      </div>
    </div>
  );
}

export default AuthPrompt;
