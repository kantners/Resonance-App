import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { errorText } from "@/lib/api";
import { deviceTimeZone } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body: Record<string, string> = { email, password };
      if (mode === "register") {
        if (firstName) body.firstName = firstName;
        body.timeZone = deviceTimeZone();   // dates are always the user's local dates (B6)
      }
      return apiRequest("POST", endpoint, body);
    },
    onSuccess: async (data: any) => {
      qc.setQueryData(["/api/me"], data?.user ?? data);
      await qc.invalidateQueries({ queryKey: ["/api/me"] });
    },
  });

  const input = "w-full h-12 box-border px-3.5 rounded-control border border-control bg-surface text-16 text-ink";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ground px-6 py-6">
      <div className="flex flex-col items-center mb-10">
        <img src="/brand-shield.png" alt="" width={62} height={80} className="w-[62px] h-auto mb-5" />
        {/* Lockup: the byline row stretches to exactly the width of "Resonance";
            the two rules take only the space the text leaves. */}
        <div className="inline-flex flex-col items-stretch gap-3">
          <h1 className="m-0 font-serif font-semibold text-[54px] leading-none text-ink text-center">Resonance</h1>
          <div className="flex items-center gap-2" aria-label="by Blue Ember Wellness">
            <span aria-hidden="true" className="flex-1 min-w-[8px] h-px bg-[rgb(var(--brand-rule))]" />
            <span className="font-mono text-11 tracking-[0.14em] uppercase whitespace-nowrap text-[rgb(var(--brand-text))]">By Blue Ember Wellness</span>
            <span aria-hidden="true" className="flex-1 min-w-[8px] h-px bg-[rgb(var(--brand-rule))]" />
          </div>
        </div>
      </div>

      <div className="w-full max-w-[400px] r-card p-6 box-border">
        <div role="tablist" className="flex mb-6 bg-track rounded-control p-1">
          {(["login", "register"] as Mode[]).map(m => (
            <button key={m} role="tab" aria-selected={mode === m} type="button" onClick={() => setMode(m)}
              className={cn("flex-1 min-h-[40px] rounded-[8px] border-0 cursor-pointer text-14",
                mode === m ? "bg-surface text-ink font-semibold shadow-[0_1px_2px_rgb(var(--shadow)/0.12)]" : "bg-transparent text-ink-soft font-medium")}>
              {m === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={e => { e.preventDefault(); if (email && password) mutation.mutate(); }} className="flex flex-col gap-4">
          {mode === "register" && (
            <label className="flex flex-col gap-1.5 text-13 font-medium text-ink-soft">First name
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} autoComplete="given-name" className={input} />
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-13 font-medium text-ink-soft">Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-13 font-medium text-ink-soft">Password
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              autoComplete={mode === "login" ? "current-password" : "new-password"} className={input} />
            {mode === "register" && <span className="text-12 font-normal text-muted">At least 8 characters</span>}
          </label>
          {mutation.error && <p role="alert" className="m-0 text-13 text-alert">{errorText(mutation.error)}</p>}
          <button type="submit" disabled={mutation.isPending || !email || !password}
            className="mt-1 min-h-[52px] rounded-tile border-0 bg-ink text-surface text-16 font-semibold cursor-pointer disabled:opacity-50">
            {mutation.isPending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-12 text-muted text-center max-w-[340px] leading-[1.5]">
        A self-monitoring tool, not a medical device. <a href="#/privacy">Privacy</a> · <a href="#/terms">Terms</a>
      </p>
    </div>
  );
}
