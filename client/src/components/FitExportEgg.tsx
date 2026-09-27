import { localToday } from "@/lib/dateUtils";
/**
 * FIT Export Easter Egg
 * Triggered by typing "fit" on desktop (no input focused).
 * Plays a cinematic fake FIT export → stalls at 94% → reveals the gag →
 * offers a real BEI CSV download.
 */

import { useState, useEffect, useRef } from "react";
import { Download, FileDown, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// ── Types ──────────────────────────────────────────────────────────────────────
type Stage = "idle" | "loading" | "stall" | "reveal";

interface Props {
  open: boolean;
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function FitExportEgg({ open, onClose }: Props) {
  const [stage, setStage]       = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [exporting, setExporting] = useState(false);
  const rafRef  = useRef<number | null>(null);
  const startTs = useRef<number>(0);

  // Reset every time modal opens
  useEffect(() => {
    if (!open) return;
    setStage("loading");
    setProgress(0);
    startTs.current = performance.now();

    // Animate progress 0 → 94 over ~2.8s with an easeOutCubic curve, then stall
    const DURATION  = 2800;
    const TARGET    = 94;

    function tick(now: number) {
      const elapsed = now - startTs.current;
      const t       = Math.min(elapsed / DURATION, 1);
      const eased   = 1 - Math.pow(1 - t, 3);
      const p       = Math.round(eased * TARGET);
      setProgress(p);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setStage("stall");
        // After a dramatic 1.1s pause at 94%, reveal the gag
        setTimeout(() => setStage("reveal"), 1100);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [open]);

  // Clean up on close
  function handleClose() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setStage("idle");
    setProgress(0);
    onClose();
  }

  // Real BEI CSV export
  async function handleBEIExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/bei/export", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `KEWT_BEI_Export_${localToday()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      handleClose();
    } catch {
      // Silently close — user can retry
      handleClose();
    } finally {
      setExporting(false);
    }
  }

  if (!open) return null;

  // ── Bar fill width ──────────────────────────────────────────────────────────
  const barPct = stage === "reveal" ? 94 : progress;

  return (
    <div
      className="fit-egg-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(6,21,15,0.82)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "fitEggFadeIn 0.28s ease",
      }}
    >
      <div
        style={{
          background: "linear-gradient(160deg, #065f46 0%, #052e1e 100%)",
          border: "1px solid rgba(245,158,11,0.35)",
          borderRadius: 20,
          padding: "40px 44px 36px",
          maxWidth: 480,
          width: "calc(100% - 40px)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,158,11,0.08)",
          position: "relative",
          animation: "fitEggSlideUp 0.32s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: "absolute", top: 16, right: 16,
            background: "rgba(255,255,255,0.08)",
            border: "none", borderRadius: "50%",
            width: 30, height: 30, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          <X size={14} />
        </button>

        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: "rgba(245,158,11,0.15)",
          border: "1px solid rgba(245,158,11,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 20,
        }}>
          <FileDown size={24} color="#f59e0b" />
        </div>

        {/* Title */}
        <div style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 11, letterSpacing: "0.12em", fontWeight: 600,
          color: "rgba(245,158,11,0.75)", textTransform: "uppercase",
          marginBottom: 6,
        }}>
          {stage === "reveal" ? "FIT Export" : "FIT Export"}
        </div>

        <div style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 21, fontWeight: 700,
          color: "#faf9f6", marginBottom: 6, lineHeight: 1.2,
        }}>
          {stage === "loading" && "Compiling your biometric legacy..."}
          {stage === "stall"   && "Compiling your biometric legacy..."}
          {stage === "reveal"  && "Just kidding."}
        </div>

        {/* Sub-copy */}
        {(stage === "loading" || stage === "stall") && (
          <div style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 13, color: "rgba(250,249,246,0.55)",
            marginBottom: 28, lineHeight: 1.5,
          }}>
            Packaging HRV baselines, sleep layers, stress signatures,
            breathing cadence history, and BEI intelligence into .fit format...
          </div>
        )}

        {stage === "reveal" && (
          <div style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 13.5, color: "rgba(250,249,246,0.65)",
            marginBottom: 28, lineHeight: 1.6,
          }}>
            Your data already lives in Garmin. Sending it back there
            is not a feature — it is a circle.
            <br /><br />
            What <em>is</em> worth exporting is everything KEWT uniquely
            built: your BEI history, readiness trends, lifestyle baselines,
            and goal timelines. That data exists nowhere else.
          </div>
        )}

        {/* Progress bar */}
        <div style={{
          background: "rgba(255,255,255,0.08)",
          borderRadius: 99, height: 8, overflow: "hidden",
          marginBottom: 10,
        }}>
          <div style={{
            height: "100%",
            width: `${barPct}%`,
            background: stage === "reveal"
              ? "linear-gradient(90deg, #f59e0b, #fcd34d)"
              : "linear-gradient(90deg, #10b981, #34d399)",
            borderRadius: 99,
            transition: stage === "stall" ? "none" : "width 0.05s linear",
            boxShadow: stage === "reveal"
              ? "0 0 12px rgba(245,158,11,0.5)"
              : "0 0 12px rgba(52,211,153,0.4)",
          }} />
        </div>

        {/* Progress label */}
        <div style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 11, color: "rgba(250,249,246,0.35)",
          marginBottom: stage === "reveal" ? 28 : 0,
          display: "flex", justifyContent: "space-between",
        }}>
          <span>
            {stage === "reveal"
              ? "Stalled at 94% — intentionally."
              : `${barPct}% complete`}
          </span>
          {stage !== "reveal" && (
            <span style={{ color: "#10b981" }}>
              {barPct < 94 ? "exporting..." : "finalizing..."}
            </span>
          )}
        </div>

        {/* Reveal CTA */}
        {stage === "reveal" && (
          <button
            onClick={handleBEIExport}
            disabled={exporting}
            data-testid="button-bei-export"
            style={{
              width: "100%",
              background: exporting
                ? "rgba(245,158,11,0.4)"
                : "linear-gradient(135deg, #f59e0b, #d97706)",
              border: "none", borderRadius: 12,
              padding: "14px 20px",
              color: "#1c1917", fontFamily: "Inter, sans-serif",
              fontSize: 14, fontWeight: 700,
              cursor: exporting ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8,
              transition: "opacity 0.15s",
              boxShadow: "0 4px 20px rgba(245,158,11,0.35)",
            }}
          >
            <Download size={16} />
            {exporting ? "Preparing your file..." : "Download BEI Report instead"}
          </button>
        )}

        {/* BEI tagline */}
        {stage === "reveal" && (
          <div style={{
            textAlign: "center",
            fontFamily: "Inter, sans-serif",
            fontSize: 10.5, letterSpacing: "0.1em",
            color: "rgba(250,249,246,0.25)",
            marginTop: 16, textTransform: "uppercase",
          }}>
            Breathe. Reset. Return.
          </div>
        )}
      </div>

      <style>{`
        @keyframes fitEggFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes fitEggSlideUp {
          from { opacity: 0; transform: translateY(28px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}
