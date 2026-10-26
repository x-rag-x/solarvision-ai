import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useRef } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = trpc.auth.login.useMutation();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  // Track user identity changes across renders: only purge query cache when switching between different accounts
  const previousUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const currentId = meQuery.data?.openId ?? (meQuery.data as any)?.id ?? null;
    if (
      previousUserIdRef.current &&
      currentId &&
      previousUserIdRef.current !== currentId
    ) {
      // Switched from one authenticated user to a different authenticated user
      queryClient.clear();
    }
    if (currentId) {
      previousUserIdRef.current = currentId;
    } else if (meQuery.data === null) {
      previousUserIdRef.current = null;
    }
  }, [meQuery.data, queryClient]);

  // In local development / factory operator environment, auto-authenticate as default station lead if unauthenticated
  const autoLoginAttemptedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (meQuery.isLoading || logoutMutation.isPending || loginMutation.isPending) return;

    if (!meQuery.data && !autoLoginAttemptedRef.current) {
      const explicitLogout = sessionStorage.getItem("solarvision:explicit-logout");
      if (explicitLogout) return;

      autoLoginAttemptedRef.current = true;
      loginMutation
        .mutateAsync({
          operatorId: "OP-7701",
          name: "Alex Rivera",
          role: "user",
        })
        .then(response => {
          if (response?.success && response.token) {
            try {
              sessionStorage.setItem("manus-cookie", `${response.cookieName}=${response.token}; path=/;`);
              localStorage.setItem("solarvision-session-token", response.token);
              localStorage.setItem("manus-cookie", `${response.cookieName}=${response.token}; path=/;`);
              localStorage.setItem("manus-runtime-user-info", JSON.stringify(response.user));
            } catch {}
            utils.auth.me.setData(undefined, response.user as any);
            utils.auth.me.invalidate();
            utils.dashboard.stats.invalidate();
          }
        })
        .catch(err => {
          console.warn("[Auth] Default operator auto-login skipped:", err);
        });
    }
  }, [meQuery.data, meQuery.isLoading, logoutMutation.isPending, loginMutation, utils]);

  const logout = useCallback(async () => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("solarvision:explicit-logout", "true");
      }
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      // Clear mirrored session tokens from sessionStorage and localStorage
      try {
        sessionStorage.removeItem("manus-cookie");
        localStorage.removeItem("solarvision-session-token");
        localStorage.removeItem("manus-cookie");
        localStorage.removeItem("manus-runtime-user-info");
      } catch {}

      // Completely wipe the react-query cache so no inspection records, history,
      // or analytics from this user can linger in memory.
      queryClient.clear();

      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, queryClient, utils]);

  const state = useMemo(() => {
    if (typeof localStorage !== "undefined" && meQuery.data) {
      try {
        localStorage.setItem(
          "manus-runtime-user-info",
          JSON.stringify(meQuery.data)
        );
      } catch {}
    }
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;

    if (redirectPath) {
      window.location.href = redirectPath;
    } else {
      startLogin();
    }
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
