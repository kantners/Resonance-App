import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useHashLocation } from "wouter/use-hash-location";
import { Apple, Trash2, PlusCircle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FoodEntry {
  id: number;
  date: string;          // YYYY-MM-DD
  time: string | null;   // HH:MM
  mealType: string;
  portion: string | null;
  description: string | null;
  tags: string | null;   // comma-separated
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
.nu-page { min-height: 100%; font-family: 'Inter', system-ui, sans-serif; }
.nu-body { max-width: var(--page-max, 720px); margin: 0 auto; padding: 0 16px 60px; }

.nu-section-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.10em;
  text-transform: uppercase;
  color: #d97706;
  padding: 16px 4px 8px;
}
[data-theme='dark'] .nu-section-title { color: #fbbf24; }

.nu-day {
  margin-top: 10px;
}
.nu-day-label {
  font-size: 11px; font-weight: 700;
  color: #6b7280;
  letter-spacing: 0.06em; text-transform: uppercase;
  padding: 0 4px 6px;
}
[data-theme='dark'] .nu-day-label { color: rgba(255,255,255,0.65); }

.nu-row {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.06);
  border-left: 3px solid #14b8a6;
  border-radius: 12px;
  margin-bottom: 6px;
}
[data-theme='dark'] .nu-row {
  background: #15171c;
  border-color: rgba(255,255,255,0.06);
  border-left-color: #2dd4bf;
}

.nu-row-main { flex: 1; min-width: 0; }
.nu-row-head {
  display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap;
  font-size: 13px; font-weight: 700; color: #111827;
  text-transform: capitalize;
}
[data-theme='dark'] .nu-row-head { color: #f5f7fa; }
.nu-row-time {
  font-size: 11px; font-weight: 500; color: #6b7280;
  text-transform: none;
}
[data-theme='dark'] .nu-row-time { color: rgba(255,255,255,0.55); }
.nu-row-portion {
  font-size: 10px; font-weight: 700;
  border-radius: 99px; padding: 2px 8px;
  background: rgba(20,184,166,0.12);
  color: #0f766e;
  text-transform: uppercase; letter-spacing: 0.06em;
}
[data-theme='dark'] .nu-row-portion {
  background: rgba(45,212,191,0.16);
  color: #6ee7b7;
}
.nu-row-desc {
  font-size: 12px; color: #374151; margin-top: 3px;
  line-height: 1.4;
}
[data-theme='dark'] .nu-row-desc { color: rgba(255,255,255,0.82); }
.nu-row-tags {
  display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;
}
.nu-tag {
  font-size: 10px; font-weight: 600;
  padding: 2px 7px; border-radius: 99px;
  background: rgba(20,184,166,0.08);
  color: #0f766e;
  text-transform: capitalize;
}
[data-theme='dark'] .nu-tag {
  background: rgba(45,212,191,0.10);
  color: #6ee7b7;
}
.nu-row-delete {
  background: none; border: none; cursor: pointer;
  color: #94a3b8; padding: 2px 4px; flex-shrink: 0;
}
[data-theme='dark'] .nu-row-delete { color: rgba(255,255,255,0.45); }

.nu-empty {
  margin-top: 18px;
  padding: 22px 18px;
  text-align: center;
  background: #fff;
  border: 1px dashed rgba(0,0,0,0.10);
  border-radius: 14px;
  color: #6b7280;
  font-size: 13px; line-height: 1.5;
}
[data-theme='dark'] .nu-empty {
  background: #15171c;
  border-color: rgba(255,255,255,0.10);
  color: rgba(255,255,255,0.70);
}

.nu-cta {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 12px;
  background: #14b8a6;
  color: #fff;
  border: none;
  padding: 9px 14px;
  border-radius: 10px;
  font-size: 12px; font-weight: 700;
  cursor: pointer;
}
.nu-cta:hover { background: #0d9488; }

.nu-error {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.20);
  color: #b91c1c;
  font-size: 13px;
}
[data-theme='dark'] .nu-error {
  background: rgba(239,68,68,0.10);
  border-color: rgba(239,68,68,0.35);
  color: #fca5a5;
}
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dt0 = new Date(dt);
  dt0.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - dt0.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NutritionPage() {
  const [, navigate] = useHashLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  // Inject CSS once
  if (typeof document !== "undefined" && !document.getElementById("kewt-nu-css")) {
    const el = document.createElement("style");
    el.id = "kewt-nu-css";
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  const { data: entries = [], isLoading, isError, error } = useQuery<FoodEntry[]>({
    queryKey: ["/api/foods"],
    // Default to empty on any failure so the page never breaks.
    retry: false,
  });

  const delMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/foods/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/foods"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
      toast({ title: "Entry removed" });
    },
    onError: (e: any) => toast({ title: "Could not delete", description: e.message, variant: "destructive" }),
  });

  // Group entries by date (newest first). Within a date, newest first by id.
  const grouped = (() => {
    const buckets = new Map<string, FoodEntry[]>();
    for (const e of entries) {
      if (!buckets.has(e.date)) buckets.set(e.date, []);
      buckets.get(e.date)!.push(e);
    }
    const sortedDates = Array.from(buckets.keys()).sort((a, b) => b.localeCompare(a));
    return sortedDates.map(d => ({ date: d, items: buckets.get(d)! }));
  })();

  return (
    <div className="nu-page">
      <div className="kewt-cin-hero" style={{ borderRadius: "0 0 24px 24px" }}>
        <img
          src="/hero_dailylog.jpg"
          alt=""
          className="kewt-cin-hero__img"
          style={{ objectPosition: "center 55%" }}
        />
        <div className="kewt-cin-hero__overlay" style={{ "--cin-base": "rgb(10,30,28)" } as React.CSSProperties} />
        <div className="kewt-cin-hero__content">
          <div className="kewt-cin-hero__eyebrow" style={{ color: "#fbbf24" }}>
            Food Signals
          </div>
          <div className="kewt-cin-hero__title">Nutrition.</div>
          <div className="kewt-cin-hero__bar" style={{ background: "linear-gradient(90deg,#fbbf24,#14b8a6)" }} />
          <div className="kewt-cin-hero__sub">Recent food entries logged in Daily Log.</div>
        </div>
      </div>

      <div className="nu-body">
        <div className="nu-section-title">
          <Apple size={13} />
          Recent Food Entries
        </div>

        {isLoading && (
          <div className="nu-empty">Loading your food entries...</div>
        )}

        {isError && !isLoading && (
          <div className="nu-error">
            Could not load food entries right now. If this is a fresh deploy, the food signals table may still be syncing. Try again in a moment.
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>{(error as any)?.message}</div>
          </div>
        )}

        {!isLoading && !isError && grouped.length === 0 && (
          <div className="nu-empty">
            No food entries yet. Open Daily Log, expand the Food row, and your saved entries will appear here.
            <div>
              <button className="nu-cta" onClick={() => navigate("/log")}>
                <PlusCircle size={13} /> Open Daily Log
              </button>
            </div>
          </div>
        )}

        {!isLoading && !isError && grouped.map(g => (
          <div key={g.date} className="nu-day">
            <div className="nu-day-label">{fmtDayLabel(g.date)}</div>
            {g.items.map(f => {
              const tags = (f.tags || "").split(",").map(t => t.trim()).filter(Boolean);
              return (
                <div key={f.id} className="nu-row">
                  <div className="nu-row-main">
                    <div className="nu-row-head">
                      <span>{f.mealType.replace(/_/g, " ")}</span>
                      {f.time && <span className="nu-row-time">{f.time}</span>}
                      {f.portion && <span className="nu-row-portion">{f.portion}</span>}
                    </div>
                    {f.description && <div className="nu-row-desc">{f.description}</div>}
                    {tags.length > 0 && (
                      <div className="nu-row-tags">
                        {tags.map(t => (
                          <span key={t} className="nu-tag">{t.replace(/_/g, " ")}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="nu-row-delete"
                    onClick={() => { if (confirm("Delete this food entry?")) delMut.mutate(f.id); }}
                    aria-label="Delete entry"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
