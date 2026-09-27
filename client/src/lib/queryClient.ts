import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// The declared return type intentionally allows callers to specify the
// expected JSON body shape via the generic. Default is `any` because the
// helper actually returns parsed JSON (or null) at runtime, not a Response.
// The previous `Promise<Response>` signature did not match runtime behavior
// and produced typecheck failures at every call site that read body fields.
export async function apiRequest<T = any>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  // Demo mode: refuse any non-GET request so view-only stays view-only
  // even if a button slipped through and called a mutation.
  if (typeof window !== "undefined" && (window.location.hash || "").startsWith("#/demo") && method.toUpperCase() !== "GET") {
    throw new Error("Demo mode is view-only. Sign in to save changes.");
  }
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  const text = await res.text();
  return text ? JSON.parse(text) : (null as T);
}

// Demo route detection. Uses the URL hash (the app is on wouter's
// useHashLocation, so the hash carries the active page route). When the
// page is on /demo, queries are transparently rewritten to /api/demo/*
// where a public mapping exists, and short-circuited to safe empty values
// elsewhere. Real authenticated routes are unaffected.
function isDemoActive(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hash || "";
  return h.startsWith("#/demo") || h === "#/demo";
}
const DEMO_URL_MAP: Record<string, string | null> = {
  "/api/me":         "/api/demo/me",
  "/api/dashboard":  "/api/demo/dashboard",
  "/api/sleep":      "/api/demo/sleep",
  "/api/goals":      "/api/demo/goals",
  "/api/foods":      "/api/demo/foods",
  "/api/activities": "/api/demo/activities",
};
function demoOverridePath(path: string): { override: string | null; matched: boolean } {
  if (path in DEMO_URL_MAP) return { override: DEMO_URL_MAP[path], matched: true };
  // Subpaths that don't have a demo equivalent return null safely so the
  // page renders an empty state instead of hitting a 401 on the protected
  // endpoint.
  return { override: null, matched: false };
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const path = queryKey.join("/");
    if (isDemoActive()) {
      const { override, matched } = demoOverridePath(path);
      if (override) {
        const res = await fetch(`${API_BASE}${override}`, { credentials: "omit" });
        await throwIfResNotOk(res);
        return await res.json();
      }
      // Unmapped path in demo mode: return null/empty so the page renders
      // safely without 401-flooding the protected API.
      return matched ? null : (null as any);
    }
    const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
