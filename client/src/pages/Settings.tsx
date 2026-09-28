import {  useState, useEffect, useRef } from "react";
import { useHashLocation } from "wouter/use-hash-location";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  SiGarmin, SiStrava, SiApple, SiGoogle,
} from "react-icons/si";
import {
  Shield, Lock, Eye, EyeOff, Loader2, Play, Download,
  CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronUp, ChevronRight,
  Trash2, Wifi, WifiOff, User, Sliders, Link2,
  Sun, Moon, Ruler, Scale, Bell, BellOff, Info,
  CalendarDays, LogOut, TrendingUp, RefreshCw, Activity, FileText
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface GarminCredStatus { saved: boolean; email?: string; }
interface GarminSyncState {
  status: "idle" | "running" | "success" | "error";
  log: string[];
  downloaded: number;
  imported: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

const API_BASE = "";

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────
const SETTINGS_CSS = `
/* ── Shell ── */
.sett-page {
  min-height: 100vh;
  background: var(--color-bg);
  padding: 0 0 120px;
}
.sett-hero {
  padding: 32px 20px 0;
  max-width: 600px;
  margin: 0 auto;
}
.sett-eyebrow {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-primary);
  margin-bottom: 4px;
}
.sett-title {
  font-size: 26px;
  font-weight: 800;
  color: var(--color-text);
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin-bottom: 20px;
}

/* ── Tab strip ── */
.sett-tabs {
  display: flex;
  gap: 4px;
  background: var(--color-surface, rgba(0,0,0,0.04));
  border-radius: 14px;
  padding: 4px;
  max-width: 600px;
  margin: 0 auto 28px;
}
.sett-tab {
  flex: 1;
  padding: 9px 6px;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  transition: all 180ms ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  line-height: 1;
}
.sett-tab svg { opacity: 0.7; }
.sett-tab--active {
  background: var(--color-card, #fff);
  color: var(--color-primary);
  box-shadow: 0 1px 4px rgba(0,0,0,0.10);
}
.sett-tab--active svg { opacity: 1; }

/* ── Content area ── */
.sett-content {
  max-width: 600px;
  margin: 0 auto;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Cards ── */
.sett-card {
  background: var(--color-card, #fff);
  border: 1px solid var(--color-border, rgba(0,0,0,0.08));
  border-radius: 18px;
  overflow: hidden;
}
.sett-card-header {
  padding: 16px 18px 14px;
  border-bottom: 1px solid var(--color-border, rgba(0,0,0,0.06));
  display: flex;
  align-items: center;
  gap: 10px;
}
.sett-card-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sett-card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.2;
}
.sett-card-sub {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
  line-height: 1.4;
}
.sett-card-body {
  padding: 16px 18px;
}

/* ── Integration list items ── */
.sett-integration-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border, rgba(0,0,0,0.06));
  cursor: pointer;
  transition: background 150ms;
}
.sett-integration-row:last-child { border-bottom: none; }

/* ── Simple chevron link row (Legal section, etc.) ── */
.sett-link-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 0;
  border-bottom: 1px solid var(--color-border, rgba(0,0,0,0.06));
  cursor: pointer;
  background: none;
  border-left: none;
  border-right: none;
  border-top: none;
  width: 100%;
  text-align: left;
  font-family: inherit;
}
.sett-link-row:last-of-type { border-bottom: none; }
.sett-link-row-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: rgba(0,0,0,0.045);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--color-text-muted);
}
.sett-link-row-label {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}
.sett-link-row-chevron {
  color: var(--color-text-faint, var(--color-text-muted));
  flex-shrink: 0;
}
.sett-version-tag {
  text-align: center;
  font-size: 10.5px;
  color: var(--color-text-faint, var(--color-text-muted));
  padding-top: 10px;
  letter-spacing: 0.03em;
}
.sett-integration-logo {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sett-integration-info { flex: 1; min-width: 0; }
.sett-integration-name { font-size: 13px; font-weight: 700; color: var(--color-text); }
.sett-integration-tagline { font-size: 11px; color: var(--color-text-muted); margin-top: 1px; }
.sett-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 20px;
  flex-shrink: 0;
}
.sett-badge--connected { background: rgba(16,185,129,0.12); color: #059669; }
.sett-badge--disconnected { background: rgba(0,0,0,0.06); color: var(--color-text-muted); }
.sett-badge--soon { background: rgba(245,158,11,0.12); color: #d97706; }

/* ── Expandable panel ── */
.sett-expand-panel {
  border-top: 1px solid var(--color-border, rgba(0,0,0,0.06));
  background: var(--color-bg);
  padding: 16px 18px;
  animation: sett-slide-in 200ms ease;
}
@keyframes sett-slide-in {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Security bar ── */
.sett-security-bar {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  background: rgba(6,95,70,0.06);
  border: 1px solid rgba(6,95,70,0.15);
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 14px;
}
.sett-security-text { font-size: 11px; color: var(--color-text-muted); line-height: 1.5; }
.sett-security-text strong { color: var(--color-text); display: block; margin-bottom: 2px; font-size: 12px; }

/* ── Credential form ── */
.sett-cred-saved {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--color-card, #fff);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 12px;
}
.sett-cred-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #10b981; flex-shrink: 0;
}
.sett-cred-email { font-size: 13px; font-weight: 600; color: var(--color-text); }
.sett-cred-sub { font-size: 11px; color: var(--color-text-muted); margin-top: 1px; }
.sett-cred-edit { margin-left: auto; font-size: 12px; font-weight: 600; color: var(--color-primary); background: none; border: none; cursor: pointer; padding: 4px 8px; }

.sett-input-group { margin-bottom: 10px; }
.sett-input-label { font-size: 11px; font-weight: 600; color: var(--color-text-muted); margin-bottom: 5px; display: block; text-transform: uppercase; letter-spacing: 0.06em; }
.sett-input-wrap { position: relative; }
.sett-input {
  width: 100%; box-sizing: border-box;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  font-size: 14px;
  background: var(--color-bg);
  color: var(--color-text);
  outline: none;
  transition: border-color 150ms;
}
.sett-input:focus { border-color: var(--color-primary); }
.sett-input-eye {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer;
  color: var(--color-text-muted); padding: 4px;
  display: flex; align-items: center;
}

.sett-btn-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.sett-btn-primary {
  padding: 9px 18px; border-radius: 10px; border: none;
  background: var(--color-primary); color: #fff;
  font-size: 13px; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 6px;
  transition: opacity 150ms;
}
.sett-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
.sett-btn-ghost {
  padding: 9px 14px; border-radius: 10px;
  border: 1px solid var(--color-border); background: none;
  font-size: 13px; font-weight: 600; cursor: pointer;
  color: var(--color-text-muted);
  display: flex; align-items: center; gap: 5px;
  transition: opacity 150ms;
}
.sett-btn-danger {
  padding: 9px 14px; border-radius: 10px; border: none;
  background: rgba(239,68,68,0.08); color: #dc2626;
  font-size: 13px; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; gap: 5px;
}

/* ── Sync block ── */
.sett-sync-row {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 12px;
}
.sett-sync-info { flex: 1; }
.sett-sync-info-title { font-size: 13px; font-weight: 700; color: var(--color-text); }
.sett-sync-info-sub { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; line-height: 1.5; }
.sett-sync-btn {
  padding: 9px 16px; border-radius: 10px; border: none;
  background: linear-gradient(135deg, #003A8C, #00A3FF);
  color: #fff; font-size: 13px; font-weight: 700;
  cursor: pointer; display: flex; align-items: center; gap: 6px;
  flex-shrink: 0; transition: opacity 150ms; white-space: nowrap;
}
.sett-sync-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.sett-sync-stats {
  display: flex; gap: 12px; flex-wrap: wrap;
  background: var(--color-bg); border-radius: 10px;
  padding: 10px 14px; margin-bottom: 12px;
}
.sett-sync-stat { display: flex; flex-direction: column; gap: 2px; }
.sett-sync-stat-label { font-size: 10px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
.sett-sync-stat-value { font-size: 18px; font-weight: 800; color: var(--color-text); }
.sett-sync-stat-value--green { color: #10b981; }
.sett-sync-stat-value--amber { color: var(--color-ember); }

/* ── Terminal ── */
.sett-terminal {
  background: #0d1117; border-radius: 12px; overflow: hidden;
  margin-top: 10px;
}
.sett-terminal-header {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; background: #161b22;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.sett-terminal-dots { display: flex; gap: 5px; }
.sett-terminal-dot { width: 9px; height: 9px; border-radius: 50%; }
.sett-terminal-title { flex: 1; text-align: center; font-size: 11px; color: rgba(255,255,255,0.4); font-family: monospace; }
.sett-terminal-collapse { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.4); display: flex; align-items: center; }
.sett-terminal-body { padding: 10px 14px; max-height: 180px; overflow-y: auto; font-family: monospace; font-size: 11px; line-height: 1.8; }
.sett-log-prompt { color: #10b981; margin-right: 6px; }
.sett-log--new { color: #e6edf3; }
.sett-log--ok { color: #10b981; }
.sett-log--err { color: #f85149; }
.sett-log--dim { color: rgba(255,255,255,0.3); }

/* ── MFA warning ── */
.sett-mfa-alert {
  display: flex; gap: 10px; align-items: flex-start;
  background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
  border-radius: 12px; padding: 12px 14px; margin-top: 10px;
}
.sett-mfa-text { font-size: 11px; color: var(--color-text); line-height: 1.6; }
.sett-mfa-text strong { display: block; margin-bottom: 3px; font-size: 12px; }

/* ── Preferences rows ── */
.sett-pref-row {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border, rgba(0,0,0,0.06));
}
.sett-pref-row:last-child { border-bottom: none; }
.sett-pref-icon {
  width: 34px; height: 34px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(6,95,70,0.08); flex-shrink: 0;
}
.sett-pref-label { flex: 1; }
.sett-pref-title { font-size: 13px; font-weight: 600; color: var(--color-text); }
.sett-pref-sub { font-size: 11px; color: var(--color-text-muted); margin-top: 1px; }

/* Toggle switch */
.sett-toggle {
  position: relative; width: 42px; height: 24px; flex-shrink: 0;
}
.sett-toggle input { opacity: 0; width: 0; height: 0; }
.sett-toggle-track {
  position: absolute; inset: 0; border-radius: 12px;
  cursor: pointer; transition: background 200ms;
  background: rgba(0,0,0,0.15);
}
.sett-toggle input:checked + .sett-toggle-track { background: var(--color-primary); }
.sett-toggle-track::after {
  content: ""; position: absolute;
  width: 18px; height: 18px; border-radius: 50%;
  background: #fff; top: 3px; left: 3px;
  transition: transform 200ms; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.sett-toggle input:checked + .sett-toggle-track::after { transform: translateX(18px); }

/* Pill selector */
.sett-pill-group { display: flex; gap: 4px; }
.sett-pill {
  padding: 5px 12px; border-radius: 20px; border: 1px solid var(--color-border);
  background: none; font-size: 12px; font-weight: 600;
  color: var(--color-text-muted); cursor: pointer; transition: all 150ms;
}
.sett-pill--active {
  background: var(--color-primary); color: #fff; border-color: var(--color-primary);
}

/* ── Profile ── */
.sett-avatar-row {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border);
}
.sett-avatar {
  width: 52px; height: 52px; border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary), var(--color-ember));
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 800; color: #fff; flex-shrink: 0;
}
.sett-profile-name { font-size: 16px; font-weight: 700; color: var(--color-text); }
.sett-profile-email { font-size: 12px; color: var(--color-text-muted); margin-top: 2px; }
.sett-profile-sprint {
  font-size: 11px; color: var(--color-primary);
  font-weight: 600; margin-top: 3px;
}

.sett-meta-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 10px; margin-top: 14px;
}
.sett-meta-cell {
  background: var(--color-bg); border-radius: 12px;
  padding: 12px 14px;
}
.sett-meta-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-text-muted); margin-bottom: 4px; }
.sett-meta-value { font-size: 18px; font-weight: 800; color: var(--color-text); }
.sett-meta-value--green { color: var(--color-primary); }

/* ── Section label ── */
.sett-section-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.10em; color: var(--color-text-muted);
  padding: 0 2px; margin-bottom: -4px;
}

/* ── Coming soon overlay ── */
.sett-coming-soon {
  font-size: 11px; font-weight: 600;
  color: var(--color-text-muted); padding: 16px 18px;
  text-align: center; background: var(--color-bg);
  border-top: 1px solid var(--color-border);
}

/* ── Dark mode overrides ── */
[data-theme="dark"] .sett-card { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.09); }
[data-theme="dark"] .sett-tabs { background: rgba(255,255,255,0.06); }
[data-theme="dark"] .sett-tab--active { background: rgba(255,255,255,0.10); }
[data-theme="dark"] .sett-input { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.12); }
[data-theme="dark"] .sett-expand-panel { background: rgba(0,0,0,0.2); }
[data-theme="dark"] .sett-meta-cell { background: rgba(255,255,255,0.04); }
[data-theme="dark"] .sett-cred-saved { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.10); }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Garmin Sync Panel (lifted from Upload.tsx)
// ─────────────────────────────────────────────────────────────────────────────
function GarminSyncPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: credStatus, refetch: refetchCreds } = useQuery<GarminCredStatus>({
    queryKey: ["/api/garmin/credentials"],
    refetchOnWindowFocus: false,
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [editingCreds, setEditingCreds] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);

  const [syncState, setSyncState] = useState<GarminSyncState>({
    status: "idle", log: [], downloaded: 0, imported: 0,
    startedAt: null, finishedAt: null, error: null,
  });
  const [terminalCollapsed, setTerminalCollapsed] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [syncing, setSyncing] = useState(false);

  const isMfa = syncState.error?.startsWith("MFA_REQUIRED");

  useEffect(() => {
    if (terminalRef.current && !terminalCollapsed) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [syncState.log, terminalCollapsed]);

  useEffect(() => {
    fetch(`${API_BASE}/api/garmin/sync/status`)
      .then(r => r.json()).then(setSyncState).catch(() => {});
  }, []);

  const saveCreds = async () => {
    if (!email.trim() || !password.trim()) {
      toast({ title: "Both fields required", variant: "destructive" });
      return;
    }
    setSavingCreds(true);
    try {
      const res = await fetch(`${API_BASE}/api/garmin/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) throw new Error(await res.text());
      await refetchCreds();
      setEditingCreds(false);
      setPassword("");
      toast({ title: "Garmin credentials saved", description: "Session memory only. Never written to disk." });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    } finally {
      setSavingCreds(false);
    }
  };

  const clearCreds = async () => {
    await fetch(`${API_BASE}/api/garmin/credentials`, { method: "DELETE" });
    await refetchCreds();
    setEmail(""); setPassword(""); setEditingCreds(false);
    toast({ title: "Credentials cleared" });
  };

  const startSync = async () => {
    setSyncing(true);
    setSyncState(s => ({ ...s, status: "running", log: [], downloaded: 0, imported: 0, error: null }));
    setTerminalCollapsed(false);
    try {
      const res = await fetch(`${API_BASE}/api/garmin/sync`, { credentials: "include",
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) { const t = await res.json(); throw new Error(t.error || "Sync failed"); }

      const evtSource = new EventSource(`${API_BASE}/api/garmin/sync/stream`);
      evtSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.state) setSyncState({ ...payload.state });
          if (payload.type === "complete") {
            evtSource.close(); setSyncing(false);
            qc.invalidateQueries();
            if (payload.state.status === "success") {
              toast({
                title: `${payload.state.imported} activit${payload.state.imported === 1 ? "y" : "ies"} imported`,
                description: "All Garmin sessions are now in KEWT.",
              });
            }
          }
        } catch {}
      };
      evtSource.onerror = () => { evtSource.close(); setSyncing(false); };
    } catch (err: any) {
      setSyncing(false);
      setSyncState(s => ({ ...s, status: "error", error: err.message }));
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    }
  };

  const hasCreds = credStatus?.saved;
  const showForm = !hasCreds || editingCreds;

  function logLineClass(line: string) {
    if (line.startsWith("Error") || line.includes("failed") || line.includes("error")) return "sett-log--err";
    if (line.includes("Imported:") || line.includes("successful") || line.includes("complete")) return "sett-log--ok";
    if (line.startsWith("Launching") || line.startsWith("Navigating")) return "sett-log--dim";
    return "sett-log--new";
  }

  return (
    <div>
      {/* Security notice */}
      <div className="sett-security-bar">
        <Shield size={16} color="#065f46" style={{ flexShrink: 0, marginTop: 1 }} />
        <div className="sett-security-text">
          <strong>Session-memory only</strong>
          Credentials are stored in server RAM for this session only. Never written to disk or sent anywhere except sso.garmin.com.
        </div>
      </div>

      {/* Credential display or form */}
      {hasCreds && !editingCreds ? (
        <div className="sett-cred-saved">
          <div className="sett-cred-dot" />
          <div style={{ flex: 1 }}>
            <div className="sett-cred-email">{credStatus?.email}</div>
            <div className="sett-cred-sub">Active this session</div>
          </div>
          <button className="sett-cred-edit" onClick={() => setEditingCreds(true)}>Edit</button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
            <Lock size={13} /> {editingCreds ? "Update credentials" : "Enter your Garmin Connect credentials"}
          </div>
          <div className="sett-input-group">
            <label className="sett-input-label">Email or Username</label>
            <input className="sett-input" type="email" placeholder="you@email.com"
              value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
          </div>
          <div className="sett-input-group">
            <label className="sett-input-label">Password</label>
            <div className="sett-input-wrap">
              <input className="sett-input" type={showPass ? "text" : "password"}
                placeholder="Your Garmin password" value={password}
                onChange={e => setPassword(e.target.value)} autoComplete="current-password"
                style={{ paddingRight: 38 }}
                onKeyDown={e => e.key === "Enter" && saveCreds()} />
              <button className="sett-input-eye" onClick={() => setShowPass(p => !p)} type="button" tabIndex={-1}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className="sett-btn-row">
            <button className="sett-btn-primary" onClick={saveCreds} disabled={savingCreds || !email.trim() || !password.trim()}>
              {savingCreds ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Shield size={14} /> Save credentials</>}
            </button>
            {editingCreds && (
              <button className="sett-btn-ghost" onClick={() => setEditingCreds(false)}>Cancel</button>
            )}
            {hasCreds && (
              <button className="sett-btn-danger" onClick={clearCreds}>
                <Trash2 size={13} /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sync trigger */}
      {hasCreds && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--color-border, rgba(0,0,0,0.07))" }}>
          <div className="sett-sync-row">
            <div className="sett-sync-info">
              <div className="sett-sync-info-title">Sync Latest Activities</div>
              <div className="sett-sync-info-sub">Downloads your 10 most recent FIT files and imports directly into <em className="ki">KEWT</em>.</div>
            </div>
            <button className="sett-sync-btn" onClick={startSync}
              disabled={syncing || syncState.status === "running"}>
              {syncing || syncState.status === "running"
                ? <><Loader2 size={14} className="animate-spin" /> Syncing...</>
                : <><Play size={13} /> Sync Now</>}
            </button>
          </div>

          {(syncState.status === "success" || syncState.status === "error") && (
            <div className="sett-sync-stats">
              <div className="sett-sync-stat">
                <span className="sett-sync-stat-label"><Download size={9} style={{ display: "inline", marginRight: 3 }} />Downloaded</span>
                <span className="sett-sync-stat-value sett-sync-stat-value--amber">{syncState.downloaded}</span>
              </div>
              <div className="sett-sync-stat">
                <span className="sett-sync-stat-label"><CheckCircle2 size={9} style={{ display: "inline", marginRight: 3 }} />Imported</span>
                <span className="sett-sync-stat-value sett-sync-stat-value--green">{syncState.imported}</span>
              </div>
              <div className="sett-sync-stat">
                <span className="sett-sync-stat-label"><Clock size={9} style={{ display: "inline", marginRight: 3 }} />Status</span>
                <span className={`sett-sync-stat-value ${syncState.status === "success" ? "sett-sync-stat-value--green" : ""}`}
                  style={syncState.status === "error" ? { color: "#ef4444", fontSize: 14 } : { fontSize: 16 }}>
                  {syncState.status === "success" ? "Done" : "Error"}
                </span>
              </div>
            </div>
          )}

          {isMfa && (
            <div className="sett-mfa-alert">
              <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
              <div className="sett-mfa-text">
                <strong>Two-Factor Authentication Detected</strong>
                Browser automation cannot pass MFA prompts. Temporarily disable two-step verification in Garmin Account Settings to use auto-sync, then re-enable it. Alternatively, use manual file upload on the Upload page.
              </div>
            </div>
          )}

          {(syncState.log.length > 0 || syncState.status === "running") && (
            <div className="sett-terminal">
              <div className="sett-terminal-header">
                <div className="sett-terminal-dots">
                  <div className="sett-terminal-dot" style={{ background: syncState.status === "error" ? "#f85149" : syncState.status === "success" ? "#10b981" : syncState.status === "running" ? "#f59e0b" : "#374151" }} />
                  <div className="sett-terminal-dot" style={{ background: "#374151" }} />
                  <div className="sett-terminal-dot" style={{ background: "#374151" }} />
                </div>
                <span className="sett-terminal-title">garmin-sync - kewt</span>
                <button className="sett-terminal-collapse" onClick={() => setTerminalCollapsed(p => !p)}>
                  {terminalCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                </button>
              </div>
              {!terminalCollapsed && (
                <div className="sett-terminal-body" ref={terminalRef}>
                  {syncState.log.map((line, i) => (
                    <div key={i} className={logLineClass(line)}>
                      <span className="sett-log-prompt">$</span>{line}
                    </div>
                  ))}
                  {syncState.status === "running" && (
                    <div className="sett-log--dim"><span className="sett-log-prompt">$</span><span className="animate-pulse">_</span></div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Strava Settings Panel
// ─────────────────────────────────────────────────────────────────────────────
function StravaSettingsPanel({ onStatusChange }: { onStatusChange?: (connected: boolean) => void }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected">("loading");
  const [meta, setMeta] = useState<{ totalSynced?: number; lastSync?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncResult, setSyncResult] = useState<{ syncedCount: number; totalCount: number } | null>(null);

  useEffect(() => {
    fetch("/api/strava/status", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        const connected = !!data.connected;
        setStatus(connected ? "connected" : "disconnected");
        if (connected) {
          setMeta({ totalSynced: data.totalSynced, lastSync: data.lastSync });
          if ((data.totalSynced ?? 0) > 0) {
            setSyncResult({ syncedCount: data.lastSyncCount ?? 0, totalCount: data.totalSynced });
          }
        }
        onStatusChange?.(connected);
      })
      .catch(() => { setStatus("disconnected"); onStatusChange?.(false); });
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/strava/sync-oauth", { method: "POST", credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Sync failed" }));
        throw new Error(err.error || "Sync failed");
      }
      const data = await res.json();
      const syncedCount = data.synced ?? 0;
      const totalCount = data.total ?? meta?.totalSynced ?? 0;
      setSyncResult({ syncedCount, totalCount });
      setMeta(m => m ? { ...m, totalSynced: totalCount, lastSync: new Date().toISOString() } : m);
      toast({ title: "Strava synced", description: `${syncedCount} new ${syncedCount === 1 ? "activity" : "activities"} · ${totalCount} total on file` });
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/strava/disconnect", { method: "DELETE", credentials: "include" });
      setStatus("disconnected");
      setMeta(null);
      setSyncResult(null);
      onStatusChange?.(false);
      toast({ title: "Strava disconnected" });
    } catch {
      toast({ title: "Could not disconnect", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  if (status === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 12, color: "var(--color-text-muted)" }}>
        <Loader2 size={13} className="animate-spin" /> Checking connection...
      </div>
    );
  }

  if (status === "disconnected") {
    return (
      <div>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
          Connect Strava to sync your rides, runs, and activities directly into KEWT via OAuth 2.0.
        </div>
        <a
          href="/api/strava/connect"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 18px", borderRadius: 10,
            background: "#FC4C02", color: "#fff",
            fontSize: 13, fontWeight: 700, textDecoration: "none",
          }}
        >
          <Link2 size={14} /> Connect with Strava
        </a>
      </div>
    );
  }

  // Connected state
  return (
    <div>
      {/* Stats row */}
      {meta && (
        <div className="sett-sync-stats" style={{ marginBottom: 12 }}>
          {meta.totalSynced != null && (
            <div className="sett-sync-stat">
              <span className="sett-sync-stat-label">
                <Activity size={9} style={{ display: "inline", marginRight: 3 }} />Activities
              </span>
              <span className="sett-sync-stat-value sett-sync-stat-value--green">{meta.totalSynced}</span>
            </div>
          )}
          {meta.lastSync && (
            <div className="sett-sync-stat">
              <span className="sett-sync-stat-label">
                <Clock size={9} style={{ display: "inline", marginRight: 3 }} />Last Sync
              </span>
              <span className="sett-sync-stat-value" style={{ fontSize: 13 }}>
                {new Date(meta.lastSync).toLocaleDateString("en-US", {
                  month: "short", day: "numeric",
                  hour: "numeric", minute: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Last sync result */}
      {syncResult && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", marginBottom: 12,
          background: "rgba(22,163,74,0.07)",
          border: "1px solid rgba(22,163,74,0.2)",
          borderRadius: 10, fontSize: 12, color: "#15803d",
        }}>
          <CheckCircle2 size={13} />
          {syncResult.syncedCount} new {syncResult.syncedCount === 1 ? "activity" : "activities"} synced
          {syncResult.totalCount > 0 && ` · ${syncResult.totalCount} total on file`}
        </div>
      )}

      {/* Action buttons */}
      <div className="sett-btn-row">
        <button
          className="sett-btn-primary"
          onClick={handleSync}
          disabled={syncing}
          style={{ background: "#FC4C02" }}
        >
          {syncing
            ? <><Loader2 size={14} className="animate-spin" /> Syncing...</>
            : <><RefreshCw size={14} /> Sync Now</>}
        </button>
        <button
          className="sett-btn-danger"
          onClick={handleDisconnect}
          disabled={disconnecting}
        >
          <Trash2 size={13} /> {disconnecting ? "Disconnecting..." : "Disconnect"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Connections Tab
// ─────────────────────────────────────────────────────────────────────────────
const INTEGRATIONS = [
  {
    id: "strava",
    name: "Strava",
    tagline: "Rides, runs, and activities via OAuth",
    color: "#FC4C02",
    gradient: "linear-gradient(135deg, #B03A00 0%, #FC4C02 100%)",
    icon: <SiStrava size={20} color="#fff" />,
    status: "connected" as const,
    panel: "strava_oauth",
  },
  {
    id: "garmin",
    name: "Garmin Connect",
    tagline: "Activities, HR, HRV, sleep, Body Battery",
    color: "#00A3FF",
    gradient: "linear-gradient(135deg, #003A8C 0%, #00A3FF 100%)",
    icon: <SiGarmin size={20} color="#fff" />,
    status: "coming_soon" as const,
    panel: "garmin_sync",
  },
  {
    id: "apple",
    name: "Apple Health",
    tagline: "Weight, steps, workouts, HR",
    color: "#FF2D55",
    gradient: "linear-gradient(135deg, #C0003E 0%, #FF2D55 100%)",
    icon: <SiApple size={18} color="#fff" />,
    status: "coming_soon" as const,
    panel: null,
  },
  {
    id: "google_health",
    name: "Google Health Connect",
    tagline: "Includes Fitbit — acquired by Google 2021",
    color: "#4285F4",
    gradient: "linear-gradient(135deg, #1557BF 0%, #4285F4 100%)",
    icon: <SiGoogle size={18} color="#fff" />,
    status: "coming_soon" as const,
    panel: null,
  },
];

function ConnectionsTab() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [stravaConnected, setStravaConnected] = useState<boolean | null>(null);

  const toggle = (id: string) => {
    setExpanded(prev => prev === id ? null : id);
  };

  const badgeLabel = (intg: typeof INTEGRATIONS[0]) => {
    if (intg.id === "strava") {
      if (stravaConnected === null) return "...";
      return stravaConnected ? "Active" : "Connect";
    }
    if (intg.status === "connected") return "Active";
    if (intg.status === "coming_soon") return "Soon";
    return "Off";
  };

  const badgeClass = (intg: typeof INTEGRATIONS[0]) => {
    if (intg.id === "strava") {
      if (stravaConnected) return "sett-badge sett-badge--connected";
      return "sett-badge sett-badge--disconnected";
    }
    if (intg.status === "connected") return "sett-badge sett-badge--connected";
    if (intg.status === "coming_soon") return "sett-badge sett-badge--soon";
    return "sett-badge sett-badge--disconnected";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="sett-card">
        <div className="sett-card-body" style={{ padding: "8px 18px" }}>
          {INTEGRATIONS.map((intg) => (
            <div key={intg.id}>
              <div
                className="sett-integration-row"
                onClick={() => intg.panel && toggle(intg.id)}
                style={{ cursor: intg.panel ? "pointer" : "default" }}
              >
                <div className="sett-integration-logo" style={{ background: intg.gradient }}>
                  {intg.icon}
                </div>
                <div className="sett-integration-info">
                  <div className="sett-integration-name">{intg.name}</div>
                  <div className="sett-integration-tagline">{intg.tagline}</div>
                </div>
                <span className={badgeClass(intg)}>{badgeLabel(intg)}</span>
                {intg.panel && (
                  <div style={{ color: "var(--color-text-muted)", marginLeft: 2 }}>
                    {expanded === intg.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                )}
              </div>

              {/* Expanded panels */}
              {expanded === intg.id && intg.panel === "garmin_sync" && (
                <div className="sett-expand-panel">
                  <GarminSyncPanel />
                </div>
              )}
              {expanded === intg.id && intg.panel === "strava_oauth" && (
                <div className="sett-expand-panel">
                  <StravaSettingsPanel onStatusChange={setStravaConnected} />
                </div>
              )}
              {expanded === intg.id && intg.panel === null && (
                <div className="sett-coming-soon">Coming soon</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preferences Tab
// ─────────────────────────────────────────────────────────────────────────────
function PreferencesTab() {
  const [units, setUnits] = useState<"imperial" | "metric">(() => {
    try { return (localStorage.getItem("kewt-units") as any) || "imperial"; } catch { return "imperial"; }
  });
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("resonance-theme") === "dark"; } catch { return false; }
  });
  const [notifications, setNotifications] = useState(() => {
    try { return localStorage.getItem("kewt-notifs") !== "off"; } catch { return true; }
  });
  const [weekStart, setWeekStart] = useState<"monday" | "sunday">("monday");
  const [arcModality, setArcModality] = useState("running");
  const [arcWindow, setArcWindow]     = useState(56);

  // Load week start + arc preferences from server
  useEffect(() => {
    apiRequest("GET", "/api/settings/week-start").then((d: any) => {
      if (d.weekStart) setWeekStart(d.weekStart);
    }).catch(() => {});
    apiRequest("GET", "/api/onboarding/profile").then((d: any) => {
      if (d.profile?.arcModality) setArcModality(d.profile.arcModality);
      if (d.profile?.arcWindow)   setArcWindow(d.profile.arcWindow);
    }).catch(() => {});
  }, []);

  const ARC_SPORTS = [
    { value: "running",    label: "Running" },
    { value: "walking",    label: "Walking" },
    { value: "cycling",    label: "Cycling" },
    { value: "hiking",     label: "Hiking" },
    { value: "swimming",   label: "Swimming" },
    { value: "rucking",    label: "Rucking" },
    { value: "strength",   label: "Strength" },
    { value: "yoga",       label: "Yoga" },
    { value: "other",      label: "Other" },
  ];
  const ARC_WINDOWS = [
    { value: 28, label: "4 wks" },
    { value: 56, label: "8 wks" },
    { value: 84, label: "12 wks" },
  ];
  const setArcModalityVal = (val: string) => {
    setArcModality(val);
    apiRequest("PATCH", "/api/settings/arc", { arcModality: val }).catch(() => {});
  };
  const setArcWindowVal = (val: number) => {
    setArcWindow(val);
    apiRequest("PATCH", "/api/settings/arc", { arcWindow: val }).catch(() => {});
  };

  const setWeekStartVal = (val: "monday" | "sunday") => {
    setWeekStart(val);
    apiRequest("PATCH", "/api/settings/week-start", { weekStart: val }).catch(() => {});
  };

  const setUnitsVal = (val: "imperial" | "metric") => {
    setUnits(val);
    try { localStorage.setItem("kewt-units", val); } catch {}
  };
  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try { localStorage.setItem("resonance-theme", next ? "dark" : "light"); } catch {}
  };
  const toggleNotifs = () => {
    const next = !notifications;
    setNotifications(next);
    try { localStorage.setItem("kewt-notifs", next ? "on" : "off"); } catch {}
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="sett-card">
        <div className="sett-card-header">
          <div className="sett-card-icon" style={{ background: "rgba(6,95,70,0.10)" }}>
            <Sliders size={17} color="var(--color-primary)" />
          </div>
          <div>
            <div className="sett-card-title">Display</div>
            <div className="sett-card-sub">Appearance and units</div>
          </div>
        </div>
        <div className="sett-card-body" style={{ padding: "4px 18px" }}>

          {/* Dark Mode row removed: KEWT is dark-theme-first. Light theme
              is preserved only as an Easter egg behind three quick taps
              on the Dash bottom-nav tab. */}

          {/* Units */}
          <div className="sett-pref-row">
            <div className="sett-pref-icon">
              <Ruler size={16} color="var(--color-primary)" />
            </div>
            <div className="sett-pref-label">
              <div className="sett-pref-title">Units</div>
              <div className="sett-pref-sub">Distance and weight</div>
            </div>
            <div className="sett-pill-group">
              <button className={`sett-pill${units === "imperial" ? " sett-pill--active" : ""}`} onClick={() => setUnitsVal("imperial")}>mi / lbs</button>
              <button className={`sett-pill${units === "metric" ? " sett-pill--active" : ""}`} onClick={() => setUnitsVal("metric")}>km / kg</button>
            </div>
          </div>

          {/* Week Start */}
          <div className="sett-pref-row">
            <div className="sett-pref-icon">
              <CalendarDays size={16} color="var(--color-primary)" />
            </div>
            <div className="sett-pref-label">
              <div className="sett-pref-title">Week Starts On</div>
              <div className="sett-pref-sub">{weekStart === "monday" ? "Monday (default)" : "Sunday"}</div>
            </div>
            <div className="sett-pill-group">
              <button className={`sett-pill${weekStart === "monday" ? " sett-pill--active" : ""}`} onClick={() => setWeekStartVal("monday")}>Mon</button>
              <button className={`sett-pill${weekStart === "sunday" ? " sett-pill--active" : ""}`} onClick={() => setWeekStartVal("sunday")}>Sun</button>
            </div>
          </div>

          {/* Kinetic Arc */}
          <div className="sett-pref-row" style={{ flexWrap: "wrap", gap: "10px 0" }}>
            <div className="sett-pref-icon">
              <TrendingUp size={16} color="var(--color-primary)" />
            </div>
            <div className="sett-pref-label">
              <div className="sett-pref-title">Kinetic Arc</div>
              <div className="sett-pref-sub">Primary sport tracked on Dashboard</div>
            </div>
            <div className="sett-pill-group" style={{ flexWrap: "wrap" }}>
              {ARC_SPORTS.map(s => (
                <button key={s.value} className={`sett-pill${arcModality === s.value ? " sett-pill--active" : ""}`} onClick={() => setArcModalityVal(s.value)}>{s.label}</button>
              ))}
            </div>
          </div>

          {/* Arc Window */}
          <div className="sett-pref-row">
            <div className="sett-pref-icon">
              <TrendingUp size={16} color="var(--color-ember)" style={{ opacity: 0.6 }} />
            </div>
            <div className="sett-pref-label">
              <div className="sett-pref-title">Arc History</div>
              <div className="sett-pref-sub">How far back the arc looks</div>
            </div>
            <div className="sett-pill-group">
              {ARC_WINDOWS.map(w => (
                <button key={w.value} className={`sett-pill${arcWindow === w.value ? " sett-pill--active" : ""}`} onClick={() => setArcWindowVal(w.value)}>{w.label}</button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="sett-pref-row">
            <div className="sett-pref-icon">
              {notifications ? <Bell size={16} color="var(--color-primary)" /> : <BellOff size={16} color="var(--color-primary)" />}
            </div>
            <div className="sett-pref-label">
              <div className="sett-pref-title">Notifications</div>
              <div className="sett-pref-sub">Sync updates and recovery alerts</div>
            </div>
            <label className="sett-toggle">
              <input type="checkbox" checked={notifications} onChange={toggleNotifs} />
              <span className="sett-toggle-track" />
            </label>
          </div>

        </div>
      </div>

      {/* Science ticker personalization hint */}
      <div className="sett-card">
        <div className="sett-card-header">
          <div className="sett-card-icon" style={{ background: "rgba(245,158,11,0.12)" }}>
            <Info size={17} color="var(--color-ember)" />
          </div>
          <div>
            <div className="sett-card-title">Science Feed</div>
            <div className="sett-card-sub">Topic personalization</div>
          </div>
        </div>
        <div className="sett-card-body">
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.7 }}>
            Personalized science headlines matched to your activity type and metrics are coming as part of <em className="ki">KEWT</em> Intelligence.
          </div>
          <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--color-ember)", background: "rgba(245,158,11,0.10)", padding: "4px 10px", borderRadius: 20 }}>
            Coming with KEWT Intelligence
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile Tab
// ─────────────────────────────────────────────────────────────────────────────
function ProfileTab() {
  const { logout, user } = useAuth();
  const [, navigate] = useHashLocation();
  const { data: activities } = useQuery<any[]>({ queryKey: ["/api/activities"] });
  const { data: goals } = useQuery<any[]>({ queryKey: ["/api/goals"] });
  const { data: profileData } = useQuery<any>({ queryKey: ["/api/onboarding/profile"] });
  const { data: latestMarker } = useQuery<any>({ queryKey: ["/api/health-markers/latest"] });

  const totalActivities = activities?.length ?? 0;
  const activeGoals = goals?.filter((g: any) => !g.completed)?.length ?? 0;
  const profile = profileData?.profile;

  // Derived display values — all sourced from authenticated user, never hardcoded
  const firstName  = profile?.firstName  ?? user?.firstName  ?? "";
  const lastName   = profile?.lastName   ?? "";
  const fullName   = [firstName, lastName].filter(Boolean).join(" ") || "Athlete";
  const avatarChar = firstName?.[0]?.toUpperCase() ?? "?";
  const email      = user?.email ?? "";
  const weightLbs  = profile?.weightLbs  ?? null;
  // Use latest weigh-in from health markers; fall back to onboarding weight
  const currentWeightLbs = latestMarker?.morningWeight ?? weightLbs;
  const trackingSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Apr 13, 2026";
  // Last active — most recent activity date from the already-loaded array
  const lastActive = activities && activities.length > 0
    ? new Date(activities[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="sett-card">
        <div className="sett-card-body">
          <div className="sett-avatar-row">
            <div className="sett-avatar">{avatarChar}</div>
            <div>
              <div className="sett-profile-name">{fullName}</div>
              <div className="sett-profile-email">{email}</div>
              <div className="sett-profile-sprint">Blue Ember Wellness</div>
            </div>
          </div>

          <div className="sett-meta-grid">
            <div className="sett-meta-cell">
              <div className="sett-meta-label">Tracking Since</div>
              <div className="sett-meta-value" style={{ fontSize: 14, fontWeight: 700 }}>{trackingSince}</div>
            </div>
            <div className="sett-meta-cell">
              <div className="sett-meta-label">Activities Logged</div>
              <div className="sett-meta-value sett-meta-value--green">{totalActivities}</div>
            </div>
            <div className="sett-meta-cell">
              <div className="sett-meta-label">Active Goals</div>
              <div className="sett-meta-value">{activeGoals}</div>
            </div>
            <div className="sett-meta-cell">
              <div className="sett-meta-label">Last Active</div>
              <div className="sett-meta-value" style={{ fontSize: 13, fontWeight: 700 }}>{lastActive}</div>
            </div>
          </div>

          <button
            onClick={logout}
            data-testid="button-signout-settings"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              marginTop: 8, padding: "9px 16px",
              borderRadius: 10, border: "1.5px solid var(--color-border)",
              background: "var(--color-surface)", color: "var(--color-text-muted)",
              fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%",
              justifyContent: "center", transition: "all 150ms ease"
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"; }}
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </div>

{(() => {
        const weightGoal = goals?.find((g: any) => g.type === "weight" && g.status === "active");
        if (!weightGoal && currentWeightLbs == null) return null;
        return (
          <div className="sett-card">
            <div className="sett-card-header">
              <div className="sett-card-icon" style={{ background: "rgba(6,95,70,0.10)" }}>
                <Scale size={17} color="var(--color-primary)" />
              </div>
              <div>
                <div className="sett-card-title">Weight Goal</div>
                <div className="sett-card-sub">Primary body composition target</div>
              </div>
            </div>
            <div className="sett-card-body">
              {weightGoal ? (
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>Start</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)" }}>{weightGoal.start_value} lbs</div>
                  </div>
                  <div style={{ fontSize: 18, color: "var(--color-text-muted)" }}>→</div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>Current</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)" }}>{weightGoal.current_value ?? currentWeightLbs ?? "—"} lbs</div>
                  </div>
                  <div style={{ fontSize: 18, color: "var(--color-text-muted)" }}>→</div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>Target</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-primary)" }}>{weightGoal.target_value} lbs</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>Current Weight</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)" }}>{currentWeightLbs} lbs</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* BEI expanded section */}
      <div style={{ borderRadius: 18, border: "1.5px solid hsl(214 80% 20% / 0.15)", overflow: "hidden", background: "hsl(214 80% 20% / 0.04)" }}>

        {/* Header row */}
        <div style={{ padding: "14px 16px 12px", background: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.25)" }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: "#fff", fontStyle: "italic", letterSpacing: "-0.02em" }}>BEI</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>Blue Ember Intelligence</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontStyle: "italic", marginTop: 1 }}>Breathe. Reset. Return.</div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#fef3c7", background: "rgba(245,158,11,0.25)", padding: "3px 9px", borderRadius: 20, border: "1px solid rgba(245,158,11,0.4)", flexShrink: 0 }}>
            KEWT Core
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Premise */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#0c4a6e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>The Premise</div>
            <div style={{ fontSize: 12, lineHeight: 1.65, color: "var(--color-text)" }}>
              Blue Ember Intelligence is the proprietary science layer that powers every contextual signal in KEWT. It is not a feature. It is the reasoning engine underneath all features: the system that interprets your HRV, your sleep depth, your scale, and your movement data not as isolated numbers, but as a conversation your body is having with itself.
            </div>
          </div>

          <div style={{ height: 1, background: "hsl(214 80% 20% / 0.1)" }} />

          {/* Genesis */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#0c4a6e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Genesis</div>
            <div style={{ fontSize: 12, lineHeight: 1.65, color: "var(--color-text)" }}>
              Blue Ember Wellness was founded on a single belief: the body communicates before it breaks down. Most wellness tools listen only after symptoms appear. BEI was built to listen earlier, reading the subtle shifts in nervous system tone, recovery quality, and physiological load that precede how you feel by hours or days.
            </div>
          </div>

          <div style={{ height: 1, background: "hsl(214 80% 20% / 0.1)" }} />

          {/* Three pillars */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#0c4a6e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>The Three Pillars It Serves</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {[
                { label: "Breathe", desc: "HRV is the fingerprint of your autonomic nervous system. BEI reads its daily variance to flag inflammation, stress load, and recovery quality before the scale or your mood tells you anything." },
                { label: "Posture", desc: "Body composition is not vanity data. It is a structural load story. BEI interprets weight shifts in context, separating water retention, inflammation, and true fat change so you never mistake one for another." },
                { label: "Return", desc: "Recovery is not passive. BEI tracks sleep depth trends, activity consistency, and the interplay between exertion and rest to surface the window when your body is genuinely ready to perform again." },
              ].map(({ label, desc }) => (
                <div key={label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 52, fontSize: 10, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg, #0c4a6e, #0369a1)", borderRadius: 8, padding: "3px 7px", textAlign: "center", marginTop: 1, flexShrink: 0 }}>{label}</div>
                  <div style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--color-text-muted)" }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: "hsl(214 80% 20% / 0.1)" }} />

          {/* What BEI powers in KEWT */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#0c4a6e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>What BEI Powers in KEWT</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                "Inflammation Signal: detects HRV drop + scale rise simultaneously and surfaces a contextual callout",
                "Sleep Trend: compares 7-day deep sleep averages and flags meaningful shifts",
                "Science Ticker: every educational entry is a BEI-authored interpretation of your physiology",
                "Recovery Context: walk streak, body battery, and weekly mileage read together, not in isolation",
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#f59e0b", marginTop: 5.5, flexShrink: 0 }} />
                  <div style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--color-text-muted)" }}>{item}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Closing statement */}
          <div style={{ padding: "10px 13px", background: "linear-gradient(135deg, rgba(12,74,110,0.07), rgba(245,158,11,0.06))", borderRadius: 12, borderLeft: "3px solid #f59e0b" }}>
            <div style={{ fontSize: 11.5, lineHeight: 1.65, color: "var(--color-text)", fontStyle: "italic" }}>
              "Your data is not a dashboard. It is a dialogue. Blue Ember Intelligence is here to translate."
            </div>
          </div>

        </div>
      </div>

      {/* Legal */}
      <div className="sett-card">
        <div className="sett-card-header">
          <div className="sett-card-icon" style={{ background: "rgba(0,0,0,0.05)" }}>
            <Shield size={17} color="var(--color-text-muted)" />
          </div>
          <div>
            <div className="sett-card-title">Legal</div>
            <div className="sett-card-sub">Privacy and terms of use</div>
          </div>
        </div>
        <div className="sett-card-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <button
            type="button"
            className="sett-link-row"
            onClick={() => navigate("/privacy")}
            data-testid="button-legal-privacy"
          >
            <div className="sett-link-row-icon"><Lock size={14} /></div>
            <div className="sett-link-row-label">Privacy Policy</div>
            <ChevronRight size={16} className="sett-link-row-chevron" />
          </button>
          <button
            type="button"
            className="sett-link-row"
            onClick={() => navigate("/terms")}
            data-testid="button-legal-terms"
          >
            <div className="sett-link-row-icon"><FileText size={14} /></div>
            <div className="sett-link-row-label">Terms of Service</div>
            <ChevronRight size={16} className="sett-link-row-chevron" />
          </button>
        </div>
      </div>
      <div className="sett-version-tag">KEWT v0.1.0 · Beta</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Settings Page
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [tab, setTab] = useState<"connections" | "preferences" | "profile">("connections");

  return (
    <>
      <style>{SETTINGS_CSS}</style>
      <div className="sett-page">
        {/* Cinematic Hero */}
        <div className="kewt-cin-hero" style={{ borderRadius: "0 0 24px 24px", marginBottom: 20 }}>
          <img
            src="/hero_settings.jpg"
            alt=""
            className="kewt-cin-hero__img"
            style={{ objectPosition: "center 45%" }}
          />
          <div className="kewt-cin-hero__overlay" style={{ "--cin-base": "rgb(10,26,15)" } as React.CSSProperties} />
          <div className="kewt-cin-hero__content">
            <div className="kewt-cin-hero__eyebrow" style={{ color: "#f59e0b" }}>KEWT · Configuration</div>
            <div className="kewt-cin-hero__title">Settings.</div>
            <div className="kewt-cin-hero__bar" style={{ background: "linear-gradient(90deg,#f59e0b,#10b981)" }} />
            <div className="kewt-cin-hero__sub">Calibrate your experience.</div>
          </div>
        </div>

        {/* Tab strip */}
        <div className="sett-tabs">
          <button className={`sett-tab${tab === "connections" ? " sett-tab--active" : ""}`} onClick={() => setTab("connections")}>
            <Link2 size={15} />
            Connections
          </button>
          <button className={`sett-tab${tab === "preferences" ? " sett-tab--active" : ""}`} onClick={() => setTab("preferences")}>
            <Sliders size={15} />
            Preferences
          </button>
          <button className={`sett-tab${tab === "profile" ? " sett-tab--active" : ""}`} onClick={() => setTab("profile")}>
            <User size={15} />
            Profile
          </button>
        </div>

        <div className="sett-content">
          {tab === "connections" && <ConnectionsTab />}
          {tab === "preferences" && <PreferencesTab />}
          {tab === "profile" && <ProfileTab />}
        </div>
      </div>
    </>
  );
}
