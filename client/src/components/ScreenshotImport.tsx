import { useRef, useState } from "react";
import { Camera, CheckCircle, XCircle, Loader2, Upload, RefreshCw, Plus, X } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type DataType = "sleep" | "activity" | "body_comp";

interface SleepData {
  date: string | null;
  sleep_score: number | null;
  hours: number | null;
  quality: number | null;
  deep_min: number | null;
  light_min: number | null;
  rem_min: number | null;
  awake_min: number | null;
  resting_hr: number | null;
  avg_overnight_hr: number | null;
  hrv: number | null;
  hrv_status: string | null;
  spo2_avg: number | null;
  spo2_low: number | null;
  respiration_avg: number | null;
  respiration_low: number | null;
  stress: number | null;
  body_battery_change: number | null;
  restless_moments: number | null;
  fell_asleep: string | null;
  woke_up: string | null;
  notes: string | null;
}

interface ActivityData {
  date: string | null;
  modality: string | null;
  duration_min: number | null;
  distance_miles: number | null;
  elevation_ft: number | null;
  avg_hr: number | null;
  est_cals_burned: number | null;
  intensity: string | null;
  perceived_effort: number | null;
  environment: string | null;
  notes: string | null;
}

type ParsedData = SleepData | ActivityData;

type Phase = "idle" | "scanning" | "review" | "saving" | "done" | "error";

// ─── Field config ─────────────────────────────────────────────────────────────

const SLEEP_FIELDS: { key: keyof SleepData; label: string; type: "text" | "number" }[] = [
  { key: "date", label: "Date", type: "text" },
  { key: "sleep_score", label: "Sleep Score", type: "number" },
  { key: "hours", label: "Total Hours", type: "number" },
  { key: "deep_min", label: "Deep (min)", type: "number" },
  { key: "light_min", label: "Light (min)", type: "number" },
  { key: "rem_min", label: "REM (min)", type: "number" },
  { key: "awake_min", label: "Awake (min)", type: "number" },
  { key: "resting_hr", label: "Resting HR", type: "number" },
  { key: "avg_overnight_hr", label: "Overnight HR", type: "number" },
  { key: "hrv", label: "HRV (ms)", type: "number" },
  { key: "hrv_status", label: "HRV Status", type: "text" },
  { key: "spo2_avg", label: "SpO2 Avg %", type: "number" },
  { key: "spo2_low", label: "SpO2 Low %", type: "number" },
  { key: "respiration_avg", label: "Resp Avg (brpm)", type: "number" },
  { key: "respiration_low", label: "Resp Low (brpm)", type: "number" },
  { key: "stress", label: "Stress Avg", type: "number" },
  { key: "body_battery_change", label: "Body Battery", type: "number" },
  { key: "restless_moments", label: "Restless Moments", type: "number" },
  { key: "fell_asleep", label: "Fell Asleep", type: "text" },
  { key: "woke_up", label: "Woke Up", type: "text" },
];

const ACTIVITY_FIELDS: { key: keyof ActivityData; label: string; type: "text" | "number" }[] = [
  { key: "date", label: "Date", type: "text" },
  { key: "modality", label: "Activity Type", type: "text" },
  { key: "duration_min", label: "Duration (min)", type: "number" },
  { key: "distance_miles", label: "Distance (mi)", type: "number" },
  { key: "elevation_ft", label: "Elevation Gain (ft)", type: "number" },
  { key: "avg_hr", label: "Avg HR", type: "number" },
  { key: "est_cals_burned", label: "Calories", type: "number" },
  { key: "intensity", label: "Intensity", type: "text" },
  { key: "perceived_effort", label: "Perceived Effort (1-10)", type: "number" },
  { key: "environment", label: "Environment", type: "text" },
];

const BODY_COMP_FIELDS: { key: string; label: string; type: "text" | "number"; unit?: string }[] = [
  { key: "date",                label: "Date",                  type: "text" },
  { key: "morning_weight",      label: "Weight",                type: "number", unit: "lb" },
  { key: "body_fat_pct",        label: "Body Fat",              type: "number", unit: "%" },
  { key: "muscle_mass_lb",      label: "Muscle Mass",           type: "number", unit: "lb" },
  { key: "body_water_pct",      label: "Body Water",            type: "number", unit: "%" },
  { key: "bmi",                 label: "BMI",                   type: "number" },
  { key: "skeletal_muscle_pct", label: "Skeletal Muscle Rate",  type: "number", unit: "%" },
  { key: "subcutaneous_fat_pct",label: "Subcutaneous Fat",      type: "number", unit: "%" },
  { key: "fat_free_lb",         label: "Fat-Free Body",         type: "number", unit: "lb" },
  { key: "bone_mass_lb",        label: "Bone Mass",             type: "number", unit: "lb" },
  { key: "visceral_fat",        label: "Visceral Fat (index)",  type: "number" },
  { key: "bmr_kcal",            label: "BMR",                   type: "number", unit: "kcal" },
  { key: "protein_pct",         label: "Protein",               type: "number", unit: "%" },
  { key: "body_score",          label: "Body Score",            type: "number" },
];

// Merge multiple parsed results — non-null values win, first non-null takes priority
function mergeFields(results: { type: string; data: Record<string, any> }[]): { type: DataType; data: Record<string, any> } {
  const type = results[0]?.type as DataType ?? "sleep";
  const merged: Record<string, any> = {};
  for (const result of results) {
    for (const [k, v] of Object.entries(result.data ?? {})) {
      if (merged[k] == null && v != null) merged[k] = v;
    }
  }
  return { type, data: merged };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScreenshotImport() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [previews, setPreviews] = useState<string[]>([]);
  const [dataType, setDataType] = useState<DataType | null>(null);
  const [fields, setFields] = useState<Record<string, any>>({});
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [savedAction, setSavedAction] = useState<string>("");
  const [scanCount, setScanCount] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);

  const reset = () => {
    setPhase("idle");
    setPreviews([]);
    setDataType(null);
    setFields({});
    setErrorMsg("");
    setSavedAction("");
    setScanCount(0);
    setScanTotal(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (addMoreRef.current) addMoreRef.current.value = "";
  };

  const parseFile = async (file: File): Promise<{ type: string; data: Record<string, any> }> => {
    const formData = new FormData();
    formData.append("image", file);

    // 60-second timeout — OpenAI Vision can be slow
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    let res: Response;
    try {
      res = await fetch("/api/parse-screenshot", {
        method: "POST",
        body: formData,
        credentials: "include",
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e?.name === "AbortError") throw new Error("Screenshot scan timed out. Try again.");
      throw new Error("Network error — check connection and try again.");
    }
    clearTimeout(timeoutId);

    // Handle non-JSON error responses (HTML 500 pages, Railway cold-start errors)
    if (!res.ok) {
      let errMsg = `Server error (${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson?.error) errMsg = errJson.error;
      } catch {
        try { const t = await res.text(); if (t && t.length < 200) errMsg = t; } catch {}
      }
      throw new Error(errMsg);
    }

    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Screenshot could not be parsed");
    return { type: json.type, data: json.data ?? {} };
  };

  const handleFiles = async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith("image/"));
    if (!imageFiles.length) return;

    // Load all previews first, then transition to scanning atomically
    const newPreviews: string[] = [];
    for (const file of imageFiles) {
      await new Promise<void>(resolve => {
        const reader = new FileReader();
        reader.onload = (e) => { newPreviews.push(e.target?.result as string); resolve(); };
        reader.onerror = () => resolve(); // skip unreadable files gracefully
        reader.readAsDataURL(file);
      });
    }

    // Set previews and phase together to avoid flash
    setPreviews(prev => [...prev, ...newPreviews]);
    setPhase("scanning");
    setScanTotal(imageFiles.length);
    setScanCount(0);

    try {
      const results: { type: string; data: Record<string, any> }[] = [];
      for (const file of imageFiles) {
        const result = await parseFile(file);
        results.push(result);
        setScanCount(prev => prev + 1);
      }

      const { type, data } = mergeFields(results);

      setFields(prev => {
        const merged: Record<string, any> = { ...data };
        for (const [k, v] of Object.entries(prev)) {
          if (merged[k] == null && v != null) merged[k] = v;
        }
        return merged;
      });
      setDataType(type);
      setPhase("review");
    } catch (e: any) {
      setErrorMsg(e.message || "Unknown error");
      setPhase("error");
    }
  };

  const handleAddMore = async (files: File[]) => {
    if (!files.length) return;
    const imageFiles = files.filter(f => f.type.startsWith("image/"));
    if (!imageFiles.length) return;

    const newPreviews: string[] = [];
    for (const file of imageFiles) {
      await new Promise<void>(resolve => {
        const reader = new FileReader();
        reader.onload = (e) => { newPreviews.push(e.target?.result as string); resolve(); };
        reader.readAsDataURL(file);
      });
    }
    setPreviews(prev => [...prev, ...newPreviews]);

    setPhase("scanning");
    setScanTotal(prev => prev + imageFiles.length);

    try {
      const results: { type: string; data: Record<string, any> }[] = [];
      for (const file of imageFiles) {
        const result = await parseFile(file);
        results.push(result);
        setScanCount(prev => prev + 1);
      }

      // Merge new results into existing fields — existing non-null values win
      setFields(prev => {
        const merged: Record<string, any> = { ...prev };
        for (const result of results) {
          for (const [k, v] of Object.entries(result.data ?? {})) {
            if (merged[k] == null && v != null) merged[k] = v;
          }
        }
        return merged;
      });
      setPhase("review");
    } catch (e: any) {
      // Don't wipe the existing review — just show a toast-style warning
      // and return to review phase so the user can still save what was
      // already extracted from prior screenshots.
      setErrorMsg(e.message || "Could not read additional screenshot");
      setPhase("review"); // preserve existing fields
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length) handleFiles(files);
  };

  const handleInputChange = (key: string, value: string, type: "text" | "number") => {
    setFields((prev) => ({
      ...prev,
      [key]: type === "number" ? (value === "" ? null : parseFloat(value)) : value || null,
    }));
  };

  const handleCommit = async () => {
    setPhase("saving");
    try {
      const res = await fetch("/api/commit-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: dataType, data: fields }),
        credentials: "include",
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Save failed");
      setSavedAction(json.action);
      setPhase("done");
    } catch (e: any) {
      setErrorMsg(e.message);
      setPhase("error");
    }
  };

  const activeFields = dataType === "sleep" ? SLEEP_FIELDS : dataType === "body_comp" ? BODY_COMP_FIELDS : ACTIVITY_FIELDS;
  const filledCount = activeFields.filter(f => fields[f.key] != null).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="screenshot-import-section">

      {/* Drop zone — idle */}
      {phase === "idle" && (
        <div
          className="screenshot-dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <Camera size={28} className="screenshot-dropzone-icon" />
          <p className="screenshot-dropzone-label">Upload screenshots</p>
          <p className="screenshot-dropzone-sub">Garmin sleep, Garmin activity, or 1byone scale screens.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
          />
        </div>
      )}

      {/* Scanning */}
      {phase === "scanning" && (
        <div className="screenshot-status-card">
          {previews.length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              {previews.map((p, i) => (
                <img key={i} src={p} alt={`Screenshot ${i + 1}`} className="screenshot-thumb" />
              ))}
            </div>
          )}
          <div className="screenshot-status-row">
            <Loader2 size={18} className="screenshot-spinner" />
            <span className="screenshot-status-text">
              Reading screenshot{scanTotal > 1 ? `s (${scanCount}/${scanTotal})` : ""}...
            </span>
          </div>
        </div>
      )}

      {/* Review */}
      {phase === "review" && (
        <div className="screenshot-review-card">
          <div className="screenshot-review-header">
            <div className="screenshot-review-header-left">
              {previews.length > 0 && (
                <div style={{ display: "flex", gap: "0.375rem" }}>
                  {previews.map((p, i) => (
                    <img key={i} src={p} alt={`Screenshot ${i + 1}`} className="screenshot-thumb-sm" />
                  ))}
                </div>
              )}
              <div>
                <p className="screenshot-review-type">
                  {dataType === "sleep" ? "Sleep Summary" : dataType === "body_comp" ? "Body Composition" : "Activity"} detected
                  <span style={{ marginLeft: "0.5rem", fontSize: "0.7rem", color: "var(--color-text-faint)", fontWeight: 500 }}>
                    {filledCount}/{activeFields.length} fields
                  </span>
                </p>
                <p className="screenshot-review-hint">
            {errorMsg ? <span style={{ color: "#dc2626" }}>{errorMsg}</span> : "Edit any field, then confirm to save."}
          </p>
              </div>
            </div>
            <button className="screenshot-retry-btn" onClick={reset} title="Start over">
              <X size={14} />
            </button>
          </div>

          {/* Add more screenshots */}
          <button
            style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "var(--color-primary)", fontWeight: 600, background: "none", border: "1.5px dashed var(--color-primary)", borderRadius: "0.5rem", padding: "0.4rem 0.75rem", cursor: "pointer", marginBottom: "0.75rem", opacity: 0.8 }}
            onClick={() => addMoreRef.current?.click()}
          >
            <Plus size={13} />
            Add another screenshot to fill more fields
          </button>
          <input
            ref={addMoreRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleAddMore(Array.from(e.target.files))}
          />

          <div className="screenshot-fields-grid">
            {activeFields.map(({ key, label, type }) => {
              const val = fields[key as string];
              const haVal = val != null && val !== "";
              return (
                <div key={key} className="screenshot-field">
                  <label className="screenshot-field-label" style={{ color: haVal ? "var(--color-primary)" : undefined }}>
                    {label}
                  </label>
                  <input
                    className="screenshot-field-input"
                    type={type === "number" ? "number" : "text"}
                    value={val ?? ""}
                    onChange={(e) => handleInputChange(key as string, e.target.value, type)}
                    placeholder="—"
                  />
                </div>
              );
            })}
          </div>

          <div className="screenshot-actions">
            <button className="screenshot-cancel-btn" onClick={reset}>Cancel</button>
            <button className="screenshot-confirm-btn" onClick={handleCommit}>
              <CheckCircle size={15} />
              Confirm &amp; Save
            </button>
          </div>
        </div>
      )}

      {/* Saving */}
      {phase === "saving" && (
        <div className="screenshot-status-card">
          <Loader2 size={18} className="screenshot-spinner" />
          <span className="screenshot-status-text">Saving to KEWT...</span>
        </div>
      )}

      {/* Done */}
      {phase === "done" && (
        <div className="screenshot-status-card screenshot-done">
          <CheckCircle size={20} className="screenshot-done-icon" />
          <div>
            <p className="screenshot-status-text">
              {savedAction === "updated" ? "Entry updated" : "Entry saved"}
            </p>
            <p className="screenshot-review-hint">
              {dataType === "sleep" ? "Sleep log" : dataType === "body_comp" ? "Body composition" : "Activity"} written to KEWT.
            </p>
          </div>
          <button className="screenshot-retry-btn" onClick={reset}>
            <Upload size={14} />
          </button>
        </div>
      )}

      {/* Error */}
      {phase === "error" && (
        <div className="screenshot-status-card screenshot-error">
          <XCircle size={20} className="screenshot-error-icon" />
          <div>
            <p className="screenshot-status-text">Could not read screenshot</p>
            <p className="screenshot-review-hint">{errorMsg}</p>
          </div>
          <button className="screenshot-retry-btn" onClick={reset}>
            <RefreshCw size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
