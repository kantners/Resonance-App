// Settings: time zone, HRV source, practitioner mode, sign out, delete account.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { FormError } from "@/components/Fields";
import { Eyebrow, SubScreen } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { errorText, useMe, useSave } from "@/lib/api";
import { deviceTimeZone } from "@/lib/dates";
import { apiRequest } from "@/lib/queryClient";

export default function SettingsScreen() {
  const { data: me } = useMe();
  const { logout } = useAuth();
  const qc = useQueryClient();
  const save = useSave<Record<string, string>>("PATCH", "/api/settings", ["/api/me"]);
  const [device, setDevice] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const tz = deviceTimeZone();
  const input = "flex-1 min-w-0 h-12 box-border px-3.5 rounded-control border border-control bg-surface text-15";
  if (!me) return null;
  const deviceValue = device ?? me.defaultHrvDevice ?? "";

  return (
    <SubScreen back={{ href: "/log", label: "Log" }} title="Settings" demo={me.isDemo}>
      <section className="r-card px-5 py-4 flex flex-col gap-2.5">
        <Eyebrow>ACCOUNT</Eyebrow>
        <span className="text-14">{me.email}</span>
        <button type="button" className="r-button-quiet" onClick={logout}>Sign out</button>
      </section>

      <section className="r-card px-5 py-4 flex flex-col gap-2.5">
        <Eyebrow>TIME ZONE</Eyebrow>
        <p className="m-0 text-13 leading-[1.45] text-ink-soft">Every entry is dated in your own time zone.</p>
        <div className="flex justify-between items-center gap-3">
          <span className="font-mono text-14">{me.timeZone ?? "not set"}</span>
          {me.timeZone !== tz && (
            <button type="button" className="r-button-quiet min-h-[44px] px-3 text-13" onClick={() => save.mutate({ timeZone: tz })}>Use {tz}</button>
          )}
        </div>
      </section>

      <section className="r-card px-5 py-4 flex flex-col gap-2.5">
        <Eyebrow>HRV SOURCE</Eyebrow>
        <p className="m-0 text-13 leading-[1.45] text-ink-soft">
          The device and app your HRV comes from. Changing it restarts your baseline, because readings from different
          devices aren't comparable.
        </p>
        <div className="flex gap-2">
          <input value={deviceValue} onChange={e => setDevice(e.target.value)} aria-label="HRV device and app" className={input} />
          <button type="button" className="r-button min-h-[48px]" disabled={!deviceValue.trim() || deviceValue.trim() === me.defaultHrvDevice}
            onClick={() => save.mutate({ defaultHrvDevice: deviceValue.trim() })}>Save</button>
        </div>
        <FormError>{save.error ? errorText(save.error) : null}</FormError>
      </section>

      {!me.isPractitioner && (
        <section className="r-card px-5 py-4 flex flex-col gap-2.5">
          <Eyebrow>PRACTITIONER MODE</Eyebrow>
          <p className="m-0 text-13 leading-[1.45] text-ink-soft">For practitioners running a session study in their practice.</p>
          <Link href="/study" className="r-link">Set up →</Link>
        </section>
      )}

      <section className="r-card px-5 py-4 flex flex-col gap-2.5">
        <Eyebrow>DELETE ACCOUNT</Eyebrow>
        <p className="m-0 text-13 leading-[1.45] text-ink-soft">
          Deletes your account and all your data. If you're in a session study, you're withdrawn and your study data is
          deleted; one anonymised allocation record (your slot number only) stays so the study's random order stays balanced.
        </p>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password"
          autoComplete="current-password" className={input} />
        <button type="button" className="r-button-quiet text-alert" disabled={!password}
          onClick={async () => {
            setErr(null);
            try { await apiRequest("DELETE", "/api/me", { password }); qc.clear(); window.location.hash = "#/"; window.location.reload(); }
            catch (e) { setErr(errorText(e)); }
          }}>Delete my account</button>
        <FormError>{err}</FormError>
      </section>

      <p className="m-0 text-12 text-muted"><a href="#/privacy">Privacy</a> · <a href="#/terms">Terms</a></p>
    </SubScreen>
  );
}
