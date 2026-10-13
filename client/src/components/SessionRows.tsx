// Today's entries for Stillness and Reading: a total, each row with Edit and Delete.
import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { errorText } from "@/lib/api";
import { FormError, UnitInput, num } from "@/components/Fields";
import { signalError, signalSaved } from "@/lib/feedback";

export type Row = { id: number; title: string; sub: string; minutes: number };

/** `editExtra` renders extra controls inside the row editor; `buildPatch` turns the minutes (and extras) into a PATCH body. */
export function SessionRows({ heading, rows, totalLabel, url, listKey, minutesField, extra }: {
  heading: string; rows: Row[]; totalLabel: string; url: string; listKey: string; minutesField: "minutes" | "durationMin";
  extra?: (row: Row, set: (patch: Record<string, unknown>) => void, patch: Record<string, unknown>) => ReactNode;
}) {
  const qc = useQueryClient();
  const [editId, setEditId] = useState<number | null>(null);
  const [min, setMin] = useState("");
  const [patch, setPatch] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: (a: { method: string; path: string; body?: unknown }) => apiRequest(a.method, a.path, a.body),
    onSuccess: async () => {
      setError(null);
      void listKey;
      await qc.invalidateQueries();
      signalSaved();
    },
    onError: e => { setError(errorText(e)); signalError(); },
  });
  if (!rows.length) return null;
  const total = rows.reduce((a, r) => a + r.minutes, 0);

  function open(r: Row) { if (editId === r.id) return setEditId(null); setEditId(r.id); setMin(String(r.minutes)); setPatch({}); }
  function save(r: Row) {
    const m = num(min);
    if (m == null || Number.isNaN(m) || m < 1 || m > 1440) return setError("Minutes should be between 1 and 1440.");
    run.mutate({ method: "PATCH", path: `${url}/${r.id}`, body: { ...patch, [minutesField]: Math.round(m) } }, { onSuccess: () => setEditId(null) });
  }
  function del(r: Row) {
    if (window.confirm("Delete this entry?")) run.mutate({ method: "DELETE", path: `${url}/${r.id}` }, { onSuccess: () => setEditId(null) });
  }

  return (
    <section aria-label={heading} className="r-card px-4 py-2">
      <div className="flex justify-between items-baseline pt-2 pb-1">
        <h2 className="m-0 text-15 font-semibold">{heading}</h2>
        <span className="font-mono text-13 text-muted">{totalLabel} {total} min</span>
      </div>
      <ul className="m-0 p-0 list-none">
        {rows.map(r => (
          <li key={r.id} className="border-b border-hairline last:border-b-0 text-14">
            <div className="flex items-center justify-between min-h-[52px] gap-2">
              <span className="flex flex-col min-w-0">
                <span className="truncate">{r.title}</span>
                <span className="text-12 text-muted">{r.sub}</span>
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <span className="font-mono">{r.minutes} min</span>
                <button type="button" className="r-button-quiet min-h-[44px] px-3 text-13" onClick={() => open(r)}>{editId === r.id ? "Cancel" : "Edit"}</button>
              </span>
            </div>
            {editId === r.id && (
              <div className="flex flex-col gap-3 pb-3">
                <UnitInput value={min} onChange={setMin} unit="min" label="Minutes" />
                {extra?.(r, p => setPatch(x => ({ ...x, ...p })), patch)}
                <button type="button" className="r-button min-h-[48px]" disabled={run.isPending} onClick={() => save(r)}>Save changes</button>
                <button type="button" className="r-button-quiet min-h-[44px] text-13" disabled={run.isPending} onClick={() => del(r)}>Delete this entry</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <FormError>{error}</FormError>
    </section>
  );
}
