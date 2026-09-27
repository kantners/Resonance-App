import { localToday, localDate, fmtLocalDate } from "@/lib/dateUtils";
import { useState, useRef, useCallback, useEffect } from "react";
import ScreenshotImport from "@/components/ScreenshotImport";
import { FastingCrossroads } from "@/components/FastingCrossroads";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Build-time resolved API base — same substitution used by queryClient
const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
import {
  Upload as UploadIcon, FileText, CheckCircle2, AlertCircle,
  Loader2, X, Activity, Zap, Heart, Mountain, Timer,
  Bike, Footprints, Dumbbell, Flame, ChevronRight, RefreshCw,
  Shield, Eye, ExternalLink, Link, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Modality options ──────────────────────────────────────────────────────────
const MODALITIES = [
  { value: "running",  label: "Running" },
  { value: "cycling",  label: "Cycling" },
  { value: "walking",  label: "Walking" },
  { value: "hiking",   label: "Hiking" },
  { value: "swimming", label: "Swimming" },
  { value: "strength", label: "Strength" },
  { value: "rucking",  label: "Rucking" },
  { value: "yoga",     label: "Yoga" },
  { value: "other",    label: "Other" },
];

// ── Types ──────────────────────────────────────────────────────────────────────
interface ParsedResult {
  file: string;
  status: "parsed" | "error" | "empty" | "unsupported" | "sleep_imported";
  sport?: string;
  name?: string;
  startDate?: string;
  durationSec?: number;
  distanceMiles?: number;
  avgHeartrate?: number;
  maxHeartrate?: number;
  avgWatts?: number;
  maxWatts?: number;
  normalizedWatts?: number;
  totalAscentFt?: number;
  calories?: number;
  avgCadence?: number;
  avgSpeedMph?: number;
  trackPoints?: number;
  recordCount?: number;
  saved_id?: number;
  save_error?: string;
  message?: string;
  // Sleep import fields
  date?: string;
  hours?: number;
  quality?: number;
  restingHr?: number;
}

interface UploadResponse {
  processed: number;
  saved: number;
  results: ParsedResult[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDuration(sec?: number) {
  if (!sec) return "--";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtPace(durationSec?: number, distanceMiles?: number) {
  if (!durationSec || !distanceMiles || distanceMiles === 0) return null;
  const paceDecMin = (durationSec / 60) / distanceMiles;
  const paceMin = Math.floor(paceDecMin);
  const paceSec = Math.round((paceDecMin - paceMin) * 60);
  return `${paceMin}:${paceSec.toString().padStart(2, "0")}/mi`;
}

function sportIcon(sport?: string) {
  switch ((sport || "").toLowerCase()) {
    case "cycling": return <Bike size={16} />;
    case "run":     return <Footprints size={16} />;
    case "walk":    return <Footprints size={16} />;
    case "strength": return <Dumbbell size={16} />;
    default:        return <Activity size={16} />;
  }
}

function sportColor(sport?: string) {
  switch ((sport || "").toLowerCase()) {
    case "cycling":  return "#f59e0b";
    case "run":      return "#10b981";
    case "walk":     return "#3b82f6";
    case "strength": return "#8b5cf6";
    case "swim":     return "#06b6d4";
    default:         return "#64748b";
  }
}

// ── CSS injected once ──────────────────────────────────────────────────────────
const UPLOAD_CSS = `
.upload-page {
  min-height: 100vh;
  background: var(--color-bg);
  padding-bottom: 40px;
}

/* Hero */
.upload-hero {
  text-align: center;
  padding: 24px 20px 0;
  max-width: 680px;
  margin: 0 auto;
}
.upload-refresh-btn-bottom {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 22px;
  border-radius: 24px;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.15s, color 0.15s;
}
.upload-refresh-btn-bottom:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.upload-refresh-btn--spinning svg {
  animation: upload-spin 0.7s linear infinite;
}
@keyframes upload-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.upload-hero-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-ember);
  margin-bottom: 8px;
}
.upload-hero-title {
  font-size: clamp(1.5rem, 4vw, 2.2rem);
  font-weight: 800;
  line-height: 1.15;
  color: var(--color-text);
  margin-bottom: 10px;
}
.upload-hero-sub {
  font-size: 14px;
  color: var(--color-text-muted);
  line-height: 1.6;
  max-width: 520px;
  margin: 0 auto 0;
}
.upload-format-pills {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
}
.upload-format-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  border: 1.5px solid;
}
.upload-format-pill--fit  { background: #f59e0b15; color: #b45309; border-color: #f59e0b40; }
.upload-format-pill--tcx  { background: #3b82f615; color: #1d4ed8; border-color: #3b82f640; }
.upload-format-pill--gpx  { background: #10b98115; color: #065f46; border-color: #10b98140; }
.upload-format-pill--csv  { background: #8b5cf615; color: #6d28d9; border-color: #8b5cf640; }

/* Drop zone — condensed (Phase: reduce wasted whitespace) */
.upload-zone-wrap {
  max-width: 680px;
  margin: 10px auto 0;
  padding: 0 16px;
}
.upload-drop {
  border: 2px dashed var(--color-border);
  border-radius: 14px;
  padding: 12px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 200ms ease;
  background: var(--color-surface);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.upload-drop:hover,
.upload-drop--active {
  border-color: var(--color-ember);
  background: hsl(36 91% 50% / 0.04);
}
.upload-drop--active {
  transform: scale(1.01);
}
.upload-drop-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, hsl(36 91% 50% / 0.15) 0%, hsl(158 72% 28% / 0.15) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 0 2px;
}
.upload-drop-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}
.upload-drop-sub {
  font-size: 11px;
  color: var(--color-text-muted);
  margin: 0 0 4px;
  line-height: 1.3;
}
.upload-drop-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 9px;
  background: var(--color-ember);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: opacity 150ms;
}
.upload-drop-btn:hover { opacity: 0.88; }

/* On narrow/mobile screens, compact the drop zone further — this is where
   the wasted-space problem was most visible, since the box didn't shrink
   its own padding at smaller widths before. */
@media (max-width: 480px) {
  .upload-zone-wrap { padding: 0 12px; }
  .upload-drop { padding: 10px 12px; border-radius: 12px; gap: 3px; }
  .upload-drop-icon { width: 24px; height: 24px; border-radius: 7px; }
  .upload-drop-title { font-size: 13px; }
  .upload-drop-sub { font-size: 10.5px; margin-bottom: 2px; }
  .upload-drop-btn { padding: 5px 12px; font-size: 11.5px; }
}

/* Queued files */
.upload-queue {
  max-width: 680px;
  margin: 14px auto 0;
  padding: 0 16px;
}
.upload-queue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.upload-queue-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.upload-queue-clear {
  font-size: 12px;
  color: var(--color-text-faint);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}
.upload-queue-clear:hover { color: #ef4444; background: #ef444415; }

.upload-file-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  margin-bottom: 8px;
  transition: border-color 150ms;
}
.upload-file-row--ready  { border-color: var(--color-border); }
.upload-file-row--ok     { border-color: #10b98140; background: #10b9810a; }
.upload-file-row--error  { border-color: #ef444440; background: #ef44440a; }
.upload-file-ext {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}
.upload-file-ext--fit { background: #f59e0b20; color: #b45309; }
.upload-file-ext--tcx { background: #3b82f620; color: #1d4ed8; }
.upload-file-ext--gpx { background: #10b98120; color: #065f46; }
.upload-file-name { font-size: 13px; font-weight: 600; color: var(--color-text); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.upload-file-size { font-size: 11px; color: var(--color-text-faint); }
.upload-file-remove { background: none; border: none; cursor: pointer; color: var(--color-text-faint); padding: 4px; border-radius: 6px; }
.upload-file-remove:hover { color: #ef4444; background: #ef444415; }

/* Submit button */
.upload-submit-wrap {
  max-width: 680px;
  margin: 20px auto 0;
  padding: 0 20px;
}
.upload-submit-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px;
  border-radius: 14px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 800;
  border: none;
  cursor: pointer;
  transition: opacity 150ms, transform 100ms;
  box-shadow: 0 4px 20px #f59e0b40;
}
.upload-submit-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
.upload-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Results */
.upload-results {
  max-width: 680px;
  margin: 32px auto 0;
  padding: 0 20px;
}
.upload-results-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}
.upload-results-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--color-text);
}
.upload-results-summary {
  margin-left: auto;
  display: flex;
  gap: 12px;
}
.upload-summary-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
}
.upload-summary-chip--saved { background: #10b98115; color: #065f46; border: 1px solid #10b98130; }
.upload-summary-chip--error { background: #ef444415; color: #b91c1c; border: 1px solid #ef444430; }

.upload-result-card {
  border-radius: 16px;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  overflow: hidden;
  margin-bottom: 14px;
}
.upload-result-card--saved { border-color: #10b98140; }
.upload-result-card--error { border-color: #ef444440; }

.upload-result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}
.upload-result-sport-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.upload-result-name { font-size: 15px; font-weight: 700; color: var(--color-text); }
.upload-result-file { font-size: 11px; color: var(--color-text-faint); margin-top: 2px; }
.upload-result-badge {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 20px;
}
.upload-result-badge--saved { background: #10b98115; color: #065f46; }
.upload-result-badge--error { background: #ef444415; color: #b91c1c; }

.upload-result-stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 1px;
  background: var(--color-border);
  border-top: 1px solid var(--color-border);
}
.upload-stat {
  background: var(--color-surface);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.upload-stat-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-faint);
}
.upload-stat-value {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text);
}
.upload-stat-value--highlight { color: var(--color-ember); }

.upload-error-msg {
  padding: 12px 16px;
  font-size: 13px;
  color: #b91c1c;
  border-top: 1px solid #ef444420;
  background: #ef44440a;
}

/* ── Garmin Connect Sync Section ──────────────────────────────────────── */
/* How to export guide */
.upload-guide {
  max-width: 680px;
  margin: 40px auto 0;
  padding: 0 20px;
}
.upload-guide-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 14px;
}
.upload-guide-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.upload-guide-card {
  border-radius: 14px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  padding: 18px;
}
.upload-guide-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.upload-guide-card-icon {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
}
.upload-guide-card-name { font-size: 14px; font-weight: 700; color: var(--color-text); }
.upload-guide-card-format { font-size: 11px; color: var(--color-text-faint); margin-top: 1px; }
.upload-guide-steps { list-style: none; padding: 0; margin: 0; }
.upload-guide-step {
  display: flex;
  gap: 10px;
  font-size: 13px;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin-bottom: 7px;
}
.upload-guide-step-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-ember);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

/* ── Garmin Link Section ─────────────────────────────────────────────────── */
.garmin-link-section {
  max-width: 480px;
  margin: 0 auto;
  padding: 0 16px;
}
.garmin-link-card {
  background: var(--color-card, #fff);
  border: 1px solid var(--color-border, rgba(0,0,0,0.08));
  border-radius: 14px;
  padding: 12px 16px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.garmin-link-input-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.garmin-link-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  border: 1.5px solid var(--color-border, rgba(0,0,0,0.12));
  border-radius: 12px;
  font-size: 14px;
  background: var(--color-bg);
  color: var(--color-text);
  outline: none;
  text-align: center;
  transition: border-color 150ms;
}
.garmin-link-input:focus { border-color: var(--color-primary); }
.garmin-link-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #003A8C 0%, #00A3FF 100%);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 150ms;
}
.garmin-link-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.garmin-link-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--color-text-muted);
  justify-content: center;
}
.garmin-link-error {
  font-size: 12px;
  color: #dc2626;
  text-align: center;
  padding: 6px 0;
}
.garmin-link-result {
  width: 100%;
  border-top: 1px solid var(--color-border);
  padding-top: 14px;
}
.garmin-link-result-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
  text-align: center;
  margin-bottom: 12px;
}
.garmin-link-metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.garmin-link-metric {
  background: var(--color-bg);
  border-radius: 10px;
  padding: 10px 12px;
  text-align: center;
}
.garmin-link-metric-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-text-muted);
  margin-bottom: 3px;
}
.garmin-link-metric-value {
  font-size: 16px;
  font-weight: 800;
  color: var(--color-text);
}
.garmin-link-log-btn {
  width: 100%;
  padding: 11px;
  border-radius: 12px;
  border: none;
  background: var(--color-primary);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: opacity 150ms;
}
.garmin-link-log-btn:disabled { opacity: 0.45; cursor: not-allowed; }
[data-theme="dark"] .garmin-link-card { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.09); }
[data-theme="dark"] .garmin-link-input { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.12); }
[data-theme="dark"] .garmin-link-metric { background: rgba(255,255,255,0.04); }
`;

// ── Garmin Sync Section Component ───────────────────────────────────────────────
// ── Main Upload Page ─────────────────────────────────────────────────────────────

// ── Garmin Link Parser Section ─────────────────────────────────────────────
function GarminLinkSection({ onActivityLogged }: { onActivityLogged: () => void }) {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);

  const parse = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setMetrics(null);
    try {
      const res = await fetch("/api/parse-garmin-link", { credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Parse failed");
      setMetrics(data.metrics);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const logActivity = async () => {
    if (!metrics) return;
    setLogging(true);
    try {
      // Map parsed metrics to activity log format
      const payload = {
        date: metrics.date || localToday(),
        activity_type: metrics.sport || "walk",
        duration_min: metrics.durationSec ? Math.round(metrics.durationSec / 60) : null,
        distance_miles: metrics.distance ? parseFloat(metrics.distance) : null,
        avg_heart_rate: metrics.avgHR || null,
        max_heart_rate: metrics.maxHR || null,
        calories: metrics.calories || null,
        avg_cadence: metrics.avgCadence || null,
        total_ascent_ft: metrics.totalAscentFt || null,
        notes: `Imported from Garmin Connect link. ${metrics.name || ""}`.trim(),
        source: "garmin_link",
        source_url: metrics.sourceUrl || null,
      };
      const res = await fetch("/api/activities", { credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to log activity");
      toast({ title: "Activity logged", description: `${metrics.name || "Activity"} added to your log.` });
      setMetrics(null);
      setUrl("");
      onActivityLogged();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLogging(false);
    }
  };

  const fmtDur = (sec?: number) => {
    if (!sec) return null;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="garmin-link-section">
      <div className="garmin-link-card">
        <div className="garmin-link-input-row">
          <input
            className="garmin-link-input"
            type="url"
            placeholder="Paste link to activity"
            value={url}
            onChange={e => {
              // Strip Garmin share-text prefix (e.g. "Check out my activity... #beatyesterday https://...")
              const raw = e.target.value;
              const match = raw.match(/https?:\/\/[^\s]+/);
              const cleaned = match ? match[0].replace(/[,;"'>)]$/, "").split("#")[0].trim() : raw;
              setUrl(cleaned);
            }}
            onKeyDown={e => e.key === "Enter" && parse()}
          />
          <button className="garmin-link-btn" onClick={parse} disabled={loading || !url.trim()}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            {loading ? "Reading..." : "Parse"}
          </button>
        </div>
        <div className="garmin-link-hint">
          <Shield size={10} />
          Only public activity links are supported. Privacy is controlled by the originating platform.
        </div>

        {error && <div className="garmin-link-error">{error}</div>}

        {metrics && (
          <div className="garmin-link-result">
            <div className="garmin-link-result-title">
              <CheckCircle2 size={14} color="#10b981" />
              {metrics.name || "Activity"} — ready to log
            </div>
            <div className="garmin-link-metrics">
              {metrics.distance && (
                <div className="garmin-link-metric">
                  <div className="garmin-link-metric-label">Distance</div>
                  <div className="garmin-link-metric-value">{parseFloat(metrics.distance).toFixed(2)} mi</div>
                </div>
              )}
              {metrics.durationSec && (
                <div className="garmin-link-metric">
                  <div className="garmin-link-metric-label">Duration</div>
                  <div className="garmin-link-metric-value">{fmtDur(metrics.durationSec)}</div>
                </div>
              )}
              {metrics.avgPace && (
                <div className="garmin-link-metric">
                  <div className="garmin-link-metric-label">Avg Pace</div>
                  <div className="garmin-link-metric-value">{metrics.avgPace}</div>
                </div>
              )}
              {metrics.avgHR && (
                <div className="garmin-link-metric">
                  <div className="garmin-link-metric-label">Avg HR</div>
                  <div className="garmin-link-metric-value">{metrics.avgHR} bpm</div>
                </div>
              )}
              {metrics.calories && (
                <div className="garmin-link-metric">
                  <div className="garmin-link-metric-label">Calories</div>
                  <div className="garmin-link-metric-value">{metrics.calories}</div>
                </div>
              )}
              {metrics.steps && (
                <div className="garmin-link-metric">
                  <div className="garmin-link-metric-label">Steps</div>
                  <div className="garmin-link-metric-value">{metrics.steps.toLocaleString()}</div>
                </div>
              )}
              {metrics.totalAscentFt && (
                <div className="garmin-link-metric">
                  <div className="garmin-link-metric-label">Ascent</div>
                  <div className="garmin-link-metric-value">{metrics.totalAscentFt} ft</div>
                </div>
              )}
              {metrics.bodyBatteryChange != null && (
                <div className="garmin-link-metric">
                  <div className="garmin-link-metric-label">Body Battery</div>
                  <div className="garmin-link-metric-value" style={{ color: metrics.bodyBatteryChange >= 0 ? "#10b981" : "#f59e0b" }}>
                    {metrics.bodyBatteryChange > 0 ? "+" : ""}{metrics.bodyBatteryChange}
                  </div>
                </div>
              )}
            </div>
            <button className="garmin-link-log-btn" onClick={logActivity} disabled={logging}>
              {logging ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {logging ? "Logging..." : "Log this activity"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UploadPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [queued, setQueued] = useState<File[]>([]);
  const [results, setResults] = useState<UploadResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // modality overrides keyed by result index — user can correct after save
  const [modalityOverrides, setModalityOverrides] = useState<Record<number, string>>({});
  const [crossroads, setCrossroads] = useState<{ activityId: number; fastHours: number; activityType: string; durationMin: number } | null>(null);

  // Inject CSS once
  const [cssInjected] = useState(() => {
    if (typeof document !== "undefined") {
      const el = document.getElementById("upload-page-css");
      if (!el) {
        const style = document.createElement("style");
        style.id = "upload-page-css";
        style.textContent = UPLOAD_CSS;
        document.head.appendChild(style);
      }
    }
    return true;
  });

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const valid = arr.filter(f => /\.(fit|tcx|gpx|csv)$/i.test(f.name));
    const invalid = arr.filter(f => !/\.(fit|tcx|gpx|csv)$/i.test(f.name));
    if (invalid.length) {
      toast({ title: "Unsupported file type", description: `Only .fit, .tcx, .gpx, and .csv files are accepted. Skipped: ${invalid.map(f => f.name).join(", ")}`, variant: "destructive" });
    }
    if (valid.length) {
      // Use name+size+lastModified as key so re-uploading the same
      // filename always works — critical for screenshot retry flows
      setQueued(prev => {
        const existing = new Set(prev.map(f => `${f.name}:${f.size}:${f.lastModified}`));
        return [...prev, ...valid.filter(f => !existing.has(`${f.name}:${f.size}:${f.lastModified}`))];
      });
      setResults(null);
    }
  }, [toast]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries();
    // Brief visual spin even if queries resolve instantly
    setTimeout(() => setRefreshing(false), 700);
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) {
      addFiles(e.dataTransfer.files);
    }
  };

  const mutation = useMutation({
    mutationFn: async (files: File[]) => {
      const csvFiles = files.filter(f => f.name.toLowerCase().endsWith(".csv"));
      const activityFiles = files.filter(f => !f.name.toLowerCase().endsWith(".csv"));

      // Body comp CSVs — one request per file
      let bodyCompResults: any[] = [];
      for (const csv of csvFiles) {
        const fd = new FormData();
        fd.append("file", csv);
        const r = await fetch(`${API_BASE}/api/body-composition/import-csv`, { method: "POST", body: fd, credentials: "include" });
        if (!r.ok) { const t = await r.text(); throw new Error(t); }
        bodyCompResults.push(await r.json());
      }

      // Activity files
      let activityResult: UploadResponse | null = null;
      if (activityFiles.length) {
        const form = new FormData();
        activityFiles.forEach(f => form.append("files", f));
        const res = await fetch(`${API_BASE}/api/upload/activity`, { method: "POST", body: form, credentials: "include" });
        if (!res.ok) { const t = await res.text(); throw new Error(t); }
        activityResult = await res.json() as UploadResponse;
      }

      return { activityResult, bodyCompResults };
    },
    onSuccess: async ({ activityResult, bodyCompResults }) => {
      if (activityResult) setResults(activityResult);
      setQueued([]);
      setModalityOverrides({});
      qc.invalidateQueries({ queryKey: ["/api/activities"], exact: false });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
      qc.invalidateQueries({ queryKey: ["/api/health-markers"], exact: false });

      // Toast: activity files
      if (activityResult) {
        toast({
          title: `${activityResult.saved} activit${activityResult.saved === 1 ? "y" : "ies"} imported`,
          description: `${activityResult.processed} file${activityResult.processed === 1 ? "" : "s"} processed.`,
        });
      }

      // Toast: body comp CSVs
      if (bodyCompResults.length) {
        const totalRows = bodyCompResults.reduce((sum: number, r: any) => sum + (r.imported ?? r.rows ?? 0), 0);
        toast({
          title: `Body composition updated`,
          description: `${totalRows} record${totalRows === 1 ? "" : "s"} imported from scale data.`,
        });
      }

      // Check fasting overlap on first saved activity
      if (activityResult) {
        try {
          const firstId = activityResult.results?.find((r: any) => r.saved_id)?.saved_id;
          if (firstId) {
            const report = await apiRequest("GET", `/api/fasting/activity-report/${firstId}`);
            if (report?.fasted && report?.hoursAtStart > 0) {
              setCrossroads({
                activityId: firstId,
                fastHours: report.hoursAtStart,
                activityType: report.activityType ?? "activity",
                durationMin: report.durationMin ?? 30,
              });
            }
          }
        } catch (_) {}
      }
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  // Patch a saved activity's modality in-place
  const patchModality = useMutation({
    mutationFn: async ({ id, modality }: { id: number; modality: string }) =>
      apiRequest("PUT", `/api/activities/${id}`, { modality }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/activities"], exact: false });
      qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
      toast({ title: "Activity type updated" });
    },
    onError: () => toast({ title: "Could not update activity type", variant: "destructive" }),
  });

  const extClass = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    return `upload-file-ext--${ext || "fit"}`;
  };
  const extLabel = (name: string) => (name.split(".").pop() || "FILE").toUpperCase();

  return (
    <div className="upload-page">
      {crossroads && (
        <FastingCrossroads
          activityId={crossroads.activityId}
          fastHours={crossroads.fastHours}
          activityType={crossroads.activityType}
          durationMin={crossroads.durationMin}
          onClose={() => setCrossroads(null)}
        />
      )}

      {/* Cinematic Hero — full-bleed */}
      <div className="kewt-cin-hero" style={{ borderRadius: "0 0 24px 24px", marginBottom: 24 }}>
        <img
          src="/hero_upload.png"
          alt=""
          className="kewt-cin-hero__img"
          style={{ objectPosition: "center 40%" }}
        />
        <div className="kewt-cin-hero__overlay" style={{ "--cin-base": "rgb(10,26,13)" } as React.CSSProperties} />
        <div className="kewt-cin-hero__content">
          <div className="kewt-cin-hero__eyebrow" style={{ color: "#f59e0b" }}>KEWT · Activity File Import</div>
          <div className="kewt-cin-hero__title">Upload<br/>Your Data.</div>
          <div className="kewt-cin-hero__bar" style={{ background: "linear-gradient(90deg,#10b981,#f59e0b)" }} />
          <div className="kewt-cin-hero__sub">.FIT · .TCX · .GPX · .CSV</div>
        </div>
      </div>

      {/* Queued file list */}
      {queued.length > 0 && (
        <div className="upload-queue">
          <div className="upload-queue-header">
            <span className="upload-queue-title">{queued.length} file{queued.length > 1 ? "s" : ""} ready</span>
            <button className="upload-queue-clear" onClick={() => setQueued([])}>Clear all</button>
          </div>
          {queued.map((f, i) => (
            <div key={f.name} className={`upload-file-row upload-file-row--ready`} data-testid={`queued-file-${i}`}>
              <div className={`upload-file-ext ${extClass(f.name)}`}>{extLabel(f.name)}</div>
              <span className="upload-file-name">{f.name}</span>
              <span className="upload-file-size">{(f.size / 1024).toFixed(0)} KB</span>
              <button className="upload-file-remove" onClick={() => setQueued(prev => prev.filter((_, j) => j !== i))}>
                <X size={14} />
              </button>
            </div>
          ))}

          <div className="upload-submit-wrap" style={{ padding: 0, marginTop: 16 }}>
            <button
              className="upload-submit-btn"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(queued)}
              data-testid="button-upload-submit"
            >
              {mutation.isPending
                ? <><Loader2 size={18} className="animate-spin" /> Parsing {queued.length} file{queued.length > 1 ? "s" : ""}...</>
                : <><UploadIcon size={18} /> Import {queued.length} file{queued.length > 1 ? "s" : ""} into <em className="ki">KEWT</em></>
              }
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="upload-results">
          <div className="upload-results-header">
            <CheckCircle2 size={22} color="#10b981" />
            <span className="upload-results-title">Import Complete</span>
            <div className="upload-results-summary">
              {results.saved > 0 && (
                <span className="upload-summary-chip upload-summary-chip--saved">
                  <CheckCircle2 size={12} /> {results.saved} saved
                </span>
              )}
              {results.results.filter(r => r.status === "error").length > 0 && (
                <span className="upload-summary-chip upload-summary-chip--error">
                  <AlertCircle size={12} /> {results.results.filter(r => r.status === "error").length} failed
                </span>
              )}
            </div>
          </div>

          {results.results.map((r, i) => {
            const isSaved = (r.status === "parsed" && r.saved_id !== undefined) || r.status === "sleep_imported";
            const isError = r.status === "error" || r.status === "unsupported" || r.status === "empty";
            // current modality: override takes precedence over FIT-detected sport
            const currentModality = modalityOverrides[i] ?? (r.sport?.toLowerCase() || "other");
            const color = sportColor(currentModality);
            const pace = fmtPace(r.durationSec, r.distanceMiles);

            return (
              <div key={i} className={`upload-result-card ${isSaved ? "upload-result-card--saved" : isError ? "upload-result-card--error" : ""}`}>
                <div className="upload-result-header">
                  <div className="upload-result-sport-icon" style={{ background: `${color}20` }}>
                    <span style={{ color }}>{sportIcon(currentModality)}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="upload-result-name">{r.status === "sleep_imported" ? "Sleep Log" : (r.name || r.file)}</div>
                    <div className="upload-result-file">
                      {r.status === "sleep_imported" ? r.file : (r.startDate ? localDate(r.startDate.slice(0,10)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : r.file)}
                    </div>
                    {/* Modality override — shown on saved activity cards only */}
                    {isSaved && r.saved_id && r.status !== "sleep_imported" && (
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 500 }}>Activity type</span>
                        <select
                          value={currentModality}
                          onChange={e => {
                            const val = e.target.value;
                            setModalityOverrides(prev => ({ ...prev, [i]: val }));
                            patchModality.mutate({ id: r.saved_id!, modality: val });
                          }}
                          style={{
                            fontSize: 12, fontWeight: 600,
                            border: "1.5px solid var(--color-border)",
                            borderRadius: 8, padding: "2px 8px",
                            background: "var(--color-bg)",
                            color: "var(--color-text)",
                            cursor: "pointer",
                          }}
                        >
                          {MODALITIES.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className={`upload-result-badge ${isSaved ? "upload-result-badge--saved" : "upload-result-badge--error"}`}>
                    {isSaved ? <><CheckCircle2 size={12} /> Saved</> : <><AlertCircle size={12} /> {r.status}</>}
                  </div>
                </div>

                {r.status === "parsed" && (
                  <div className="upload-result-stats">
                    <div className="upload-stat">
                      <span className="upload-stat-label"><Timer size={9} style={{display:"inline",marginRight:3}}/>Duration</span>
                      <span className="upload-stat-value">{fmtDuration(r.durationSec)}</span>
                    </div>
                    {r.distanceMiles !== undefined && r.distanceMiles > 0 && (
                      <div className="upload-stat">
                        <span className="upload-stat-label">Distance</span>
                        <span className="upload-stat-value">{r.distanceMiles} mi</span>
                      </div>
                    )}
                    {pace && (
                      <div className="upload-stat">
                        <span className="upload-stat-label">Avg Pace</span>
                        <span className="upload-stat-value upload-stat-value--highlight">{pace}</span>
                      </div>
                    )}
                    {r.avgWatts && (
                      <div className="upload-stat">
                        <span className="upload-stat-label"><Zap size={9} style={{display:"inline",marginRight:3}}/>Avg Power</span>
                        <span className="upload-stat-value upload-stat-value--highlight">{r.avgWatts}W</span>
                      </div>
                    )}
                    {r.normalizedWatts && (
                      <div className="upload-stat">
                        <span className="upload-stat-label">NP</span>
                        <span className="upload-stat-value">{r.normalizedWatts}W</span>
                      </div>
                    )}
                    {r.avgHeartrate && (
                      <div className="upload-stat">
                        <span className="upload-stat-label"><Heart size={9} style={{display:"inline",marginRight:3}}/>Avg HR</span>
                        <span className="upload-stat-value">{r.avgHeartrate} bpm</span>
                      </div>
                    )}
                    {r.maxHeartrate && (
                      <div className="upload-stat">
                        <span className="upload-stat-label">Max HR</span>
                        <span className="upload-stat-value">{r.maxHeartrate} bpm</span>
                      </div>
                    )}
                    {r.totalAscentFt && (
                      <div className="upload-stat">
                        <span className="upload-stat-label"><Mountain size={9} style={{display:"inline",marginRight:3}}/>Elevation</span>
                        <span className="upload-stat-value">+{r.totalAscentFt} ft</span>
                      </div>
                    )}
                    {r.calories && (
                      <div className="upload-stat">
                        <span className="upload-stat-label"><Flame size={9} style={{display:"inline",marginRight:3}}/>Calories</span>
                        <span className="upload-stat-value">{r.calories}</span>
                      </div>
                    )}
                    {r.avgCadence && (
                      <div className="upload-stat">
                        <span className="upload-stat-label">Cadence</span>
                        <span className="upload-stat-value">{r.avgCadence} rpm</span>
                      </div>
                    )}
                    {r.avgSpeedMph && (
                      <div className="upload-stat">
                        <span className="upload-stat-label">Avg Speed</span>
                        <span className="upload-stat-value">{r.avgSpeedMph} mph</span>
                      </div>
                    )}
                  </div>
                )}

                {r.status === "sleep_imported" && (
                  <div className="upload-result-stats">
                    <div className="upload-stat">
                      <span className="upload-stat-label">Date</span>
                      <span className="upload-stat-value">{r.date || ""}</span>
                    </div>
                    <div className="upload-stat">
                      <span className="upload-stat-label">Sleep</span>
                      <span className="upload-stat-value">{r.hours ? `${r.hours}h` : ""}</span>
                    </div>
                    <div className="upload-stat">
                      <span className="upload-stat-label">Quality</span>
                      <span className="upload-stat-value upload-stat-value--highlight">{r.quality}/10</span>
                    </div>
                    {r.restingHr && (
                      <div className="upload-stat">
                        <span className="upload-stat-label">Resting HR</span>
                        <span className="upload-stat-value">{r.restingHr} bpm</span>
                      </div>
                    )}
                  </div>
                )}

                {(r.status === "error" || r.status === "empty" || r.status === "unsupported" || r.save_error) && (
                  <div className="upload-error-msg">
                    {r.save_error ? `Save error: ${r.save_error}` : r.message || "Could not parse file."}
                  </div>
                )}
              </div>
            );
          })}

          <button
            style={{ display:"flex", alignItems:"center", gap:8, marginTop:16, background:"none", border:"1.5px solid var(--color-border)", borderRadius:10, padding:"10px 18px", cursor:"pointer", color:"var(--color-text-muted)", fontSize:13, fontWeight:600 }}
            onClick={() => { setResults(null); }}
          >
            <RefreshCw size={14} /> Upload more files
          </button>
        </div>
      )}

      {/* Drop zone — primary action */}
      <div className="upload-zone-wrap">
        <div
          ref={dropRef}
          className={`upload-drop ${dragging ? "upload-drop--active" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          data-testid="upload-dropzone"
        >
          <input
            id="upload-activity-input"
            ref={inputRef}
            type="file"
            multiple
            accept=".fit,.tcx,.gpx,.csv"
            onChange={e => { if (e.target.files?.length) { addFiles(e.target.files); e.target.value = ""; } }}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          />
          <div className="upload-drop-icon">
            <UploadIcon size={20} color="#f59e0b" />
          </div>
          <div className="upload-drop-title">
            {dragging ? "Drop to feed KEWT" : "Drag your activity files here"}
          </div>
          <div className="upload-drop-sub">
            .FIT · .TCX · .GPX · .CSV &nbsp; — &nbsp; multiple files at once
          </div>
          <label htmlFor="upload-activity-input" className="upload-drop-btn" style={{ cursor: "pointer" }}>
            <UploadIcon size={14} /> Browse files
          </label>
        </div>
      </div>



      {/* Garmin Link Parser */}
      <GarminLinkSection onActivityLogged={() => {
        qc.invalidateQueries({ queryKey: ["/api/activities"], exact: false });
        qc.invalidateQueries({ queryKey: ["/api/dashboard"], exact: false });
      }} />

      {/* Screenshot Import */}
      <ScreenshotImport />

      {/* Refresh — bottom center */}
      <div style={{ maxWidth: 680, margin: "16px auto 0", padding: "0 20px", display: "flex", justifyContent: "center" }}>
        <button
          className={`upload-refresh-btn-bottom${refreshing ? " upload-refresh-btn--spinning" : ""}`}
          onClick={handleRefresh}
          title="Refresh all data"
        >
          <RefreshCw size={13} />
          Refresh data
        </button>
      </div>

    </div>
  );
}
