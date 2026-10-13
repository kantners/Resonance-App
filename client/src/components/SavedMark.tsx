import { useEffect, useState } from "react";
import { onSaved } from "@/lib/feedback";

/** A small "✓ Saved" pill above the bottom menu. Survives navigation. */
export function SavedMark() {
  const [shown, setShown] = useState<{ label: string; key: number } | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const off = onSaved(label => {
      clearTimeout(t);
      setShown({ label, key: Date.now() });
      t = setTimeout(() => setShown(null), 1600);
    });
    return () => { off(); clearTimeout(t); };
  }, []);
  return (
    <div role="status" aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-50 flex justify-center">
      {shown && (
        <div key={shown.key} className="r-saved flex items-center gap-2 rounded-pill bg-ink px-4 py-2 text-14 font-medium text-surface shadow-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="rgb(var(--physiology))" />
            <path className="r-saved-tick" d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="rgb(var(--surface))" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {shown.label}
        </div>
      )}
    </div>
  );
}
