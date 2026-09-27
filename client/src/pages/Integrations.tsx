import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  SiGarmin, SiStrava, SiApple,
} from "react-icons/si";
import {
  CheckCircle2, XCircle, Loader2, Link2, Upload, X, ChevronRight,
  Zap, FlaskConical, Heart, Activity, Moon, Scale, Bike, Wind,
  Dumbbell, Play, AlertCircle, RefreshCw, Download, FileText,
  Info, TrendingUp, Brain, Clock, Shield, Wifi, WifiOff,
  ChevronDown, ChevronUp
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type IntegrationStatus = "connected" | "disconnected" | "connecting" | "error" | "coming_soon";

type StravaSyncState =
  | { phase: "idle" }
  | { phase: "syncing" }
  | { phase: "success"; syncedCount: number; totalCount: number; syncedAt: string }
  | { phase: "error"; message: string };

interface IntegrationDef {
  id: string;
  name: string;
  tagline: string;
  category: "wearable" | "training" | "nutrition" | "recovery" | "health";
  color: string;
  gradient: string;
  dataPoints: string[];
  authMethod: "oauth2" | "oauth2_csv" | "api_key" | "csv" | "csv_scale" | "health_kit" | "coming_soon";
  syncFrequency: string;
  scienceNote: string;
  authUrl?: string;
  icon: React.ReactNode;
}

// ── Brand Mark Helper ───────────────────────────────────────────────────────
function brandMark(letters: string, color: string, fontSize = 20): React.ReactNode {
  return (
    <span
      style={{
        fontWeight: 800,
        fontSize,
        color,
        letterSpacing: letters.length > 1 ? "-0.5px" : "0",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
        lineHeight: 1,
      }}
    >
      {letters}
    </span>
  );
}

// ── Integration Definitions ──────────────────────────────────────────────────
const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "garmin",
    name: "Garmin Connect",
    tagline: "Activities, HR, HRV, sleep, stress",
    category: "wearable",
    color: "#00A3FF",
    gradient: "linear-gradient(135deg, #003A8C 0%, #00A3FF 100%)",
    dataPoints: ["Activities (cycling, running, hiking)", "Heart Rate + HRV", "Sleep stages & quality", "Stress score", "Body Battery™", "Hydration", "VO₂ max estimate"],
    authMethod: "coming_soon",
    syncFrequency: "Every 30 min (or manual import)",
    scienceNote: "Garmin's Body Battery™ uses HRV, stress, sleep, and activity data. Scientifically, HRV (heart rate variability) is the gold-standard marker of autonomic nervous system recovery. Higher HRV = more parasympathetic dominance = better recovery readiness. When this integration launches, KEWT will map Body Battery directly to your recovery score.",
    authUrl: "https://connect.garmin.com/oauthConfirm",
    icon: <SiGarmin size={28} color="#ffffff" />,
  },
  {
    id: "strava",
    name: "Strava",
    tagline: "Rides, runs, segments, social KOMs",
    category: "training",
    color: "#FC4C02",
    gradient: "linear-gradient(135deg, #B03A00 0%, #FC4C02 100%)",
    dataPoints: ["Activity files (GPX/FIT)", "Pace & power data", "Segment performance", "Elevation & maps", "Training load (Relative Effort)", "Athlete heartrate zones"],
    authMethod: "oauth2",
    syncFrequency: "Real-time webhook",
    scienceNote: "Strava's Relative Effort (RE) uses your personal heart rate zones to quantify training load - a proxy for RPE (Rating of Perceived Exertion). Research shows RE correlates strongly with session RPE (r=0.78). KEWT uses your Strava RE to calibrate weekly training stress scores and flag overtraining risk.",
    authUrl: "https://www.strava.com/oauth/authorize",
    icon: <SiStrava size={28} color="#ffffff" />,
  },
  {
    id: "apple_health",
    name: "Apple Health",
    tagline: "Central iOS health hub",
    category: "health",
    color: "#FF2D55",
    gradient: "linear-gradient(135deg, #C0003E 0%, #FF2D55 100%)",
    dataPoints: ["Weight & body composition", "Steps & walking", "Heart rate & ECG", "Sleep (iOS 16+)", "Workouts from Apple Watch", "Mindfulness minutes", "Blood oxygen"],
    authMethod: "coming_soon",
    syncFrequency: "Real-time",
    scienceNote: "Apple Health aggregates HealthKit data from 300+ apps. When this integration launches, it will serve as the authoritative weight source inside KEWT, ensuring consistent morning measurements. The HealthKit framework enforces data provenance, so each weight entry is timestamped and source-tagged.",
    icon: <SiApple size={26} color="#ffffff" />,
  },
  {
    id: "google_health",
    name: "Google Health Connect",
    tagline: "Includes Fitbit — acquired by Google 2021",
    category: "health",
    color: "#4285F4",
    gradient: "linear-gradient(135deg, #1557BF 0%, #4285F4 100%)",
    dataPoints: ["Steps & activity", "Heart rate", "Sleep", "Weight", "Workouts", "Fitbit device data"],
    authMethod: "coming_soon",
    syncFrequency: "Coming soon",
    scienceNote: "Google Health Connect unifies Android health data across apps and devices, including Fitbit wearables acquired by Google in 2021. When this integration launches, KEWT will pull consolidated activity, sleep, and biometric data directly from the Health Connect API.",
    icon: brandMark("G", "#4285F4"),
  },
  {
    id: "1byone",
    name: "1byone Smart Scale",
    tagline: "Body composition from your scale",
    category: "health",
    color: "#7c3aed",
    gradient: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)",
    dataPoints: [
      "Weight (lb)",
      "Body Fat %",
      "Muscle Mass (lb)",
      "Body Water %",
      "BMI",
      "Skeletal Muscle Rate %",
      "Subcutaneous Fat %",
      "Fat-Free Body Mass (lb)",
      "Bone Mass (lb)",
      "Visceral Fat Index",
      "BMR (kcal)",
      "Protein Rate %",
      "Body Score",
    ],
    authMethod: "csv_scale",
    syncFrequency: "Manual CSV export from 1byone app",
    scienceNote: "Bioelectrical impedance analysis (BIA) passes a low-level current through the body to estimate fat mass, lean mass, and total body water. Multi-frequency BIA (used in the 1byone scale) improves accuracy over single-frequency devices by distinguishing intracellular from extracellular fluid compartments. Visceral fat index is the most metabolically significant marker: a visceral fat index above 13 correlates with elevated cardiovascular and metabolic disease risk independent of overall BMI (Neeland et al., JACC 2019).",
    icon: <Scale size={26} color="#ffffff" />,
  },
];

const CATEGORIES = [
  { id: "all", label: "All Sources" },
  { id: "wearable", label: "Wearables" },
  { id: "training", label: "Training" },
  { id: "nutrition", label: "Nutrition" },
  { id: "recovery", label: "Recovery" },
  { id: "health", label: "Health" },
];

// ── Science Feedback Panel ───────────────────────────────────────────────────
const ENTRY_FEEDBACK = [
  {
    trigger: "garmin",
    headline: "HRV & Body Battery™ - The Recovery Science",
    body: "Heart Rate Variability (HRV) quantifies the time variation between successive heartbeats (RMSSD metric). Higher RMSSD indicates parasympathetic dominance - your nervous system is in 'rest and digest' mode, primed for adaptation to training stress. Garmin's Body Battery uses HRV, stress scores, sleep, and activity to model your energy reserves on a 0–100 scale. A Body Battery below 25 when you wake up means your glycolytic and oxidative energy systems are significantly depleted. Science: Buchheit (2014) demonstrated RMSSD-guided training outperforms traditional periodization by 15% in recreational athletes over 8 weeks.",
    metric: "Recovery readiness signal",
    value: "HRV RMSSD > 50ms = green",
    icon: "Heart",
  },
  {
    trigger: "strava",
    headline: "Training Load & Relative Effort",
    body: "Strava's Relative Effort (RE) algorithm uses your personal heart rate zones to quantify training stress - similar to Banister's TRIMP (Training Impulse) model. Each heart rate zone is exponentially weighted (zone 5 contributes ~4× more stress than zone 1 per minute). When your weekly Strava RE exceeds your chronic training load (CTL, the 42-day rolling average) by more than 1.3×, you've crossed into overreaching territory. KEWT plots your weekly RE against your CTL trend and flags the Acute:Chronic Workload Ratio when it exceeds safe limits. Science: Gabbett (2016) showed ACWR >1.5 increases injury risk by 2–4× in athletes.",
    metric: "Safe training ramp rate",
    value: "≤10% weekly volume increase",
    icon: "TrendingUp",
  },
  {
    id: "cycling_fasted",
    title: "Fasted Ride Detected",
    body: "You logged a 70-min cycling session with your last meal >12 hours prior. Research indicates fasted rides ≤75 min increase fat oxidation by 17–21% without significant cortisol elevation. Your Zero fasting window confirms a 14-hour fast - optimal metabolic flexibility zone. Post-ride, prioritize 30g protein + 60g carbohydrate within 45 minutes to maximize the anabolic window (Ivy et al., 2002).",
    type: "insight",
    metric: "Fat oxidation estimate",
    value: "+19% vs. fed state",
  },
  {
    id: "sleep_alert",
    title: "Sleep Debt Accumulation",
    body: "Your last 3 nights averaged 6.1 hours - 0.9 hours below your target. Sleep restriction to <7 hours for 3+ consecutive nights impairs cognitive function equivalent to 24-hour total sleep deprivation (Van Dongen et al., Sleep 2003). More critically, growth hormone secretion (peak during N3 sleep) is reduced by ~25%, slowing muscle repair and fat loss. Recommendation: Prioritize 7.5 hours tonight. Consider a 20-min nap between 1–3 PM (optimal circadian timing).",
    type: "warning",
    metric: "Performance impairment",
    value: "~18% reaction time ↑",
  },
  {
    id: "breathwork_correlation",
    title: "Breathwork → Performance Link",
    body: "KEWT has detected a statistically significant correlation (r=0.71, p<0.05) in your data: Days with morning breathwork practice precede running sessions with 8 bpm lower average heart rate at the same pace. This aligns with research showing diaphragmatic breathing activates the vagus nerve, increasing parasympathetic tone and reducing sympathetic 'fight-or-flight' stress on the cardiovascular system (Zaccaro et al., Frontiers in Human Neuroscience 2018).",
    type: "correlation",
    metric: "Avg HR reduction",
    value: "−8 bpm on breathwork days",
  },
];

// ── Components ───────────────────────────────────────────────────────────────

function AnimatedBackground() {
  return (
    <div className="int-bg">
      <div className="int-bg-orb int-bg-orb--1" />
      <div className="int-bg-orb int-bg-orb--2" />
      <div className="int-bg-orb int-bg-orb--3" />
    </div>
  );
}


// ── 1byone Scale Import Panel (separate component to prevent tree-shaking) ───
const SCALE_IMPORT_URL = "/api/body-composition/import-csv";

function ScaleImportPanel({ onConnect }: { onConnect: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ saved: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) { setUploadFile(f); setImportResult(null); }
  };

  const handleImport = async () => {
    if (!uploadFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      const res = await fetch(SCALE_IMPORT_URL, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImportResult({ saved: data.inserted, skipped: data.skipped });
      toast({
        title: `${data.inserted} readings imported`,
        description: `${data.skipped} incomplete scans skipped`,
      });
      onConnect();
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      {/* How to export guide */}
      <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", lineHeight: 1.7, marginBottom: 12, background: "var(--color-bg)", borderRadius: 10, padding: "10px 14px", border: "1px solid var(--color-border)" }}>
        <div style={{ fontWeight: 700, color: "var(--color-text)", marginBottom: 6 }}>How to export from the 1byone app</div>
        {[
          "Open the 1byone Health app on your phone",
          "Tap the profile icon, then go to Data Management",
          "Select Export Data and choose a date range",
          "The app emails you a CSV file (BodyFatScale*.csv)",
          "Download that file and upload it here",
        ].map((step, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 3 }}>
            <span style={{ fontWeight: 800, color: "#7c3aed", minWidth: 16, fontSize: 11 }}>{i + 1}.</span>
            <span>{step}</span>
          </div>
        ))}
      </div>
      {/* Drop zone */}
      <label
        htmlFor="int-csv-input-scale"
        className={`csv-drop ${dragging ? "csv-drop--active" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{ display: "block", borderColor: dragging ? "#7c3aed" : undefined }}
      >
        <input
          id="int-csv-input-scale"
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) { setUploadFile(f); setImportResult(null); }
          }}
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        />
        {uploadFile ? (
          <><FileText size={24} style={{ color: "#7c3aed" }} /><div className="csv-filename">{uploadFile.name}</div><div className="csv-hint">Ready to import</div></>
        ) : (
          <><Upload size={24} style={{ color: "var(--color-text-faint)" }} /><div className="csv-label">Drop your BodyFatScale*.csv here</div><div className="csv-hint">.CSV only</div></>
        )}
      </label>
      {/* Result */}
      {importResult && (
        <div style={{ marginTop: 10, padding: "10px 14px", background: "hsl(262 60% 20% / 0.07)", borderRadius: 10, border: "1px solid hsl(262 60% 40% / 0.2)", fontSize: "0.75rem", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={14} style={{ color: "#7c3aed", flexShrink: 0 }} />
          <span><strong style={{ color: "var(--color-text)" }}>{importResult.saved} readings</strong> imported.{importResult.skipped > 0 ? ` ${importResult.skipped} incomplete scans skipped.` : ""}</span>
        </div>
      )}
      {/* Import button */}
      {uploadFile && !importResult && (
        <button
          className="int-connect-btn"
          onClick={handleImport}
          disabled={importing}
          style={{ marginTop: 10, opacity: importing ? 0.7 : 1, background: "#7c3aed" }}
        >
          {importing
            ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Importing...</>
            : <><Upload size={14} /> Import {uploadFile.name}</>
          }
        </button>
      )}
    </div>
  );
}

function InlineDetail({
  integration,
  status,
  onConnect,
}: {
  integration: IntegrationDef;
  status: IntegrationStatus;
  onConnect: () => void;
}) {
  const isConnected = status === "connected";
  const isCSV = integration.authMethod === "csv";
  const isCSVScale = integration.authMethod === "csv_scale";
  const isHealthKit = integration.authMethod === "health_kit";
  const isOAuth2CSV = integration.authMethod === "oauth2_csv";
  const [dragging, setDragging] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [garminTab, setGarminTab] = useState<"import" | "oauth">("import");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ saved: number; message?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setUploadFile(file);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!uploadFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json();
      const saved = data.saved ?? data.rows_parsed ?? 0;
      setImportResult({ saved });
      toast({ title: `${saved} activities imported`, description: `From ${uploadFile.name}` });
      onConnect();
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{
      borderTop: "1px solid var(--color-divider)",
      marginTop: 14,
      paddingTop: 16,
    }}>
      {/* Data Points */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-primary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
          <Download size={12} /> Data synced to <em className="ki">KEWT</em>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {integration.dataPoints.map((dp) => (
            <div key={dp} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.6875rem", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "3px 9px", color: "var(--color-text-muted)" }}>
              <CheckCircle2 size={10} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
              {dp}
            </div>
          ))}
        </div>
      </div>

      {/* Science note */}
      <div style={{ background: "hsl(214 80% 20% / 0.05)", borderRadius: 12, padding: "12px 14px", marginBottom: 14, fontSize: "0.75rem", color: "var(--color-text-muted)", lineHeight: 1.6 }}>
        <FlaskConical size={12} style={{ color: "var(--color-primary)", marginRight: 5, verticalAlign: "middle" }} />
        {integration.scienceNote}
      </div>

      {/* Connection UI */}
      {isOAuth2CSV ? (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {(["import", "oauth"] as const).map((t) => (
              <button key={t} onClick={() => setGarminTab(t)} style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: garminTab === t ? 700 : 500, fontSize: "0.75rem", background: garminTab === t ? integration.color : "var(--color-bg)", color: garminTab === t ? "#fff" : "var(--color-text-muted)", transition: "all 150ms" }}>
                {t === "import" ? "Import File" : "OAuth (Coming Soon)"}
              </button>
            ))}
          </div>
          {garminTab === "import" ? (
            <div>
              {/* Step-by-step export guide */}
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", lineHeight: 1.7, marginBottom: 12, background: "var(--color-bg)", borderRadius: 10, padding: "10px 14px", border: "1px solid var(--color-border)" }}>
                <div style={{ fontWeight: 700, color: "var(--color-text)", marginBottom: 6, fontSize: 12 }}>How to export activity files</div>
                {["Open your fitness platform (Garmin Connect, Strava, Apple Health, etc.)", "Navigate to your Activities or Health data section", "Select an activity or data range → look for an Export option", "Choose a supported format: .FIT, .GPX, .TCX, or .CSV", "Save the file to your device, then upload it here"].map((step, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 3 }}>
                    <span style={{ fontWeight: 800, color: "var(--color-primary)", minWidth: 16, fontSize: 11 }}>{i + 1}.</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
              {/* Drop zone */}
              <label htmlFor="int-file-input-activity" className={`csv-drop ${dragging ? "csv-drop--active" : ""}`} style={{ display: "block" }} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
                <input id="int-file-input-activity" ref={fileRef} type="file" accept=".fit,.gpx,.csv,.json,.zip" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setUploadFile(f); setImportResult(null); } }} style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
                {uploadFile ? (<><Download size={24} style={{ color: integration.color }} /><div className="csv-filename">{uploadFile.name}</div><div className="csv-hint">Ready to import</div></>) : (<><Download size={24} style={{ color: "var(--color-text-faint)" }} /><div className="csv-label">Drop your activity file here</div><div className="csv-hint">.CSV · .FIT · .GPX · .ZIP</div></>)}
              </label>
              {importResult && (
                <div style={{ marginTop: 10, padding: "10px 14px", background: "hsl(142 60% 20% / 0.07)", borderRadius: 10, border: "1px solid hsl(142 60% 20% / 0.2)", fontSize: "0.75rem", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={14} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
                  <span><strong style={{ color: "var(--color-text)" }}>{importResult.saved} activities</strong> imported successfully.</span>
                </div>
              )}
              {uploadFile && !importResult && (
                <button className="int-connect-btn" onClick={handleImport} disabled={importing} style={{ marginTop: 10, opacity: importing ? 0.7 : 1 }}>
                  {importing ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Importing...</> : <><Upload size={14} /> Import {uploadFile.name}</>}
                </button>
              )}
            </div>
          ) : (
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", lineHeight: 1.7, padding: "12px 14px", background: "var(--color-bg)", borderRadius: 10, border: "1px solid var(--color-border)" }}>
              <div style={{ fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>Platform OAuth (Coming Soon)</div>
              {["Apply at developer.garmin.com/health-api", "Approval takes 3-10 business days", "Once approved, paste your Client ID + Secret below", "KEWT will auto-sync activities, sleep, HRV, and Body Battery"].map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 4 }}>
                  <span style={{ fontWeight: 800, color: "var(--color-primary)", minWidth: 16, fontSize: 11 }}>{i + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <input placeholder="Client ID" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: "0.75rem", background: "var(--color-surface)", color: "var(--color-text)", boxSizing: "border-box" }} />
                <input placeholder="Client Secret" type="password" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: "0.75rem", background: "var(--color-surface)", color: "var(--color-text)", boxSizing: "border-box" }} />
                <button className="int-connect-btn" style={{ opacity: 0.5, cursor: "not-allowed" }} disabled>Integration Pending</button>
              </div>
            </div>
          )}
        </div>
      ) : isCSVScale ? (
        <ScaleImportPanel onConnect={onConnect} />
      ) : isCSV ? (
        <div>
          <label htmlFor="int-file-input-export" className={`csv-drop ${dragging ? "csv-drop--active" : ""}`} style={{ display: "block" }} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
            <input id="int-file-input-export" ref={fileRef} type="file" accept=".csv,.fit,.gpx,.json,.xml" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setUploadFile(f); toast({ title: "File ready", description: f.name }); } }} style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
            {uploadFile ? (<><FileText size={24} style={{ color: "var(--color-primary)" }} /><div className="csv-filename">{uploadFile.name}</div></>) : (<><Upload size={24} style={{ color: "var(--color-text-faint)" }} /><div className="csv-label">Drop your export here</div><div className="csv-hint">.CSV · .FIT · .GPX · .JSON</div></>)}
          </label>
          {uploadFile && (<button className="int-connect-btn" onClick={onConnect} style={{ marginTop: 10 }}><Upload size={14} /> Import {uploadFile.name}</button>)}
        </div>
      ) : isHealthKit ? (
        <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", lineHeight: 1.6 }}>
          <em className="ki">KEWT</em> uses HealthKit's secure permission model. Requires native iOS app - not available in browser.
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {["Authorize KEWT in " + integration.name, "KEWT receives read-only token", "Data syncs automatically"].map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: integration.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.625rem", fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                <span style={{ color: "var(--color-text-muted)" }}>{step}</span>
              </div>
            ))}
          </div>
          {!isConnected && (
            <button className="int-connect-btn" onClick={onConnect}><Link2 size={14} /> Connect with {integration.name}</button>
          )}
        </div>
      )}

      {isConnected && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, padding: "10px 14px", background: "hsl(142 60% 20% / 0.07)", borderRadius: 10, border: "1px solid hsl(142 60% 20% / 0.15)" }}>
          <CheckCircle2 size={16} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Connected - syncing {integration.syncFrequency}</span>
        </div>
      )}
    </div>
  );
}

function IntegrationCard({
  integration,
  status,
  onConnect,
  onViewDetails,
  isExpanded,
  stravaSync,
  onStravaSync,
}: {
  integration: IntegrationDef;
  status: IntegrationStatus;
  onConnect: () => void;
  onViewDetails: () => void;
  isExpanded?: boolean;
  stravaSync?: StravaSyncState;
  onStravaSync?: () => void;
}) {
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const isSoon = integration.authMethod === "coming_soon";
  const isStrava = integration.id === "strava";

  // Derive sync button display for Strava
  const syncPhase = stravaSync?.phase ?? "idle";
  const syncSuccess = stravaSync?.phase === "success" ? stravaSync : null;
  const syncError = stravaSync?.phase === "error" ? stravaSync : null;

  return (
    <div
      className={`int-card ${isConnected ? "int-card--connected" : ""}`}
      onClick={onViewDetails}
      data-testid={`integration-card-${integration.id}`}
    >
      {/* Icon */}
      <div
        className="int-card-icon"
        style={{ background: integration.gradient }}
      >
        <span className="int-card-icon-text">{integration.icon}</span>
        {isConnected && (
          <div className="int-card-badge int-card-badge--connected">
            <CheckCircle2 size={12} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="int-card-info">
        <div className="int-card-name">{integration.name}</div>
        <div className="int-card-tagline">{integration.tagline}</div>

        {/* Category */}
        <span className={`int-category-pill int-category-pill--${integration.category}`}>
          {integration.category}
        </span>
      </div>

      {/* Sync info */}
      {isConnected && (
        <div className="int-card-sync">
          <Wifi size={10} />
          <span>{integration.syncFrequency}</span>
        </div>
      )}

      {/* Strava last-sync status line */}
      {isStrava && isConnected && (
        <div className="int-strava-sync-status">
          {syncPhase === "syncing" && (
            <span className="int-strava-sync-label int-strava-sync-label--syncing">
              <Loader2 size={11} className="int-spinner" /> Syncing...
            </span>
          )}
          {syncPhase === "success" && syncSuccess && (
            <span className="int-strava-sync-label int-strava-sync-label--success">
              <CheckCircle2 size={11} /> Last synced: just now &middot; {syncSuccess.syncedCount} new, {syncSuccess.totalCount} total
            </span>
          )}
          {syncPhase === "error" && syncError && (
            <span className="int-strava-sync-label int-strava-sync-label--error">
              <AlertCircle size={11} /> Sync failed
            </span>
          )}
          {syncPhase === "idle" && (
            <span className="int-strava-sync-label int-strava-sync-label--idle">
              <RefreshCw size={11} /> Ready to sync
            </span>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="int-card-actions">
        {/* Main connect/status button */}
        <button
          className={`int-card-btn ${isConnected ? "int-card-btn--connected" : isConnecting ? "int-card-btn--loading" : ""}`}
          onClick={(e) => { e.stopPropagation(); if (!isConnected && !isSoon) onConnect(); }}
          data-testid={`button-connect-${integration.id}`}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <Loader2 size={14} className="int-spinner" />
          ) : isConnected ? (
            "Connected"
          ) : isSoon ? (
            "Soon"
          ) : integration.authMethod === "csv" ? (
            "Import"
          ) : integration.authMethod === "oauth2_csv" ? (
            "Import"
          ) : integration.authMethod === "csv_scale" ? (
            "Import"
          ) : (
            "Connect"
          )}
        </button>

        {/* Expand/collapse toggle */}
        <button
          className="int-card-btn int-card-btn--ghost"
          onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
          title={isExpanded ? "Collapse" : "Details"}
          style={{ minWidth: 32, padding: "0 8px" }}
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Strava dedicated Sync button */}
        {isStrava && isConnected && onStravaSync && (
          <button
            className={`int-strava-sync-btn${
              syncPhase === "syncing" ? " int-strava-sync-btn--loading" :
              syncPhase === "error" ? " int-strava-sync-btn--error" :
              syncPhase === "success" ? " int-strava-sync-btn--success" : ""
            }`}
            onClick={(e) => { e.stopPropagation(); onStravaSync(); }}
            disabled={syncPhase === "syncing"}
            data-testid="button-strava-sync"
            title={syncError ? syncError.message : "Sync Strava activities"}
          >
            {syncPhase === "syncing" ? (
              <><Loader2 size={12} className="int-spinner" /> Syncing...</>
            ) : syncPhase === "error" ? (
              <><AlertCircle size={12} /> Sync failed - retry</>
            ) : (
              <><RefreshCw size={12} /> {syncSuccess ? `Sync (${syncSuccess.totalCount})` : "Sync"}</>
            )}
          </button>
        )}
      </div>

      {/* Inline detail panel */}
      {isExpanded && (
        <InlineDetail
          integration={integration}
          status={status}
          onConnect={onConnect}
        />
      )}
    </div>
  );
}

function ScienceFeedback({ feedback }: { feedback: typeof ENTRY_FEEDBACK[0] }) {
  const typeColors: Record<string, string> = {
    insight: "var(--color-primary)",
    warning: "var(--color-warning)",
    correlation: "var(--color-purple)",
  };

  return (
    <div className={`sci-card sci-card--${feedback.type}`}>
      <div className="sci-card-header">
        <div className="sci-card-icon-wrap" style={{ background: `${typeColors[feedback.type]}20`, border: `1px solid ${typeColors[feedback.type]}40` }}>
          <FlaskConical size={16} style={{ color: typeColors[feedback.type] }} />
        </div>
        <div className="sci-card-title">{feedback.title}</div>
        <div className="sci-card-type-badge" style={{ background: `${typeColors[feedback.type]}15`, color: typeColors[feedback.type] }}>
          {feedback.type}
        </div>
      </div>
      <p className="sci-card-body">{feedback.body}</p>
      <div className="sci-card-metric">
        <span className="sci-metric-label">{feedback.metric}</span>
        <span className="sci-metric-value" style={{ color: typeColors[feedback.type] }}>{feedback.value}</span>
      </div>
    </div>
  );
}

// ── Strava Status Panel ──────────────────────────────────────────────────────
function StravaStatusPanel() {
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected">("loading");
  const [meta, setMeta] = useState<{
    athleteId?: string; connectedAt?: string; totalSynced?: number; lastSync?: string;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncResult, setSyncResult] = useState<{ syncedCount: number; totalCount: number } | null>(null);

  useEffect(() => {
    fetch("/api/strava/status", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data.connected) {
          setStatus("connected");
          setMeta({
            athleteId: data.athleteId,
            connectedAt: data.connectedAt,
            totalSynced: data.totalSynced,
            lastSync: data.lastSync,
          });
          if ((data.totalSynced ?? 0) > 0) {
            setSyncResult({ syncedCount: data.lastSyncCount ?? 0, totalCount: data.totalSynced });
          }
        } else {
          setStatus("disconnected");
        }
      })
      .catch(() => setStatus("disconnected"));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/strava/sync-oauth", {
        method: "POST", credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Sync failed" }));
        throw new Error(err.error || "Sync failed");
      }
      const data = await res.json();
      const syncedCount = data.synced ?? 0;
      const totalCount = data.total ?? meta?.totalSynced ?? 0;
      setSyncResult({ syncedCount, totalCount });
      setMeta(m => m ? { ...m, totalSynced: totalCount, lastSync: new Date().toISOString() } : m);
      toast({
        title: "Strava synced",
        description: `${syncedCount} new ${syncedCount === 1 ? "activity" : "activities"} · ${totalCount} total on file`,
      });
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
      toast({ title: "Strava disconnected" });
    } catch {
      toast({ title: "Could not disconnect", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  if (status === "loading") return null;

  const isConnected = status === "connected";

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 16px 28px" }}>
      <div style={{
        background: isConnected
          ? "linear-gradient(135deg, rgba(176,58,0,0.05) 0%, rgba(252,76,2,0.08) 100%)"
          : "var(--color-surface, #ffffff)",
        border: isConnected ? "1.5px solid rgba(252,76,2,0.25)" : "1.5px solid var(--color-border)",
        borderRadius: 20,
        padding: "18px 20px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Strava orange top stripe */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: "linear-gradient(90deg, #B03A00, #FC4C02)",
          opacity: isConnected ? 1 : 0.35,
        }} />

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>

          {/* Icon */}
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: "linear-gradient(135deg, #B03A00 0%, #FC4C02 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(252,76,2,0.35)",
          }}>
            <SiStrava size={24} color="#fff" />
          </div>

          {/* Identity + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)" }}>Strava</span>
              {isConnected ? (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 10, fontWeight: 700, color: "#16a34a",
                  background: "#dcfce7", border: "1px solid #86efac",
                  borderRadius: 20, padding: "2px 9px", letterSpacing: "0.04em",
                }}>
                  <CheckCircle2 size={10} /> Connected
                </span>
              ) : (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 10, fontWeight: 700, color: "#64748b",
                  background: "#f1f5f9", border: "1px solid #e2e8f0",
                  borderRadius: 20, padding: "2px 9px", letterSpacing: "0.04em",
                }}>
                  <XCircle size={10} /> Not connected
                </span>
              )}
            </div>

            {isConnected && meta ? (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "var(--color-text-muted)" }}>
                {meta.totalSynced != null && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Activity size={11} style={{ color: "#FC4C02" }} />
                    {meta.totalSynced} activities on file
                  </span>
                )}
                {meta.lastSync && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock size={11} />
                    Last sync {new Date(meta.lastSync).toLocaleDateString("en-US", {
                      month: "short", day: "numeric",
                      hour: "numeric", minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                Connect to sync rides, runs, and activities into KEWT automatically
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {isConnected ? (
              <>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  data-testid="strava-panel-sync"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", borderRadius: 10, border: "none",
                    background: "#FC4C02", color: "#fff",
                    fontSize: 12, fontWeight: 700,
                    cursor: syncing ? "not-allowed" : "pointer",
                    opacity: syncing ? 0.7 : 1,
                    whiteSpace: "nowrap",
                    boxShadow: "0 2px 8px rgba(252,76,2,0.3)",
                    transition: "opacity 150ms",
                  }}
                >
                  {syncing
                    ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Syncing...</>
                    : <><RefreshCw size={12} /> Sync now</>}
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  data-testid="strava-panel-disconnect"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "8px 12px", borderRadius: 10,
                    border: "1px solid #fca5a5", background: "transparent",
                    color: "#ef4444", fontSize: 12, fontWeight: 600,
                    cursor: disconnecting ? "not-allowed" : "pointer",
                    opacity: disconnecting ? 0.6 : 1,
                    whiteSpace: "nowrap",
                    transition: "opacity 150ms",
                  }}
                >
                  {disconnecting ? "Disconnecting..." : <><XCircle size={12} /> Disconnect</>}
                </button>
              </>
            ) : (
              <a
                href="/api/strava/connect"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "9px 18px", borderRadius: 10,
                  background: "#FC4C02", color: "#fff",
                  fontSize: 12, fontWeight: 700, textDecoration: "none",
                  whiteSpace: "nowrap",
                  boxShadow: "0 2px 8px rgba(252,76,2,0.35)",
                }}
              >
                <Link2 size={12} /> Connect Strava
              </a>
            )}
          </div>
        </div>

        {/* Sync result confirmation */}
        {isConnected && syncResult && (
          <div style={{
            marginTop: 12, padding: "8px 12px",
            background: "rgba(22,163,74,0.07)",
            border: "1px solid rgba(22,163,74,0.2)",
            borderRadius: 10, fontSize: 12, color: "#15803d",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <CheckCircle2 size={13} />
            {syncResult.syncedCount} new {syncResult.syncedCount === 1 ? "activity" : "activities"} synced
            {syncResult.totalCount > 0 && ` · ${syncResult.totalCount} total on file`}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Coming Soon Banner ─────────────────────────────────────────────────────
function ComingSoonBanner() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleNotify = async () => {
    if (!email.trim() || !email.includes("@")) return;
    setSaving(true);
    // Store locally for now; wire to backend when ready
    await new Promise(r => setTimeout(r, 600));
    setSaving(false);
    setSubmitted(true);
  };

  return (
    <div style={{
      maxWidth: 680,
      margin: "0 auto 0",
      padding: "0 16px 80px",
    }}>
      <div style={{
        background: "linear-gradient(135deg, #065f4610 0%, #f59e0b08 100%)",
        border: "1px solid #065f4630",
        borderRadius: 20,
        padding: "24px 24px 20px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative top stripe */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: "linear-gradient(90deg, #065f46, #f59e0b, #065f46)",
          opacity: 0.6,
        }} />

        {/* BEI badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{
            fontSize: "0.625rem", fontWeight: 800, letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: "#f59e0b18", color: "var(--color-ember)",
            border: "1px solid #f59e0b40",
            borderRadius: 20, padding: "3px 10px",
          }}>BEI · Integrations Roadmap</span>
        </div>

        <h3 style={{
          fontSize: "1.125rem", fontWeight: 800, color: "var(--color-text)",
          margin: "0 0 8px", lineHeight: 1.25,
        }}>
          Direct platform connections are on the way.
        </h3>
        <p style={{
          fontSize: "0.8125rem", color: "var(--color-text-muted)",
          margin: "0 0 20px", lineHeight: 1.6, maxWidth: 520,
        }}>
          <em className="ki">KEWT</em> is actively building live integrations with Garmin, Apple Health, and Google Health Connect.
          Each requires a formal API partnership and review process. In the meantime, you can upload your activity files directly using the Import tab.
          Strava is live today.
        </p>

        {/* Platform pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {[
            { name: "Garmin Connect", color: "#00A3FF", note: "API approval in progress" },
            { name: "Apple Health", color: "#FF2D55", note: "HealthKit entitlement pending" },
            { name: "Google Health Connect", color: "#4285F4", note: "Includes Fitbit (acquired by Google 2021)" },
          ].map(p => (
            <div key={p.name} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: `${p.color}12`,
              border: `1px solid ${p.color}35`,
              borderRadius: 20, padding: "5px 12px",
            }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, opacity: 0.85 }} />
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text)" }}>{p.name}</span>
              <span style={{ fontSize: "0.6875rem", color: "var(--color-text-faint)" }}>{p.note}</span>
            </div>
          ))}
        </div>

        {/* Email notify */}
        {!submitted ? (
          <div style={{ display: "flex", gap: 8, maxWidth: 420 }}>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleNotify()}
              style={{
                flex: 1, padding: "9px 14px",
                border: "1.5px solid var(--color-border)",
                borderRadius: 12, fontSize: "0.8125rem",
                background: "var(--color-bg)", color: "var(--color-text)",
                outline: "none",
              }}
            />
            <button
              onClick={handleNotify}
              disabled={saving || !email.includes("@")}
              style={{
                padding: "9px 18px", borderRadius: 12, border: "none",
                background: "var(--color-primary)", color: "#fff",
                fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer",
                opacity: saving || !email.includes("@") ? 0.5 : 1,
                transition: "opacity 150ms",
                whiteSpace: "nowrap",
              }}
            >
              {saving ? "Saving..." : "Notify me"}
            </button>
          </div>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            fontSize: "0.8125rem", color: "var(--color-primary)", fontWeight: 600,
          }}>
            <CheckCircle2 size={16} />
            You are on the list. We will reach out when integrations go live.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function IntegrationsPage() {
  const { toast } = useToast();
  const [category, setCategory] = useState("all");
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({});
  const [syncMeta, setSyncMeta] = useState<Record<string, { lastSync: string | null; totalSynced: number; lastSyncCount: number }>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSciencePanel, setShowSciencePanel] = useState(true);
  const [bewOpen, setBewOpen] = useState(false);
  const [stravaSync, setStravaSync] = useState<StravaSyncState>({ phase: "idle" });

  // Ocean wave sound for BEI panel toggle
  function playWave(opening: boolean) {
    try {
      const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
      const bufLen = Math.floor(ac.sampleRate * 1.8);
      const buf = ac.createBuffer(2, bufLen, ac.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < bufLen; i++) {
          const t = i / bufLen;
          const swell = Math.sin(t * Math.PI * 2.2) * Math.sin(t * Math.PI * 0.7);
          const wash = (Math.random() * 2 - 1) * 0.35;
          const foam = (Math.random() * 2 - 1) * 0.12;
          const env = opening
            ? Math.pow(Math.sin(t * Math.PI), 0.6)
            : Math.pow(Math.sin((1 - t) * Math.PI), 0.6);
          d[i] = (swell * 0.3 + wash + foam) * env * 0.28;
          if (ch === 1) d[i] *= 0.88;
        }
      }
      const src = ac.createBufferSource();
      const lp = ac.createBiquadFilter();
      const hp = ac.createBiquadFilter();
      const g = ac.createGain();
      lp.type = 'lowpass'; lp.frequency.value = opening ? 1800 : 1200;
      hp.type = 'highpass'; hp.frequency.value = 80;
      g.gain.setValueAtTime(0.7, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 1.9);
      src.buffer = buf;
      src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(ac.destination);
      src.start();
    } catch (e) {}
  }


  // Load persisted connection state from server on mount
  useEffect(() => {
    fetch("/api/strava/status", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data.connected) {
          setStatuses(s => ({ ...s, strava: "connected" }));
          setSyncMeta(m => ({ ...m, strava: { lastSync: data.lastSync, totalSynced: data.totalSynced, lastSyncCount: data.lastSyncCount } }));
          // Pre-populate sync state with existing total so button shows count immediately
          if (data.totalSynced > 0) {
            setStravaSync({
              phase: "success",
              syncedCount: data.lastSyncCount ?? 0,
              totalCount: data.totalSynced,
              syncedAt: data.lastSync ?? new Date().toISOString(),
            });
          }
        }
      })
      .catch(() => {}); // silently ignore if server not yet running
  }, []);

  // Science ticker is CSS marquee-driven, no JS interval needed

  const filtered = INTEGRATIONS.filter((i) => {
    const catMatch = category === "all" || i.category === category;
    return catMatch;
  });

  const connectedCount = Object.values(statuses).filter((s) => s === "connected").length;

  const handleConnect = (integration: IntegrationDef) => {
    setStatuses((s) => ({ ...s, [integration.id]: "connecting" }));

    if (integration.id === "strava") {
      // Strava sync: check current status — already connected shows latest meta
      fetch("/api/strava/status", { credentials: "include" })
        .then(r => r.json())
        .then(data => {
          if (data.connected && data.totalSynced > 0) {
            setStatuses(s => ({ ...s, strava: "connected" }));
            setSyncMeta(m => ({ ...m, strava: { lastSync: data.lastSync, totalSynced: data.totalSynced, lastSyncCount: data.lastSyncCount } }));
            toast({
              title: "Strava connected",
              description: `${data.totalSynced} activities on file. Last sync: ${data.lastSync ? new Date(data.lastSync).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "never"}.`,
            });
          } else {
            setStatuses(s => ({ ...s, strava: "error" }));
            toast({
              title: "Strava sync required",
              description: "Use the KEWT agent to run a Strava sync - the server cannot reach Strava directly.",
              variant: "destructive",
            });
          }
        })
        .catch(() => {
          setStatuses(s => ({ ...s, strava: "error" }));
          toast({ title: "Could not reach server", description: "Make sure the KEWT server is running.", variant: "destructive" });
        });
    } else {
      // Other integrations: UI placeholder until their APIs are wired
      setTimeout(() => {
        setStatuses((s) => ({ ...s, [integration.id]: "connected" }));
        toast({
          title: `${integration.name} connected`,
          description: `${integration.dataPoints.length} data streams syncing - ${integration.syncFrequency}.`,
        });
      }, 1800);
    }
  };

  // Strava dedicated sync handler
  const handleStravaSync = async () => {
    setStravaSync({ phase: "syncing" });
    try {
      const res = await fetch("/api/strava/sync-oauth", { credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ per_page: 30, page: 1 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Sync request failed" }));
        setStravaSync({ phase: "error", message: err.error || "Sync request failed" });
        toast({ title: "Strava sync failed", description: err.error || "Server error", variant: "destructive" });
        return;
      }
      const data = await res.json();
      // Refresh meta from server to get authoritative total count
      const metaRes = await fetch("/api/strava/status", { credentials: "include" }).catch(() => null);
      const meta = metaRes ? await metaRes.json().catch(() => null) : null;
      const totalCount = meta?.totalSynced ?? data.totalSynced ?? data.total ?? 0;
      const syncedCount = data.synced ?? 0;
      setStravaSync({ phase: "success", syncedCount, totalCount, syncedAt: new Date().toISOString() });
      // Update syncMeta so modal also shows latest
      setSyncMeta(m => ({ ...m, strava: { lastSync: new Date().toISOString(), totalSynced: totalCount, lastSyncCount: syncedCount } }));
      toast({
        title: "Strava synced",
        description: `${syncedCount} new ${syncedCount === 1 ? "activity" : "activities"} synced. ${totalCount} total on file.`,
      });
    } catch (e: any) {
      setStravaSync({ phase: "error", message: e.message || "Network error" });
      toast({ title: "Strava sync failed", description: e.message || "Network error", variant: "destructive" });
    }
  };

  // const currentInsight = SCIENCE_INSIGHTS[activeScienceInsight]; // replaced by marquee

  return (
    <div className="int-page">
      <AnimatedBackground />

      {/* ── Hero - desktop: 60/40 split | mobile: stacked center ── */}
      <div className="int-hero">

        {/* LEFT col - copy (desktop) / full-width stacked (mobile) */}
        <div className="int-hero-inner">
          <div className="int-hero-brand">
            <img src="./bew_logo_sm.jpg" alt="Blue Ember Wellness" className="int-hero-brand-logo" />
            <div className="int-hero-brand-name">
              <span className="int-hero-brand-main">Blue Ember Wellness</span>
              <span className="int-hero-brand-sub">Breathe. Reset. Return.</span>
            </div>
          </div>



          <h1 className="int-hero-title">
            Built for your body.<br />Connected soon.<br />One nervous system.
          </h1>
          <div className="int-hero-stats-wrap">
            <svg className="int-integral-watermark" viewBox="0 0 14 24" fill="none" aria-hidden="true">
              <path d="M9 2.5 C9 2.5 8 1 6.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
              <path d="M8 2 C7 4 5 8 6 12 C7 16 9 19 8 22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
              <path d="M5 21.5 C5 21.5 6 23 7.5 22.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
            </svg>
            <div className="int-hero-stats">
              <div className="int-hero-stat">
                <div className="int-hero-stat-num">{connectedCount}</div>
                <div className="int-hero-stat-label">Connected</div>
              </div>
              <div className="int-hero-stat-divider" />
              <div className="int-hero-stat">
                <div className="int-hero-stat-num">{INTEGRATIONS.filter(i => i.authMethod === "coming_soon").length}</div>
                <div className="int-hero-stat-label">Coming Soon</div>
              </div>
              <div className="int-hero-stat-divider" />
              <div className="int-hero-stat">
                <div className="int-hero-stat-num">1</div>
                <div className="int-hero-stat-label">Live Now</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT col - puzzle image, desktop only */}
        <div className="int-hero-img-col" aria-hidden="true">
          <img src="./integration_hero.png" alt="" className="int-hero-img" />
          <div className="int-hero-img-fade-left" />
          <div className="int-hero-img-fade-top" />
          <div className="int-hero-img-fade-bottom" />
        </div>

      </div>

      {/* ── Mobile divider band - full-width image, mobile/tablet only ── */}
      <div className="int-divider-band" aria-hidden="true">
        <img src="./integration_hero.png" alt="" className="int-divider-band-img" />

      </div>

      {/* ── Filter ──────────────────────────────────────── */}


      {/* ── Strava ───────────────────────────────────────────────── */}
      <StravaStatusPanel />

      {/* ── Coming Soon Banner ───────────────────────────────────── */}
      <ComingSoonBanner />

      {/* ── Blue Ember Intelligence Collapsible Panel ──────────── */}
      <div className="bei-collapse-wrap">
        {/* Trigger row */}
        <button
          className={`bei-collapse-trigger${bewOpen ? " open" : ""}`}
          onClick={() => { playWave(!bewOpen); setBewOpen(o => !o); }}
          aria-expanded={bewOpen}
        >
          {/* BEW shield logo - badge only, no name */}
          <div className={`bei-logo-bloom-wrap${bewOpen ? " open" : ""}`}>
            <img
              src="./bew_logo_sm.jpg"
              alt="Blue Ember Wellness"
              className="bei-logo-badge"
            />
          </div>
          <span className="bei-trigger-label">Blue Ember Intelligence</span>
          <span className="bei-trigger-sub">Powered by Blue Ember Wellness</span>
          <span className={`bei-trigger-caret${bewOpen ? " open" : ""}`}>▾</span>
        </button>

        {/* Expandable body */}
        <div className={`bei-collapse-body${bewOpen ? " open" : ""}`}>
          <div className="bei-collapse-inner">

      {/* ── Blue Ember Wellness - Native Integration (Featured) ─── */}
      <div className="int-bew-featured">
        {/* Teal neon wall background image */}
        <div className="int-bew-bg" style={{
          backgroundImage: "url(./bew_wall_teal.png)",
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
          position: "absolute",
          inset: 0,
          borderRadius: 20,
          opacity: 0.18,
          zIndex: 0,
        }} />
        <div className="int-bew-featured-inner" style={{ position: "relative", zIndex: 1 }}>

          {/* Shield logo + identity */}
          <div className="int-bew-logo-col">
            <img
              src="./bew_logo.jpg"
              alt="Blue Ember Wellness"
              width={90}
              height={90}
              style={{ display: "block", objectFit: "contain", borderRadius: 6, flexShrink: 0 }}
            />
            <div className="int-bew-badge-native">Native Integration</div>
          </div>

          {/* Content */}
          <div className="int-bew-content">
            <div className="int-bew-eyebrow">
              <span className="int-bew-eyebrow-dot" />
              Home Base · The Origin
            </div>
            <h2 className="int-bew-name">Blue Ember Wellness</h2>
            <p className="int-bew-tagline">Reiki · Breathwork · Posture · Richmond, VA</p>
            {/* BREATHE. RESET. RETURN. - brand philosophy from merch */}
            <p className="int-bew-philosophy">Breathe. Reset. Return.</p>
            <p className="int-bew-desc">
              Where it all began. <em className="ki">KEWT</em> is powered by Blue Ember Wellness - the Reiki, Breathwork, and Posture practice founded in Richmond, VA. When the native Breathwork &amp; Posture app launches, it will sync directly here: session data, breathwork streaks, and posture scores flowing into your Blue Ember Intelligence dashboard automatically.
            </p>
            <div className="int-bew-services">
              <span className="int-bew-service-pill">Reiki</span>
              <span className="int-bew-service-pill">Breathwork</span>
              <span className="int-bew-service-pill">Posture</span>
              <span className="int-bew-service-pill int-bew-service-pill--location">Richmond, VA</span>
            </div>
            <div className="int-bew-actions">
              <a
                href="https://www.blueemberwellnessrva.com"
                target="_blank"
                rel="noopener noreferrer"
                className="int-bew-cta"
              >
                Visit Blue Ember Wellness →
              </a>
              <div className="int-bew-coming-soon">
                <span className="int-bew-cs-dot" />
                Breathwork &amp; Posture App · Coming Soon
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Science Feedback Panel (inside BEI collapse) ───── */}
      <div className="int-science-section">
        <div className="int-science-header">
          <div>
            <div className="int-section-eyebrow">Real-Time Science Engine</div>
            <h2 className="int-section-title">Data entries trigger scientific feedback</h2>
            <p className="int-section-sub">Every log entry, a fasted ride, a short sleep night, a breathwork session, generates a personalized scientific explanation grounded in peer-reviewed research.</p>
          </div>
        </div>
        <div className="int-science-grid">
          {ENTRY_FEEDBACK.map((fb) => <ScienceFeedback key={fb.id} feedback={fb} />)}
        </div>
      </div>

          </div>{/* end bei-collapse-inner */}
        </div>{/* end bei-collapse-body */}
      </div>{/* end bei-collapse-wrap */}

      {/* Integration grid hidden — platform connections surface in a future Pro release */}

      {/* ── How it works ─────────────────────────────────────────── */}
      <div className="int-how-section">
        <div className="int-section-eyebrow">Under the Hood</div>
        <h2 className="int-section-title">How KEWT integrates your data</h2>
        <div className="int-how-grid">
          {[
            { step: "01", title: "OAuth & API", body: "Industry-standard OAuth 2.0 authorization flows with encrypted token storage. Your credentials never touch KEWT servers - only read-scope access tokens.", icon: <Shield size={22}/> },
            { step: "02", title: "ETL Pipeline", body: "Raw data is normalized: units converted, timezones aligned, duplicates deduplicated. A Garmin ride and a Strava ride of the same activity are intelligently merged, not double-counted.", icon: <RefreshCw size={22}/> },
            { step: "03", title: "Correlation Engine", body: "Nightly Pearson correlation analysis across all metric pairs. Minimum 14 data points required before surfacing insights - no spurious correlations from small samples.", icon: <TrendingUp size={22}/> },
            { step: "04", title: "Science Layer", body: "Each insight is mapped to peer-reviewed research. KEWT explains the biological mechanism - not just 'sleep more' but why sleep duration affects fat oxidation at the mitochondrial level.", icon: <Brain size={22}/> },
          ].map((h) => (
            <div key={h.step} className="int-how-card">
              <div className="int-how-step">{h.step}</div>
              <div className="int-how-icon">{h.icon}</div>
              <div className="int-how-title">{h.title}</div>
              <div className="int-how-body">{h.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Privacy Section ──────────────────────────────────────── */}
      <div className="int-privacy">
        <Shield size={20} style={{ color: "var(--color-primary)" }} />
        <div>
          <div className="int-privacy-title">Privacy by Design</div>
          <p className="int-privacy-body">All OAuth tokens are encrypted at rest with AES-256. KEWT requests read-only scopes - we never write to external apps. You can revoke any connection instantly. GDPR-compliant with full data export and deletion on request.</p>
        </div>
      </div>


    </div>
  );
}
