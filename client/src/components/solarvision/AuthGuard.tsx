import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { openOperatorLoginModal } from "@/const";
import { ArrowLeft, Lock, LogIn, ShieldAlert } from "lucide-react";
import React from "react";
import { Link } from "wouter";

interface AuthGuardProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function AuthGuard({
  children,
  title = "Authentication required",
  description = "This inspection workstation is governed by quality audit compliance. Please sign in with your verified operator credentials to execute inference.",
}: AuthGuardProps) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-4 w-96 rounded-lg" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[380px] rounded-2xl" />
          <Skeleton className="h-[380px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="py-10">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-8 shadow-sm text-center sm:p-12">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-canvas border border-border text-text">
            <Lock className="h-6 w-6" />
          </div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Restricted Quality Zone
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-text">
            {title}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-xs leading-relaxed text-text-muted sm:text-sm">
            {description}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              onClick={() => openOperatorLoginModal()}
              className="h-10 w-full gap-2 rounded-lg bg-primary px-6 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95 sm:w-auto"
            >
              <LogIn className="h-4 w-4" />
              Sign in with Operator ID
            </Button>
            <Link
              href="/"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-5 text-xs font-semibold text-text transition-colors hover:bg-canvas sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to overview
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function InlineAuthPrompt({
  actionName = "this operation",
  compact = false,
}: {
  actionName?: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  if (user) return null;

  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-warning-border bg-warning-soft px-3.5 py-2 text-xs text-text">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5 text-warning shrink-0" />
          <span>Operator sign-in required to execute {actionName}.</span>
        </div>
        <button
          onClick={() => openOperatorLoginModal()}
          className="font-semibold text-primary hover:underline ml-2 shrink-0 text-xs"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-warning-border bg-warning-soft p-4 text-xs text-text">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-text">Session Not Authenticated</p>
            <p className="text-text-muted mt-0.5">
              You are viewing in read-only preview mode. Sign in to record {actionName} into database lineage.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => openOperatorLoginModal()}
          className="h-8 gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-95 shrink-0"
        >
          <LogIn className="h-3.5 w-3.5" />
          Sign in
        </Button>
      </div>
    </div>
  );
}

export default AuthGuard;
