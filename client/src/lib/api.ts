import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BriefResponse, MeResponse } from "@shared/api";
import { apiRequest } from "./queryClient";
import { signalError, signalSaved } from "./feedback";

export function useMe() {
  return useQuery<MeResponse>({ queryKey: ["/api/me"] });
}

export function useBrief(date: string) {
  return useQuery<BriefResponse>({ queryKey: [`/api/brief/${date}`], staleTime: 0 });
}

/** A mutation that refreshes the Brief (and anything else listed) afterwards. */
export function useSave<TBody, TResult = unknown>(method: string, url: string, invalidate: string[] = []) {
  const qc = useQueryClient();
  return useMutation<TResult, Error, TBody>({
    mutationFn: body => apiRequest<TResult>(method, url, body),
    onSuccess: async () => {
      // staleTime is Infinity, so anything not invalidated stays stale until reload (Sleep prefill,
      // Brief, Trends, evening gap). Inactive queries are only marked stale; active ones refetch.
      void invalidate;
      await qc.invalidateQueries();
      signalSaved();
    },
    onError: () => signalError(),
  });
}

/** Turns "400: {"error":"…"}" from apiRequest into the message. */
export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const m = /^\d{3}: (.*)$/s.exec(msg);
  if (!m) return msg;
  try {
    const j = JSON.parse(m[1]);
    if (j.issues?.length) return j.issues.map((i: { message: string }) => i.message).join(" ");
    return j.error ?? m[1];
  } catch {
    return m[1];
  }
}
