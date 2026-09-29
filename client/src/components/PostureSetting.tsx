import type { Posture } from "@shared/api";
import { FormError } from "@/components/Fields";
import { errorText, useSave } from "@/lib/api";
import { MORNING_POSTURES } from "@/lib/posture";

/**
 * The set morning posture, chosen once (first run or Settings) and
 * pre-selected on every morning reading. Saved on tap.
 */
export function PostureSetting({ value }: { value: Posture | null }) {
  const save = useSave<{ hrvPosture: Posture }>("PATCH", "/api/settings", ["/api/me"]);
  return (
    <>
      <div role="radiogroup" aria-label="Morning reading posture" className="flex flex-wrap gap-1.5">
        {MORNING_POSTURES.map(p => (
          <button key={p.value} type="button" role="radio" aria-checked={value === p.value} className="r-chip"
            disabled={save.isPending} onClick={() => value !== p.value && save.mutate({ hrvPosture: p.value })}>{p.label}</button>
        ))}
      </div>
      <FormError>{save.error ? errorText(save.error) : null}</FormError>
    </>
  );
}
