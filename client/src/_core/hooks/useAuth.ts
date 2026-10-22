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

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  // Track user identity changes across renders to purge query cache when switching accounts or logging out
  const previousUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const currentId = meQuery.data?.openId ?? (meQuery.data as any)?.id ?? null;
    if (previousUserIdRef.current !== undefined && previousUserIdRef.current !== currentId) {
      // User identity has changed (switched user or logged out).
      // Purge all query caches immediately to guarantee zero cross-user inspection data leakage.
      queryClient.clear();
    }
    previousUserIdRef.current = currentId;
  }, [meQuery.data, queryClient]);

  const logout = useCallback(async () => {
    try {
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
    if (typeof localStorage !== "undefined") {
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
