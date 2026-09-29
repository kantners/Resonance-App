import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BriefResponse, MeResponse } from "@shared/api";
import { apiRequest } from "./queryClient";

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
      await Promise.all([
        qc.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/brief") }),
        ...invalidate.map(k => qc.invalidateQueries({ queryKey: [k] })),
      ]);
    },
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
