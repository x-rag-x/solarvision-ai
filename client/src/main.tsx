import { trpc, getAuthHeaders } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { isUnauthorizedError } from "./lib/auth-helpers";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry(failureCount, error) {
        // Never retry if unauthorized or session expired
        if (isUnauthorizedError(error)) return false;
        return failureCount < 2;
      },
    },
  },
});

let isHandlingUnauthorized = false;
let lastUnauthorizedTime = 0;

const handleUnauthorizedResponse = (error: unknown) => {
  if (typeof window === "undefined") return;
  if (!isUnauthorizedError(error)) return;

  const now = Date.now();
  if (isHandlingUnauthorized || now - lastUnauthorizedTime < 3000) return;
  isHandlingUnauthorized = true;
  lastUnauthorizedTime = now;

  console.warn("[Auth] Protected procedure returned unauthorized. Operator sign-in available.");

  setTimeout(() => {
    isHandlingUnauthorized = false;
  }, 1000);
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    handleUnauthorizedResponse(error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    handleUnauthorizedResponse(error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        return getAuthHeaders();
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
