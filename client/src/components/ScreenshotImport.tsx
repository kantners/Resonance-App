import { useRef, useState } from "react";
import { Camera, CheckCircle, XCircle, Loader2, Upload, RefreshCw, Plus, X } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

// The Screen Time / Digital Wellbeing type is added with the exposure routes.
type DataType = "sleep";

// Only the fields Resonance uses: the Brief's inputs plus sleep context.
interface SleepData {
  date: string | null;
  hours: number | null;
  sleep_score: number | null;
  hrv: number | null;
  resting_hr: number | null;
}

type Phase = "idle" | "scanning" | "review" | "saving" | "done" | "error";

// ─── Field config ─────────────────────────────────────────────────────────────

const SLEEP_FIELDS: { key: keyof SleepData; label: string; type: "text" | "number" }[] = [
  { key: "date", label: "Wake date", type: "text" },
  { key: "hours", label: "Time asleep (h)", type: "number" },
  { key: "sleep_score", label: "Sleep score", type: "number" },
  { key: "hrv", label: "HRV (ms)", type: "number" },
  { key: "resting_hr", label: "Resting HR", type: "number" },
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
    formData.append("kind", "sleep");

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

  const activeFields = SLEEP_FIELDS;
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
          <p className="screenshot-dropzone-sub">A sleep summary from your watch or ring app.</p>
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
                  Sleep summary detected
                  <span style={{ marginLeft: "0.5rem", fontSize: "0.7rem", color: "var(--color-text-faint)", fontWeight: 500 }}>
                    {filledCount}/{activeFields.length} fields
                  </span>
                </p>
                <p className="screenshot-review-hint">
            {errorMsg ? <span className="text-alert">{errorMsg}</span> : "Edit any field, then confirm to save."}
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
          <span className="screenshot-status-text">Saving...</span>
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
              Sleep entry saved.
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
