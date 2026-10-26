import { createTRPCReact } from "@trpc/react-query";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { COOKIE_NAME } from "@shared/const";
import type { AppRouter } from "../../../server/routers";

export function getBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return "";
  }
  return "http://localhost:5000";
}

export function getAuthHeaders(): Record<string, string> {
  try {
    const sessionStorageRef = typeof window !== "undefined" ? window.sessionStorage : (globalThis as any).sessionStorage;
    const localStorageRef = typeof window !== "undefined" ? window.localStorage : (globalThis as any).localStorage;

    const directToken = localStorageRef?.getItem?.("solarvision-session-token");
    if (directToken) {
      return { Authorization: `Bearer ${directToken}` };
    }

    const raw = sessionStorageRef?.getItem?.("manus-cookie") || localStorageRef?.getItem?.("manus-cookie");
    if (raw) {
      const prefix = `${COOKIE_NAME}=`;
      const pair = raw.split(";").find((s: string) => s.trim().startsWith(prefix));
      const token = pair?.trim().slice(prefix.length);
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    }
  } catch {
    // storage unavailable
  }
  return {};
}

export function createTrpcClientLinks() {
  return [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      headers() {
        return getAuthHeaders();
      },
      async fetch(input, init) {
        const res = await globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });

        if (!res.ok) {
          let errBody: any;
          try {
            if (typeof (res as any).clone === "function") {
              errBody = await (res as any).clone().json();
            } else if (typeof res.json === "function") {
              errBody = await res.json();
            }
          } catch {
            // Not JSON
          }

          const errMsg =
            errBody?.message ||
            errBody?.error?.json?.message ||
            errBody?.error?.message ||
            res.statusText ||
            `HTTP ${res.status}`;

          return new Response(
            JSON.stringify([
              {
                error: {
                  json: {
                    message: errMsg,
                    code: res.status === 401 ? -32001 : res.status === 403 ? -32003 : -32000,
                    data: {
                      httpStatus: res.status,
                      code:
                        res.status === 401
                          ? "UNAUTHORIZED"
                          : res.status === 403
                          ? "FORBIDDEN"
                          : res.status === 501
                          ? "NOT_IMPLEMENTED"
                          : res.status === 422
                          ? "UNPROCESSABLE_CONTENT"
                          : "INTERNAL_SERVER_ERROR",
                      message: errMsg,
                      details: errBody?.details,
                    },
                  },
                },
              },
            ]),
            {
              status: res.status,
              statusText: res.statusText,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        try {
          let json: any;
          if (typeof (res as any).clone === "function") {
            const cloned = (res as any).clone();
            json = await cloned.json();
          } else if (typeof res.json === "function") {
            json = await res.json();
          }

          // Case 1: Array of responses
          if (Array.isArray(json)) {
            const normalized = json.map((item) => {
              if (item?.result) {
                const d = item.result.data;
                if (d && typeof d === "object" && "json" in d) {
                  return item;
                }
                return {
                  ...item,
                  result: {
                    ...item.result,
                    data: {
                      json: d ?? item.result,
                    },
                  },
                };
              }
              return {
                result: {
                  data: {
                    json: item,
                  },
                },
              };
            });
            return new Response(JSON.stringify(normalized), {
              status: res.status,
              statusText: res.statusText,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Case 2: Single response object { result: { data } }
          if (json && typeof json === "object" && "result" in json) {
            const d = json.result?.data;
            if (d && typeof d === "object" && "json" in d) {
              return new Response(JSON.stringify([json]), {
                status: res.status,
                statusText: res.statusText,
                headers: { "Content-Type": "application/json" },
              });
            }
            const normalized = [
              {
                result: {
                  ...json.result,
                  data: {
                    json: d ?? json.result,
                  },
                },
              },
            ];
            return new Response(JSON.stringify(normalized), {
              status: res.status,
              statusText: res.statusText,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Case 3: Raw data object
          if (json !== undefined) {
            const normalized = [
              {
                result: {
                  data: {
                    json,
                  },
                },
              },
            ];
            return new Response(JSON.stringify(normalized), {
              status: res.status,
              statusText: res.statusText,
              headers: { "Content-Type": "application/json" },
            });
          }
        } catch {
          // Not JSON or parse failed, return original response
        }

        return res;
      },
    }),
  ];
}

export const trpc = createTRPCReact<AppRouter>();

export const trpcVanilla = createTRPCProxyClient<AppRouter>({
  links: createTrpcClientLinks(),
});
