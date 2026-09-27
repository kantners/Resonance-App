import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Sparkles, Download, RefreshCw, Copy, ChevronDown, ChevronUp, ImageIcon, Bookmark, Trash2, Calendar, ExternalLink, ListTree, Save } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
interface TickerItem { headline: string; body: string; }
interface IGPostResult {
  caption: string;
  hookLine: string;
  imageUrl: string;
  imageError?: string | null;
  headline: string;
  body: string;
  // Optional: server includes the auto-saved draft and today's usage when
  // generation succeeds. The route still works without these for older
  // clients; they are read defensively below.
  draftId?: number | null;
  draftEntry?: any;
  used?: number;
  limit?: number;
}
interface IgUsageProbe { used: number; limit: number; }
type DraftStatus = "draft" | "approved" | "scheduled" | "posted";
interface IgDraft {
  id: number;
  headline: string | null;
  body: string | null;
  hookLine: string | null;
  imageUrl: string | null;
  caption: string;
  status: DraftStatus;
  scheduledAt: string | null;
  postedAt: string | null;
  postedUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
.igp-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 0 16px 80px;
}
.igp-header {
  padding: 24px 0 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.igp-header-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--color-text);
  letter-spacing: -0.4px;
}
.igp-header-sub {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-top: 2px;
}
.igp-section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-faint);
  margin-bottom: 8px;
}
.igp-topic-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}
.igp-topic-item {
  background: var(--color-surface);
  border: 1.5px solid var(--color-border);
  border-radius: 12px;
  padding: 12px 14px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.igp-topic-item:hover { border-color: var(--color-primary); }
.igp-topic-item.selected {
  border-color: var(--color-primary);
  background: hsl(158 40% 96%);
}
[data-theme='dark'] .igp-topic-item.selected { background: hsl(158 30% 14%); }
.igp-topic-radio {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  flex-shrink: 0;
  margin-top: 2px;
  transition: border-color 0.15s, background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.igp-topic-item.selected .igp-topic-radio {
  border-color: var(--color-primary);
  background: var(--color-primary);
}
.igp-topic-radio-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: white;
  opacity: 0;
}
.igp-topic-item.selected .igp-topic-radio-dot { opacity: 1; }
.igp-topic-headline {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.3;
}
.igp-topic-body {
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
  margin-top: 3px;
}
.igp-gen-btn {
  width: 100%;
  padding: 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--color-primary), #059669);
  color: white;
  font-size: 15px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: opacity 0.2s, transform 0.15s;
  margin-bottom: 24px;
}
.igp-gen-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
.igp-gen-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.igp-gen-btn.spinning svg { animation: igp-spin 1s linear infinite; }
@keyframes igp-spin { to { transform: rotate(360deg); } }

/* ── Result card ── */
.igp-result {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  overflow: hidden;
  margin-bottom: 16px;
}
.igp-preview-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: #0a1a14;
  overflow: hidden;
}
.igp-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.igp-preview-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top,
    rgba(3,14,6,0.94) 0%,
    rgba(3,14,6,0.70) 30%,
    rgba(3,14,6,0.15) 60%,
    transparent 100%);
  pointer-events: none;
}
.igp-overlay-top {
  position: absolute;
  top: 16px;
  left: 18px;
  right: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.igp-overlay-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #f59e0b;
}
.igp-overlay-badge-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f59e0b;
  flex-shrink: 0;
}
.igp-overlay-badge-sep {
  color: rgba(255,255,255,0.5);
  font-size: 9px;
}
.igp-overlay-badge-ev {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.75);
  text-transform: uppercase;
}
.igp-overlay-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0 18px 16px;
}
.igp-overlay-rule {
  width: 28px;
  height: 3px;
  background: #f59e0b;
  margin-bottom: 10px;
  border-radius: 2px;
}
.igp-overlay-headline {
  font-size: clamp(20px, 5vw, 28px);
  font-weight: 900;
  color: white;
  line-height: 1.15;
  letter-spacing: -0.5px;
  margin-bottom: 8px;
}
.igp-overlay-body-text {
  font-size: 12px;
  color: rgba(255,255,255,0.82);
  line-height: 1.5;
  margin-bottom: 6px;
}
.igp-overlay-citation {
  font-size: 10px;
  color: rgba(255,255,255,0.5);
  margin-bottom: 14px;
}
.igp-overlay-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(255,255,255,0.12);
  padding-top: 10px;
}
.igp-overlay-footer-kewt {
  font-size: 13px;
  font-weight: 900;
  color: white;
  font-style: italic;
  letter-spacing: -0.5px;
}
.igp-overlay-footer-handle {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: rgba(255,255,255,0.7);
  font-weight: 600;
}
.igp-overlay-footer-handle-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #f59e0b;
}
.igp-overlay-footer-tagline {
  font-size: 10px;
  font-weight: 700;
  color: #f59e0b;
}

/* ── Caption section ── */
.igp-caption-wrap {
  padding: 16px;
}
.igp-caption-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-faint);
  margin-bottom: 8px;
}
.igp-caption-text {
  font-size: 13px;
  color: var(--color-text);
  line-height: 1.6;
  white-space: pre-wrap;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 12px;
  width: 100%;
  resize: vertical;
  font-family: inherit;
  min-height: 160px;
}
.igp-caption-text:focus { outline: none; border-color: var(--color-primary); }

/* ── Action row ── */
/* Grid layout guarantees equal-width columns that cannot exceed their
   slot. minmax(0,1fr) lets each column shrink below its content's
   intrinsic width, which a plain flex row would never do. */
.igp-actions {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  padding: 0 16px 16px;
}
.igp-action-btn {
  min-width: 0;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  transition: border-color 0.15s, background 0.15s;
}
.igp-action-btn > svg { flex-shrink: 0; }
.igp-action-btn:hover { border-color: var(--color-primary); }
.igp-action-btn.primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}
.igp-action-btn.primary:hover { opacity: 0.9; }

/* Two-label strategy: each button renders a full label and a short label
   side by side; CSS shows exactly one depending on viewport width. */
.igp-action-label {
  overflow: hidden;
  text-overflow: ellipsis;
}
.igp-label-short { display: none; }
.igp-label-full  { display: inline; }

@media (max-width: 480px) {
  .igp-actions { gap: 4px; padding: 0 8px 16px; }
  .igp-action-btn {
    padding: 8px 2px;
    font-size: 10px;
    gap: 3px;
    border-width: 1px;
    border-radius: 8px;
  }
  /* Shrink lucide icons via their width/height attributes (lucide
     renders sizes as inline width/height on the <svg>). Overriding via
     CSS forces the smaller box on mobile. */
  .igp-action-btn > svg { width: 12px; height: 12px; }
  .igp-label-full  { display: none; }
  .igp-label-short { display: inline; }
}
@media (max-width: 360px) {
  .igp-actions { gap: 3px; padding: 0 6px 16px; }
  .igp-action-btn { font-size: 9px; padding: 7px 1px; gap: 2px; }
  .igp-action-btn > svg { width: 11px; height: 11px; }
}

/* ── Placeholder state ── */
.igp-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 10px;
  background: var(--color-surface);
  border: 1.5px dashed var(--color-border);
  border-radius: 18px;
  margin-bottom: 16px;
  color: var(--color-text-muted);
  text-align: center;
}
.igp-placeholder-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: hsl(158 40% 94%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}
[data-theme='dark'] .igp-placeholder-icon { background: hsl(158 30% 14%); }

/* ── Copied toast ── */
.igp-copied {
  font-size: 12px;
  color: var(--color-primary);
  font-weight: 600;
  text-align: center;
  padding: 4px 0 8px;
}

/* ── Draft queue / planner ── */
.igp-queue {
  margin-top: 24px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  overflow: hidden;
}
.igp-queue-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  cursor: pointer;
  background: none;
  border: none;
  width: 100%;
  text-align: left;
  font-family: inherit;
  color: var(--color-text);
}
.igp-queue-header-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  flex: 1;
}
.igp-queue-header-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-bg);
  border-radius: 99px;
  padding: 2px 8px;
}
.igp-queue-body {
  padding: 0 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.igp-queue-empty {
  font-size: 12px;
  color: var(--color-text-faint);
  text-align: center;
  padding: 16px 8px 8px;
}
.igp-queue-banner {
  font-size: 11px;
  color: var(--color-text-muted);
  background: var(--color-bg);
  border-radius: 10px;
  padding: 8px 10px;
  margin-bottom: 4px;
  line-height: 1.4;
}
.igp-draft {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
}
.igp-draft-thumb {
  width: 56px; height: 56px;
  border-radius: 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
  object-fit: cover;
  display: flex; align-items: center; justify-content: center;
  color: var(--color-text-faint);
}
.igp-draft-main {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 4px;
}
.igp-draft-headline {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.igp-draft-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  font-size: 11px;
  color: var(--color-text-muted);
}
.igp-draft-status {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 99px;
  padding: 2px 8px;
}
.igp-draft-status--draft     { background: rgba(100,116,139,0.15); color: #475569; }
.igp-draft-status--approved  { background: rgba(245,158,11,0.15);  color: #92400e; }
.igp-draft-status--scheduled { background: rgba(59,130,246,0.15);  color: #1d4ed8; }
.igp-draft-status--posted    { background: rgba(16,185,129,0.18);  color: #065f46; }
[data-theme='dark'] .igp-draft-status--draft     { color: #cbd5e1; }
[data-theme='dark'] .igp-draft-status--approved  { color: #fbbf24; }
[data-theme='dark'] .igp-draft-status--scheduled { color: #93c5fd; }
[data-theme='dark'] .igp-draft-status--posted    { color: #6ee7b7; }
.igp-draft-actions {
  display: flex;
  gap: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}
.igp-draft-btn {
  font-size: 11px;
  font-weight: 600;
  border-radius: 8px;
  padding: 5px 9px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.igp-draft-btn--danger { color: #b91c1c; border-color: rgba(220,38,38,0.25); }
.igp-draft-input {
  width: 100%;
  font-size: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 6px 8px;
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  box-sizing: border-box;
}
.igp-draft-edit-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  margin-top: 6px;
}
.igp-no-access {
  max-width: 480px;
  margin: 80px auto;
  padding: 28px 22px;
  text-align: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  color: var(--color-text);
}
.igp-no-access-title {
  font-size: 16px; font-weight: 700; margin-bottom: 6px;
}
.igp-no-access-sub {
  font-size: 13px; color: var(--color-text-muted); line-height: 1.5;
}

/* ── Topic pool editor ── */
.igp-pool {
  margin-top: 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  overflow: hidden;
}
.igp-pool-header {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 12px 14px;
  background: none; border: none; cursor: pointer;
  text-align: left; font-family: inherit;
  color: var(--color-text);
}
.igp-pool-title {
  font-size: 13px; font-weight: 700; flex: 1; letter-spacing: -0.01em;
}
.igp-pool-count {
  font-size: 11px; font-weight: 600; color: var(--color-text-muted);
  background: var(--color-bg);
  border-radius: 99px; padding: 2px 8px;
}
.igp-pool-body { padding: 0 14px 14px; display: flex; flex-direction: column; gap: 8px; }
.igp-pool-help {
  font-size: 11px; color: var(--color-text-muted); line-height: 1.5;
}
.igp-pool-textarea {
  width: 100%;
  min-height: 220px;
  resize: vertical;
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  box-sizing: border-box;
  outline: none;
}
.igp-pool-textarea:focus { border-color: var(--color-primary); }
.igp-pool-actions { display: flex; gap: 8px; align-items: center; }
.igp-pool-btn {
  font-size: 12px; font-weight: 700;
  padding: 7px 12px; border-radius: 9px; cursor: pointer;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  display: inline-flex; align-items: center; gap: 5px;
}
.igp-pool-btn--primary {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}
.igp-pool-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.igp-pool-status { font-size: 11px; color: var(--color-text-faint); margin-left: auto; }
.igp-pool-status--err { color: #b91c1c; }
.igp-pool-status--ok  { color: #047857; }
[data-theme='dark'] .igp-pool-status--err { color: #fca5a5; }
[data-theme='dark'] .igp-pool-status--ok  { color: #6ee7b7; }

/* ── Topic Manager ── */
.igp-tm { margin-top: 8px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 14px; overflow: hidden; }
.igp-tm-header { display: flex; align-items: center; gap: 8px; width: 100%; padding: 12px 14px; background: none; border: none; cursor: pointer; text-align: left; font-family: inherit; color: var(--color-text); }
.igp-tm-title { font-size: 13px; font-weight: 700; flex: 1; letter-spacing: -0.01em; }
.igp-tm-count { font-size: 11px; font-weight: 600; color: var(--color-text-muted); background: var(--color-bg); border-radius: 99px; padding: 2px 8px; }
.igp-tm-body { padding: 0 14px 14px; display: flex; flex-direction: column; gap: 6px; }
.igp-tm-add { display: flex; flex-direction: column; gap: 6px; background: var(--color-bg); border-radius: 10px; padding: 10px 12px; border: 1px solid var(--color-border); margin-bottom: 4px; }
.igp-tm-add-row { display: flex; gap: 6px; }
.igp-tm-input { flex: 1; font-size: 12px; border: 1px solid var(--color-border); border-radius: 8px; padding: 6px 8px; background: var(--color-surface); color: var(--color-text); font-family: inherit; outline: none; }
.igp-tm-input:focus { border-color: var(--color-primary); }
.igp-tm-add-btn { font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 8px; border: none; background: var(--color-primary); color: #fff; cursor: pointer; white-space: nowrap; }
.igp-tm-add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.igp-tm-list { display: flex; flex-direction: column; gap: 4px; max-height: 340px; overflow-y: auto; }
.igp-tm-row { display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 12px; }
.igp-tm-row-info { flex: 1; min-width: 0; }
.igp-tm-row-headline { font-weight: 700; color: var(--color-text); line-height: 1.3; }
.igp-tm-row-domain { font-size: 10px; font-weight: 600; color: var(--color-primary); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 1px; }
.igp-tm-row-meta { font-size: 10px; color: var(--color-text-faint); margin-top: 2px; }
.igp-tm-row-toggle { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; border: 1px solid var(--color-border); background: transparent; cursor: pointer; color: var(--color-text-muted); white-space: nowrap; }
`;

// ── Branded image compositing ─────────────────────────────────────────────
// Bakes the headline/rule/footer overlay (previously only a CSS preview
// effect) directly into a new image file, so Share and Download actually
// carry the branding instead of just the bare AI-generated photo.
function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load source image"));
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sw = img.width, sh = img.height, sx = 0, sy = 0;
  if (imgRatio > boxRatio) {
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

async function composeBrandedImage(result: IGPostResult, slide: 1 | 2 = 1): Promise<Blob> {
  const SIZE = 1080;
  const PAD = 46;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported in this browser");

  // Both slides share the same photo — one AI image, two text treatments —
  // for visual continuity across the carousel without a second image-gen
  // call.
  const img = await loadImageEl(result.imageUrl);
  drawCover(ctx, img, SIZE, SIZE);

  const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
  grad.addColorStop(0, "rgba(3,14,6,0)");
  grad.addColorStop(0.42, "rgba(3,14,6,0.15)");
  grad.addColorStop(0.72, "rgba(3,14,6,0.72)");
  grad.addColorStop(1, "rgba(3,14,6,0.95)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Top badge row
  ctx.textBaseline = "middle";
  const topY = 66;
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(PAD + 7, topY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "800 23px Inter, -apple-system, sans-serif";
  ctx.fillStyle = "#f59e0b";
  const badgeLabel = slide === 1 ? "BEI SCIENCE" : "THE FULL PICTURE";
  ctx.fillText(badgeLabel, PAD + 22, topY);
  const badgeW = ctx.measureText(badgeLabel).width;
  if (slide === 1) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("·", PAD + 22 + badgeW + 16, topY);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fillText("EVIDENCE-BASED", PAD + 22 + badgeW + 34, topY);
  }

  // Page-dot indicator, top-right — mirrors Instagram's own carousel dots
  // so the first slide visually signals "swipe for more" before anyone
  // even taps in.
  const dotR = 6, dotGap = 18;
  const dotsX = SIZE - PAD - dotR;
  for (let i = 0; i < 2; i++) {
    const active = i === slide - 1;
    ctx.beginPath();
    ctx.arc(dotsX - (1 - i) * dotGap, topY, dotR, 0, Math.PI * 2);
    ctx.fillStyle = active ? "#f59e0b" : "rgba(255,255,255,0.35)";
    ctx.fill();
  }

  // Bottom text block
  ctx.textBaseline = "alphabetic";
  const maxTextWidth = SIZE - PAD * 2;

  if (slide === 1) {
    // ── Slide 1: hook — large headline, short truncated body ──
    const headlineFont = "900 54px Inter, -apple-system, sans-serif";
    const bodyFont = "400 25px Inter, -apple-system, sans-serif";

    ctx.font = headlineFont;
    const headlineLines = wrapCanvasText(ctx, result.headline || result.hookLine || "", maxTextWidth);

    ctx.font = bodyFont;
    const rawBody = result.body || "";
    const bodyClipped = rawBody.length > 140 ? `${rawBody.slice(0, 140)}…` : rawBody;
    const bodyLines = bodyClipped ? wrapCanvasText(ctx, bodyClipped, maxTextWidth) : [];

    const ruleH = 8, ruleGap = 22, headlineLH = 60, gapAfterHeadline = 18, bodyLH = 34, gapAfterBody = 20, sepGap = 22, footerH = 30, bottomPad = 52;
    const blockHeight = ruleH + ruleGap + headlineLines.length * headlineLH +
      (bodyLines.length ? gapAfterHeadline + bodyLines.length * bodyLH : 0) +
      gapAfterBody + sepGap + footerH;

    let y = SIZE - bottomPad - blockHeight;
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(PAD, y, 66, ruleH);
    y += ruleH + ruleGap;

    ctx.font = headlineFont;
    ctx.fillStyle = "#ffffff";
    for (const line of headlineLines) { ctx.fillText(line, PAD, y + headlineLH * 0.72); y += headlineLH; }

    if (bodyLines.length) {
      y += gapAfterHeadline;
      ctx.font = bodyFont;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (const line of bodyLines) { ctx.fillText(line, PAD, y + bodyLH * 0.7); y += bodyLH; }
    }
    y += gapAfterBody;

    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(SIZE - PAD, y); ctx.stroke();
    y += sepGap;

    drawFooter(ctx, PAD, SIZE, y);
  } else {
    // ── Slide 2: detail — smaller eyebrow headline, full untruncated body ──
    const eyebrowFont = "800 26px Inter, -apple-system, sans-serif";
    const bodyFont = "400 30px Inter, -apple-system, sans-serif";

    ctx.font = eyebrowFont;
    const eyebrowLines = wrapCanvasText(ctx, result.headline || result.hookLine || "", maxTextWidth);

    ctx.font = bodyFont;
    const fullBody = result.body || "";
    const bodyLines = fullBody ? wrapCanvasText(ctx, fullBody, maxTextWidth) : [];

    const ruleH = 8, ruleGap = 20, eyebrowLH = 34, gapAfterEyebrow = 20, bodyLH = 40, gapAfterBody = 22, sepGap = 22, footerH = 30, bottomPad = 52;
    const blockHeight = ruleH + ruleGap + eyebrowLines.length * eyebrowLH + gapAfterEyebrow +
      bodyLines.length * bodyLH + gapAfterBody + sepGap + footerH;

    let y = Math.max(220, SIZE - bottomPad - blockHeight);
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(PAD, y, 66, ruleH);
    y += ruleH + ruleGap;

    ctx.font = eyebrowFont;
    ctx.fillStyle = "#f59e0b";
    for (const line of eyebrowLines) { ctx.fillText(line, PAD, y + eyebrowLH * 0.72); y += eyebrowLH; }
    y += gapAfterEyebrow;

    ctx.font = bodyFont;
    ctx.fillStyle = "#ffffff";
    for (const line of bodyLines) { ctx.fillText(line, PAD, y + bodyLH * 0.7); y += bodyLH; }
    y += gapAfterBody;

    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(SIZE - PAD, y); ctx.stroke();
    y += sepGap;

    drawFooter(ctx, PAD, SIZE, y);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not export composed image"))),
      "image/jpeg",
      0.92
    );
  });
}

// Shared footer row: "KEWT ● @handle ......... Breathe. Reset. Return."
// Drawn identically on both slides so the carousel reads as one cohesive
// branded set rather than two unrelated images.
function drawFooter(ctx: CanvasRenderingContext2D, PAD: number, SIZE: number, y: number) {
  const footerBaseline = y + 22;
  ctx.font = "italic 900 27px Inter, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("KEWT", PAD, footerBaseline);
  const kewtW = ctx.measureText("KEWT").width;

  ctx.font = "600 21px Inter, -apple-system, sans-serif";
  const dotX = PAD + kewtW + 18;
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(dotX, footerBaseline - 7, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("@blueemberwellnessrva", dotX + 12, footerBaseline);

  ctx.font = "700 22px Inter, -apple-system, sans-serif";
  ctx.fillStyle = "#f59e0b";
  const tag = "Breathe. Reset. Return.";
  const tagW = ctx.measureText(tag).width;
  ctx.fillText(tag, SIZE - PAD - tagW, footerBaseline);
}


export default function IGPostGenerator() {
  const qc = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<TickerItem | null>(null);
  const [result, setResult] = useState<IGPostResult | null>(null);
  const [caption, setCaption] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState<number | null>(null);
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);

  // Inject CSS
  if (typeof document !== "undefined" && !document.getElementById("kewt-igp-css")) {
    const el = document.createElement("style");
    el.id = "kewt-igp-css";
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  // Access gate. Server is the source of truth. If the probe says no,
  // render the friendly "not enabled" panel instead of the generator.
  const { data: igAccess, isLoading: accessLoading } = useQuery<{ ok: boolean }>({
    queryKey: ["/api/me/ig-access"],
    staleTime: 5 * 60 * 1000,
  });

  // Fetch today's ticker items
  const { data: tickerData } = useQuery<{ items: string } | null>({
    queryKey: ["/api/science-ticker"],
    staleTime: 5 * 60 * 1000,
    enabled: igAccess?.ok === true,
  });

  // Drafts queue
  const { data: drafts = [] } = useQuery<IgDraft[]>({
    queryKey: ["/api/ig-drafts"],
    enabled: igAccess?.ok === true,
  });

  const saveDraftMut = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error("No generated post to save");
      return apiRequest("POST", "/api/ig-drafts", {
        headline: result.headline,
        body: result.body,
        hookLine: result.hookLine,
        imageUrl: result.imageUrl,
        caption,
        status: "draft",
      });
    },
    onSuccess: (row: any) => {
      qc.invalidateQueries({ queryKey: ["/api/ig-drafts"] });
      setSavedDraftId(row?.id ?? null);
      setQueueOpen(true);
      setTimeout(() => setSavedDraftId(null), 4000);
    },
  });

  const updateDraftMut = useMutation({
    mutationFn: async (vars: { id: number; patch: Partial<IgDraft> }) =>
      apiRequest("PATCH", `/api/ig-drafts/${vars.id}`, vars.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/ig-drafts"] }),
  });

  const deleteDraftMut = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/ig-drafts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/ig-drafts"] }),
  });

  const reopenDraft = (d: IgDraft) => {
    setResult({
      caption: d.caption,
      hookLine: d.hookLine ?? "",
      imageUrl: d.imageUrl ?? "",
      headline: d.headline ?? "",
      body: d.body ?? "",
    });
    setCaption(d.caption);
    setSelectedItem(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // /api/science-ticker returns a plain array directly, e.g.
  // [{headline, body}, ...] — it is NOT wrapped in an { items: ... }
  // object, and it is not pre-stringified. The previous version here
  // looked for tickerData.items or tickerData[0].items, neither of which
  // ever existed on the real response shape, so tickerItems was silently
  // empty every single time regardless of what was actually in the
  // database — which in turn hid the entire topic list AND the Generate
  // button below, since both were gated behind tickerItems.length > 0.
  const tickerItems: TickerItem[] = Array.isArray(tickerData) ? (tickerData as any) : [];

  const visibleItems = showAllTopics ? tickerItems : tickerItems.slice(0, 3);

  // Today's generation usage. 10/day cap is enforced server-side; this
  // probe just lets the UI show "x of 10 used today" and disable Generate
  // when at the cap.
  const { data: usage } = useQuery<IgUsageProbe>({
    queryKey: ["/api/ig-drafts/today-count"],
    enabled: igAccess?.ok === true,
    staleTime: 30 * 1000,
  });
  const used = usage?.used ?? 0;
  const limit = usage?.limit ?? 10;

  // ── Topic pool editor ────────────────────────────────────────────────
  // Renders today's science_ticker items as one "Headline | Body" line per
  // topic. Saving writes back to the shared science_ticker row for today,
  // so Generate uses the new pool the next time it picks at random.
  const [poolOpen, setPoolOpen] = useState(false);
  const [poolText, setPoolText] = useState<string>("");
  const [poolStatus, setPoolStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  type Pool = { date: string; items: { headline: string; body: string }[]; stale?: boolean };
  const { data: poolData } = useQuery<Pool>({
    queryKey: ["/api/ig-topic-pool"],
    enabled: igAccess?.ok === true,
    staleTime: 30 * 1000,
  });

  const serializePool = (items: { headline: string; body: string }[]) =>
    items.map(i => i.body ? `${i.headline} | ${i.body}` : i.headline).join("\n");

  // Seed editor when data arrives or user opens the panel.
  useEffect(() => {
    if (poolData && !poolText) setPoolText(serializePool(poolData.items ?? []));
  }, [poolData]); // eslint-disable-line react-hooks/exhaustive-deps

  const savePoolMut = useMutation({
    mutationFn: async () => {
      const parsed = poolText
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
          const idx = line.indexOf("|");
          if (idx === -1) return { headline: line, body: "" };
          return { headline: line.slice(0, idx).trim(), body: line.slice(idx + 1).trim() };
        });
      return apiRequest("PUT", "/api/ig-topic-pool", { items: parsed }) as Promise<Pool>;
    },
    onSuccess: (data) => {
      setPoolText(serializePool(data.items));
      setPoolStatus({ kind: "ok", msg: `Saved ${data.items.length} topics` });
      qc.invalidateQueries({ queryKey: ["/api/ig-topic-pool"] });
      qc.invalidateQueries({ queryKey: ["/api/science-ticker"] });
      setTimeout(() => setPoolStatus(null), 4000);
    },
    onError: (e: any) => {
      const raw = e?.message ?? "Save failed";
      let msg = raw;
      try {
        const body = raw.replace(/^\d+:\s*/, "");
        const parsed = JSON.parse(body);
        if (parsed?.error) msg = parsed.error;
      } catch { /* keep raw */ }
      setPoolStatus({ kind: "err", msg });
    },
  });

  const resetPool = () => {
    if (poolData) setPoolText(serializePool(poolData.items ?? []));
    setPoolStatus(null);
  };
  const atLimit = used >= limit;

  // ── Topic Manager (ig_topics table) ──────────────────────────────────
  const [tmOpen, setTmOpen] = useState(false);
  const [tmDomain, setTmDomain] = useState("metabolic");
  const [tmHeadline, setTmHeadline] = useState("");
  const [tmBody, setTmBody] = useState("");
  const [tmStatus, setTmStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const { data: igTopicsData, refetch: refetchTopics } = useQuery<{ topics: any[]; total: number }>({
    queryKey: ["/api/ig-topics"],
    enabled: igAccess?.ok === true && tmOpen,
    staleTime: 30 * 1000,
  });
  const igTopics = igTopicsData?.topics ?? [];

  const addTopicMut = useMutation({
    mutationFn: async () => {
      if (!tmHeadline.trim()) throw new Error("Headline required");
      return apiRequest("POST", "/api/ig-topics", {
        domain: tmDomain,
        headline: tmHeadline.trim(),
        body: tmBody.trim(),
      });
    },
    onSuccess: () => {
      setTmHeadline("");
      setTmBody("");
      setTmStatus({ kind: "ok", msg: "Topic added ✓" });
      refetchTopics();
      setTimeout(() => setTmStatus(null), 3000);
    },
    onError: (e: any) => setTmStatus({ kind: "err", msg: e?.message ?? "Failed" }),
  });

  const toggleTopicMut = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) =>
      apiRequest("PATCH", `/api/ig-topics/${id}`, { active }),
    onSuccess: () => refetchTopics(),
  });

  // Surface a server-rejection message (e.g. the 429 daily-cap response)
  // without adding a toast dependency on this page.
  const [genError, setGenError] = useState<string | null>(null);

  // Generate mutation
  const genMut = useMutation({
    mutationFn: async (topic: TickerItem | null) => {
      setGenError(null);
      const payload = topic
        ? { headline: topic.headline, body: topic.body }
        : {};
      return apiRequest("POST", "/api/generate-ig-post", payload) as Promise<IGPostResult>;
    },
    onSuccess: (data: IGPostResult) => {
      setResult(data);
      setCaption(data.caption);
      // Refresh usage so the counter ticks up immediately and the draft
      // queue picks up the new auto-saved draft.
      qc.invalidateQueries({ queryKey: ["/api/ig-drafts/today-count"] });
      qc.invalidateQueries({ queryKey: ["/api/ig-drafts"] });
    },
    onError: (e: any) => {
      // apiRequest throws Error("STATUS: BODY"). Pull out the server
      // message so the user sees the friendly cap text on 429.
      const raw = e?.message ?? "";
      let msg = raw;
      try {
        const body = raw.replace(/^\d+:\s*/, "");
        const parsed = JSON.parse(body);
        if (parsed?.error) msg = parsed.error;
      } catch { /* fall back to raw */ }
      setGenError(msg);
      // Refresh count in case server rejected because cap was reached.
      qc.invalidateQueries({ queryKey: ["/api/ig-drafts/today-count"] });
    },
  });

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [compositeError, setCompositeError] = useState(false);

  // Builds both carousel slides, falling back to the single bare photo
  // (once, not twice) if compositing fails for any reason.
  const buildCarouselBlobs = async (result: IGPostResult): Promise<Blob[]> => {
    try {
      const [slide1, slide2] = await Promise.all([
        composeBrandedImage(result, 1),
        composeBrandedImage(result, 2),
      ]);
      setCompositeError(false);
      return [slide1, slide2];
    } catch {
      setCompositeError(true);
      const resp = await fetch(result.imageUrl);
      const blob = await resp.blob();
      return [blob];
    }
  };

  const handleDownloadImage = async () => {
    if (!result?.imageUrl) return;
    const blobs = await buildCarouselBlobs(result);
    blobs.forEach((blob, i) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = blobs.length > 1 ? `kewt-ig-post-${Date.now()}-slide${i + 1}.jpg` : `kewt-ig-post-${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  // Uses the browser's native Web Share API (built into modern mobile
  // Chrome and Safari — no Capacitor plugin, no native rebuild needed).
  // Sharing multiple image files at once is what lets Instagram's own
  // share-sheet extension offer them as a carousel candidate instead of
  // a single post — this is a real OS-level multi-file share, not a
  // KEWT-specific trick. Instagram's share extension does not accept a
  // pre-filled caption either way, so: copy the caption first, share the
  // slides, paste once inside Instagram. Falls back to a plain download
  // if the current browser doesn't support sharing files at all.
  const [shareUnsupported, setShareUnsupported] = useState(false);
  const handleShareImage = async () => {
    if (!result?.imageUrl) return;
    try {
      const blobs = await buildCarouselBlobs(result);
      const files = blobs.map((blob, i) =>
        new File([blob], `kewt-ig-post-${Date.now()}-${i + 1}.jpg`, { type: blob.type || "image/jpeg" })
      );
      const canShareFiles = typeof navigator.canShare === "function" && navigator.canShare({ files });
      if (canShareFiles) {
        await navigator.share({ files, title: result.headline || "KEWT" });
        return;
      }
    } catch (e: any) {
      // AbortError just means the person closed the share sheet — not a
      // real failure, nothing to do.
      if (e?.name === "AbortError") return;
    }
    // Unsupported browser or something went wrong — fall back to plain
    // downloads and let them know why via a one-time inline hint.
    setShareUnsupported(true);
    handleDownloadImage();
  };

  const handleRegenerate = () => {
    setResult(null);
    setCaption("");
    // Clear the previously-tapped chip so Regenerate truly re-randomizes
    // from the server pool instead of replaying the same headline.
    setSelectedItem(null);
    genMut.mutate(null);
  };

  // Tapping a topic now generates immediately — no separate Generate
  // button in between. Selecting IS generating.
  const handleSelectTopic = (item: TickerItem) => {
    setSelectedItem(item);
    genMut.mutate(item);
  };

  const handleGenerateRandom = () => {
    setSelectedItem(null);
    genMut.mutate(null);
  };

  if (accessLoading) {
    return <div className="igp-page" />;
  }
  if (!igAccess?.ok) {
    return (
      <div className="igp-page">
        <div className="igp-no-access">
          <div className="igp-no-access-title">Post Generator is locked</div>
          <div className="igp-no-access-sub">
            This area is reserved for the Blue Ember Wellness brand owners. If you reached this page by accident, head back to the dashboard.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="igp-page">
      {/* Header */}
      <div className="igp-header">
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: "linear-gradient(135deg, var(--color-primary), #f59e0b)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Sparkles size={18} color="white" />
        </div>
        <div>
          <div className="igp-header-title">Post Generator</div>
          <div className="igp-header-sub">BEI science → branded Instagram post</div>
        </div>
      </div>

      {/* Topic picker chips — only shown when there's actual daily-ticker
          data to pick from. This being empty must never hide the Generate
          button below; that's the exact bug that made the page look
          completely broken. */}
      {tickerItems.length > 0 && !result && (
        <>
          <div className="igp-section-label">Tap a topic to generate — or let KEWT pick one</div>
          <div className="igp-topic-list">
            {visibleItems.map((item, i) => (
              <div
                key={i}
                className={`igp-topic-item${selectedItem?.headline === item.headline && genMut.isPending ? " selected" : ""}`}
                onClick={() => { if (!genMut.isPending && !atLimit) handleSelectTopic(item); }}
                style={{ opacity: genMut.isPending && selectedItem?.headline !== item.headline ? 0.5 : 1, cursor: atLimit ? "not-allowed" : "pointer" }}
              >
                <div className="igp-topic-radio">
                  <div className="igp-topic-radio-dot" />
                </div>
                <div>
                  <div className="igp-topic-headline">{item.headline}</div>
                  <div className="igp-topic-body">{item.body.slice(0, 90)}{item.body.length > 90 ? "…" : ""}</div>
                </div>
              </div>
            ))}
          </div>
          {tickerItems.length > 3 && (
            <button
              onClick={() => setShowAllTopics(v => !v)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--color-primary)", fontSize: 12, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 4,
                marginBottom: 16, padding: 0,
              }}
            >
              {showAllTopics ? <><ChevronUp size={14} /> Show fewer</> : <><ChevronDown size={14} /> Show all {tickerItems.length} topics</>}
            </button>
          )}
        </>
      )}

      {/* Generate button — always available whenever there's no result yet,
          independent of whether the daily ticker chips above have any
          data. The server picks a topic on its own (ig_topics rotation,
          falling back to science_ticker) whenever no specific topic is
          passed, so this button works regardless of tickerItems. */}
      {!result && (
        <>
          {tickerItems.length === 0 && (
            <div className="igp-section-label">No quick-pick topics today — generate from the rotating pool instead</div>
          )}
          <button
            className={`igp-gen-btn${genMut.isPending && !selectedItem ? " spinning" : ""}`}
            onClick={handleGenerateRandom}
            disabled={genMut.isPending || atLimit}
          >
            {genMut.isPending && !selectedItem
              ? <><RefreshCw size={16} /> Generating…</>
              : <><Sparkles size={16} /> {atLimit ? "Daily limit reached" : "Generate from a random topic"}</>}
          </button>

          <div style={{ fontSize: 11, color: "var(--color-text-faint)", textAlign: "center", marginTop: -14, marginBottom: 20 }}>
            {used} of {limit} generated today
          </div>
        </>
      )}

      {/* Generating placeholder — shown while a tapped topic is in flight */}
      {genMut.isPending && selectedItem && (
        <div className="igp-placeholder">
          <div className="igp-placeholder-icon"><RefreshCw size={20} style={{ animation: "igp-spin 1s linear infinite" }} /></div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Generating your post…</div>
          <div style={{ fontSize: 12 }}>{selectedItem.headline}</div>
        </div>
      )}

      {/* Error state */}
      {genError && !result && (
        <div className="igp-placeholder" style={{ borderColor: "#ef4444", color: "#b91c1c" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Couldn't generate</div>
          <div style={{ fontSize: 12 }}>{genError}</div>
        </div>
      )}

      {/* ── Result card ─────────────────────────────────────────────────── */}
      {result && (
        <div className="igp-result">
          <div className="igp-preview-wrap">
            {result.imageUrl ? (
              <img className="igp-preview-img" src={result.imageUrl} alt="" />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)" }}>
                <ImageIcon size={32} />
              </div>
            )}
            <div className="igp-preview-overlay" />
            <div className="igp-overlay-top">
              <div className="igp-overlay-badge">
                <span className="igp-overlay-badge-dot" />
                BEI SCIENCE
              </div>
              <span className="igp-overlay-badge-sep">·</span>
              <span className="igp-overlay-badge-ev">EVIDENCE-BASED</span>
            </div>
            <div className="igp-overlay-bottom">
              <div className="igp-overlay-rule" />
              <div className="igp-overlay-headline">{result.headline || result.hookLine}</div>
              {result.body && <div className="igp-overlay-body-text">{result.body.slice(0, 140)}{result.body.length > 140 ? "…" : ""}</div>}
              <div className="igp-overlay-footer">
                <span className="igp-overlay-footer-kewt">KEWT</span>
                <span className="igp-overlay-footer-handle">
                  <span className="igp-overlay-footer-handle-dot" />
                  @blueemberwellnessrva
                </span>
                <span className="igp-overlay-footer-tagline">Breathe. Reset. Return.</span>
              </div>
            </div>
          </div>
          {result.imageError && (
            <div style={{ padding: "8px 16px 0", fontSize: 11, color: "#b91c1c" }}>
              Image generation issue: {result.imageError}
            </div>
          )}

          <div className="igp-caption-wrap">
            <div className="igp-caption-label">Caption — editable before you post</div>
            <textarea
              className="igp-caption-text"
              value={caption}
              onChange={e => setCaption(e.target.value)}
            />
            {copied && <div className="igp-copied">Copied to clipboard ✓</div>}
            {savedDraftId != null && <div className="igp-copied">Saved to Draft Queue ✓</div>}
          </div>

          <div style={{ fontSize: 11, color: "var(--color-text-faint)", textAlign: "center", padding: "0 16px 6px" }}>
            Builds a 2-slide set (hook + full detail) — copy your caption first, Instagram's share sheet won't accept a pre-filled one.
          </div>
          {compositeError && (
            <div style={{ fontSize: 11, color: "#b91c1c", textAlign: "center", padding: "0 16px 6px" }}>
              Couldn't bake the branded overlay into this image — shared/downloaded the plain photo instead.
            </div>
          )}
          {shareUnsupported && (
            <div style={{ fontSize: 11, color: "#b91c1c", textAlign: "center", padding: "0 16px 6px" }}>
              Sharing isn't supported in this browser — downloaded the image instead.
            </div>
          )}
          <div className="igp-actions">
            <button className="igp-action-btn primary" onClick={handleShareImage} disabled={!result.imageUrl}>
              <ExternalLink size={14} />
              <span className="igp-action-label"><span className="igp-label-full">Share Carousel</span><span className="igp-label-short">Share</span></span>
            </button>
            <button className="igp-action-btn" onClick={handleCopyCaption}>
              <Copy size={14} />
              <span className="igp-action-label"><span className="igp-label-full">Copy Caption</span><span className="igp-label-short">Copy</span></span>
            </button>
            <button className="igp-action-btn" onClick={handleDownloadImage} disabled={!result.imageUrl}>
              <Download size={14} />
              <span className="igp-action-label"><span className="igp-label-full">Download Image</span><span className="igp-label-short">Save</span></span>
            </button>
            <button className="igp-action-btn" onClick={() => saveDraftMut.mutate()} disabled={saveDraftMut.isPending}>
              <Bookmark size={14} />
              <span className="igp-action-label"><span className="igp-label-full">{saveDraftMut.isPending ? "Saving…" : "Save Draft"}</span><span className="igp-label-short">Save</span></span>
            </button>
            <button className="igp-action-btn" onClick={handleRegenerate} disabled={genMut.isPending || atLimit}>
              <RefreshCw size={14} style={genMut.isPending ? { animation: "igp-spin 1s linear infinite" } : undefined} />
              <span className="igp-action-label"><span className="igp-label-full">Regenerate</span><span className="igp-label-short">Redo</span></span>
            </button>
          </div>
        </div>
      )}

      {/* ── Topic Manager (ig_topics permanent pool) ───────────────────── */}
      <div className="igp-tm">
        <button
          type="button"
          className="igp-tm-header"
          onClick={() => setTmOpen(o => !o)}
          aria-expanded={tmOpen}
        >
          <ListTree size={14} />
          <span className="igp-tm-title">Topic Manager</span>
          <span className="igp-tm-count">{igTopicsData?.total ?? "—"} topics</span>
          {tmOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {tmOpen && (
          <div className="igp-tm-body">
            <div className="igp-tm-add">
              <div className="igp-tm-add-row">
                <select
                  className="igp-tm-input"
                  value={tmDomain}
                  onChange={e => setTmDomain(e.target.value)}
                  style={{ maxWidth: 160 }}
                >
                  {["metabolic","cardiovascular","recovery","sleep","breathwork","energy_medicine","longevity","nutrition","biomechanics","biomarkers"].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <input
                  className="igp-tm-input"
                  placeholder="Headline *"
                  value={tmHeadline}
                  onChange={e => setTmHeadline(e.target.value)}
                />
              </div>
              <input
                className="igp-tm-input"
                placeholder="Body — science detail (optional but recommended)"
                value={tmBody}
                onChange={e => setTmBody(e.target.value)}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  className="igp-tm-add-btn"
                  onClick={() => addTopicMut.mutate()}
                  disabled={addTopicMut.isPending || !tmHeadline.trim()}
                >
                  {addTopicMut.isPending ? "Adding…" : "+ Add Topic"}
                </button>
                {tmStatus && (
                  <span className={`igp-pool-status igp-pool-status--${tmStatus.kind}`}>{tmStatus.msg}</span>
                )}
              </div>
            </div>
            <div className="igp-tm-list">
              {igTopics.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--color-text-faint)", padding: "8px 0" }}>Loading topics…</div>
              ) : (
                igTopics.map((t: any) => (
                  <div key={t.id} className="igp-tm-row" style={{ opacity: t.active ? 1 : 0.45 }}>
                    <div className="igp-tm-row-info">
                      <div className="igp-tm-row-headline">{t.headline}</div>
                      <div className="igp-tm-row-domain">{t.domain}</div>
                      <div className="igp-tm-row-meta">
                        Used {t.use_count}x
                        {t.last_used_at ? ` · Last: ${new Date(t.last_used_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : " · Never used"}
                      </div>
                    </div>
                    <button
                      className="igp-tm-row-toggle"
                      onClick={() => toggleTopicMut.mutate({ id: t.id, active: !t.active })}
                    >
                      {t.active ? "Disable" : "Enable"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
            {/* ── Draft queue / planner ───────────────────────────────────────── */}
      <div className="igp-queue">
        <button
          type="button"
          className="igp-queue-header"
          onClick={() => setQueueOpen(o => !o)}
          aria-expanded={queueOpen}
        >
          <Bookmark size={14} />
          <span className="igp-queue-header-title">Draft Queue</span>
          <span className="igp-queue-header-count">{drafts.length}</span>
          {queueOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {queueOpen && (
          <div className="igp-queue-body">
            <div className="igp-queue-banner">
              Direct Instagram publishing is not connected yet. Use the queue to plan, schedule, and track posts you publish manually.
            </div>
            {drafts.length === 0 ? (
              <div className="igp-queue-empty">No drafts yet. Generate a post and tap Save Draft to start your queue.</div>
            ) : (
              drafts.map(d => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  editing={editingDraftId === d.id}
                  onToggleEdit={() => setEditingDraftId(editingDraftId === d.id ? null : d.id)}
                  onReopen={() => reopenDraft(d)}
                  onUpdate={(patch) => updateDraftMut.mutate({ id: d.id, patch })}
                  onDelete={() => deleteDraftMut.mutate(d.id)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Draft Row ────────────────────────────────────────────────────────────────
function DraftRow({
  draft, editing, onToggleEdit, onReopen, onUpdate, onDelete,
}: {
  draft: IgDraft;
  editing: boolean;
  onToggleEdit: () => void;
  onReopen: () => void;
  onUpdate: (patch: Partial<IgDraft>) => void;
  onDelete: () => void;
}) {
  const [scheduledLocal, setScheduledLocal] = useState(() =>
    draft.scheduledAt ? new Date(draft.scheduledAt).toISOString().slice(0, 16) : ""
  );
  const [notes, setNotes] = useState(draft.notes ?? "");
  const [postedUrl, setPostedUrl] = useState(draft.postedUrl ?? "");

  const cycleStatus = () => {
    const order: DraftStatus[] = ["draft", "approved", "scheduled", "posted"];
    const idx = order.indexOf(draft.status);
    const next = order[(idx + 1) % order.length];
    onUpdate({ status: next, ...(next === "posted" && !draft.postedAt ? { postedAt: new Date().toISOString() } : {}) });
  };

  return (
    <div className="igp-draft">
      {draft.imageUrl
        ? <img className="igp-draft-thumb" src={draft.imageUrl} alt="" />
        : <div className="igp-draft-thumb"><ImageIcon size={18} /></div>}
      <div className="igp-draft-main">
        <div className="igp-draft-headline">{draft.headline || draft.caption.slice(0, 60)}</div>
        <div className="igp-draft-meta">
          <button className={`igp-draft-status igp-draft-status--${draft.status}`} onClick={cycleStatus} title="Cycle status">
            {draft.status}
          </button>
          {draft.scheduledAt && (
            <span><Calendar size={10} style={{ verticalAlign: "-1px", marginRight: 3 }} />
              {new Date(draft.scheduledAt).toLocaleString()}
            </span>
          )}
          {draft.postedUrl && (
            <a href={draft.postedUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
              <ExternalLink size={10} style={{ verticalAlign: "-1px", marginRight: 3 }} />link
            </a>
          )}
        </div>
        <div className="igp-draft-actions">
          <button className="igp-draft-btn" onClick={onReopen}>Reopen</button>
          <button className="igp-draft-btn" onClick={onToggleEdit}>{editing ? "Done" : "Edit"}</button>
          <button className="igp-draft-btn igp-draft-btn--danger" onClick={() => { if (confirm("Delete this draft?")) onDelete(); }}>
            <Trash2 size={11} /> Delete
          </button>
        </div>
        {editing && (
          <div className="igp-draft-edit-row">
            <label style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Scheduled date / time</label>
            <input
              type="datetime-local"
              className="igp-draft-input"
              value={scheduledLocal}
              onChange={e => setScheduledLocal(e.target.value)}
              onBlur={() => {
                if (scheduledLocal) {
                  const iso = new Date(scheduledLocal).toISOString();
                  if (iso !== draft.scheduledAt) onUpdate({ scheduledAt: iso, status: draft.status === "draft" ? "scheduled" : draft.status });
                } else if (draft.scheduledAt) {
                  onUpdate({ scheduledAt: null });
                }
              }}
            />
            <label style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Posted URL (paste after manual publishing)</label>
            <input
              type="url"
              className="igp-draft-input"
              value={postedUrl}
              onChange={e => setPostedUrl(e.target.value)}
              onBlur={() => { if (postedUrl !== (draft.postedUrl ?? "")) onUpdate({ postedUrl: postedUrl || null }); }}
              placeholder="https://www.instagram.com/p/..."
            />
            <label style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Notes</label>
            <textarea
              className="igp-draft-input"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={() => { if (notes !== (draft.notes ?? "")) onUpdate({ notes: notes || null }); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
