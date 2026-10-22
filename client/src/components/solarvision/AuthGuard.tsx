import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, LogIn, ShieldAlert, ArrowLeft, RefreshCw } from "lucide-react";
import { Link } from "wouter";

interface AuthGuardProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function AuthGuard({
  children,
  title = "Authentication required for inspection operations",
  description = "Access to the YOLO26n computer vision pipeline, annotated cell evidence, defect history, and manufacturing analytics is strictly restricted to authenticated operators and quality engineers.",
}: AuthGuardProps) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="space-y-6 py-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Skeleton className="h-[380px] rounded-2xl" />
          <Skeleton className="h-[380px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="py-10">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200/80 bg-white p-8 shadow-[0_20px_50px_rgba(7,27,41,0.06)] text-center sm:p-12">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#0B0909] text-[#F2B941] shadow-[0_8px_24px_rgba(11,9,9,0.18)]">
            <Lock className="h-7 w-7" />
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[#F2B941]">
            Restricted Quality Zone
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-xs leading-relaxed text-slate-500 sm:text-sm">
            {description}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              onClick={() => startLogin()}
              className="h-11 w-full gap-2 rounded-xl bg-[#0B0909] px-6 text-xs font-semibold text-white shadow-md hover:bg-slate-800 sm:w-auto"
            >
              <LogIn className="h-4 w-4 text-[#F2B941]" />
              Sign in with Operator ID
            </Button>
            <Link
              href="/"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to overview
            </Link>
          </div>

          <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-left">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="text-xs text-amber-900">
                <span className="font-semibold">Security Policy Note:</span> Unauthenticated sessions cannot execute AI inference, access stored defect coordinates, or inspect production telemetry.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function SessionExpiredBanner({
  onRetry,
}: {
  onRetry?: () => void;
}) {
  return (
    <div className="my-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-rose-900">Session Expired or Unauthorized</h4>
            <p className="mt-1 text-xs text-rose-700">
              Your authentication session is no longer active. You must re-authenticate to view or update inspection data.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:shrink-0">
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="h-9 gap-1.5 border-rose-200 bg-white text-xs font-medium text-rose-900 hover:bg-rose-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => startLogin()}
            className="h-9 gap-1.5 rounded-xl bg-[#0B0909] px-4 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <LogIn className="h-3.5 w-3.5 text-[#F2B941]" />
            Sign in again
          </Button>
        </div>
      </div>
    </div>
  );
}
