import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A mono input with a unit suffix inside the same bordered box (design: Sleep, Exposure). */
export function UnitInput({
  id, value, onChange, unit, label, invalid, inputMode = "numeric", placeholder,
}: {
  id?: string; value: string; onChange: (v: string) => void; unit?: string; label?: string;
  invalid?: boolean; inputMode?: "numeric" | "decimal" | "text"; placeholder?: string;
}) {
  return (
    <label
      className={cn(
        "flex items-center h-12 box-border rounded-control px-3.5 gap-1.5 bg-surface",
        invalid ? "border-2 border-exposure bg-exposure-field" : "border border-control",
      )}
    >
      <input
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={label}
        aria-invalid={invalid || undefined}
        inputMode={inputMode}
        placeholder={placeholder}
        className="w-full border-0 outline-none bg-transparent font-mono text-18 text-ink min-w-0"
      />
      {unit && <span className="text-13 text-muted whitespace-nowrap">{unit}</span>}
    </label>
  );
}

export function FieldLabel({ htmlFor, children, optional }: { htmlFor?: string; children: ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-13 font-medium text-ink-soft">
      {children}
      {optional && <span className="font-normal text-muted"> · optional</span>}
    </label>
  );
}

export function Field({ label, htmlFor, optional, children }: { label: ReactNode; htmlFor?: string; optional?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={htmlFor} optional={optional}>{label}</FieldLabel>
      {children}
    </div>
  );
}

/** The full-width primary action at the bottom of a form. */
export function PrimaryButton({ children, disabled, onClick, type = "button" }: {
  children: ReactNode; disabled?: boolean; onClick?: () => void; type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="min-h-[52px] rounded-tile border-0 bg-ink text-surface text-16 font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="m-0 text-13 leading-[1.45] text-alert">{children}</p>;
}

/** Parses a user-entered number; "" → null; invalid → NaN. */
export function num(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
