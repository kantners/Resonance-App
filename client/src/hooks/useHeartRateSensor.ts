// Web Bluetooth connection to a standard Heart Rate sensor (service 0x180D).
// Works in Chrome on Android and desktop over HTTPS. Not in iOS Safari.
// The stream stays in the browser: nothing here touches the server.
// If the sensor drops, it reconnects by itself (backoff, about 80 seconds in
// all) without asking for the device again, then gives up as "lost".
import { useCallback, useEffect, useRef, useState } from "react";
import { HR_MAX, HR_MIN, parseHeartRateMeasurement, type Contact } from "@shared/heartRate";

export type SensorStatus = "idle" | "connecting" | "live" | "reconnecting" | "lost" | "error";

// Web Bluetooth has no bundled TypeScript types; only what is used here.
type Gatt = { connected: boolean; connect(): Promise<Gatt>; disconnect(): void; getPrimaryService(s: string): Promise<{ getCharacteristic(c: string): Promise<Char> }> };
type Char = { startNotifications(): Promise<Char>; addEventListener(t: string, f: (e: Event) => void): void; removeEventListener(t: string, f: (e: Event) => void): void; value?: DataView };
type Dev = { name?: string; gatt?: Gatt; addEventListener(t: string, f: () => void): void; removeEventListener(t: string, f: () => void): void };
type WakeLock = { release(): Promise<void>; released?: boolean };

export const bluetoothSupported = () => typeof navigator !== "undefined" && "bluetooth" in navigator;

const RETRY_MS = [1000, 2000, 4000, 8000, 15000, 15000, 15000, 15000];
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const GIVE_UP = "Lost the watch. Check that it is still broadcasting heart rate and in range, then tap Reconnect.";

export function useHeartRateSensor(onSample?: (bpm: number) => void) {
  const [status, setStatusState] = useState<SensorStatus>("idle");
  const [bpm, setBpm] = useState<number | null>(null);
  const [contact, setContact] = useState<Contact>("unsupported");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gotRR, setGotRR] = useState(false);

  const statusRef = useRef<SensorStatus>("idle");
  const setStatus = useCallback((s: SensorStatus) => { statusRef.current = s; setStatusState(s); }, []);
  const dev = useRef<Dev | null>(null);
  const chr = useRef<Char | null>(null);
  const cb = useRef(onSample); cb.current = onSample;
  const wake = useRef<WakeLock | null>(null);
  const wanted = useRef(false);     // false after the person taps Disconnect: never reconnect then
  const looping = useRef(false);
  const runId = useRef(0);

  const onValue = useCallback((e: Event) => {
    const v = (e.target as unknown as Char).value;
    const m = v ? parseHeartRateMeasurement(v) : null;
    if (!m || m.bpm < HR_MIN || m.bpm > HR_MAX) return;
    setBpm(m.bpm); setContact(m.contact);
    if (m.rrMs.length) setGotRR(true);
    cb.current?.(m.bpm);
  }, []);

  const holdScreen = useCallback(async () => {
    if (wake.current && !wake.current.released) return;
    try { wake.current = await (navigator as any).wakeLock?.request("screen"); } catch { /* optional */ }
  }, []);

  const attach = useCallback(async (d: Dev) => {
    const server = await d.gatt!.connect();
    const svc = await server.getPrimaryService("heart_rate");
    const c = await svc.getCharacteristic("heart_rate_measurement");
    try { chr.current?.removeEventListener("characteristicvaluechanged", onValue); } catch { /* old object */ }
    c.addEventListener("characteristicvaluechanged", onValue);
    await c.startNotifications();
    chr.current = c;
    setStatus("live"); setError(null);
    void holdScreen();
  }, [onValue, holdScreen, setStatus]);

  const reconnectLoop = useCallback(async () => {
    if (looping.current || !dev.current) return;
    looping.current = true;
    const my = ++runId.current;
    setStatus("reconnecting"); setBpm(null);
    try {
      for (const wait of RETRY_MS) {
        await sleep(wait);
        if (runId.current !== my || !wanted.current) return;
        try { await attach(dev.current!); return; } catch { /* try again */ }
      }
      if (runId.current === my && wanted.current) { setStatus("lost"); setError(GIVE_UP); }
    } finally {
      if (runId.current === my) looping.current = false;
    }
  }, [attach, setStatus]);

  // The drop listener is registered once on the device; it calls the latest loop.
  const loopRef = useRef(reconnectLoop); loopRef.current = reconnectLoop;
  const onDrop = useCallback(() => {
    if (!wanted.current || looping.current) return;
    setBpm(null);
    void loopRef.current();
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    if (!bluetoothSupported()) { setStatus("error"); setError("This browser cannot use Bluetooth. Use Chrome on Android."); return; }
    try {
      setStatus("connecting");
      const d: Dev = await (navigator as any).bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }] });
      dev.current?.removeEventListener("gattserverdisconnected", onDrop);
      dev.current = d;
      d.addEventListener("gattserverdisconnected", onDrop);
      setDeviceName(d.name ?? "Heart rate sensor");
      wanted.current = true;
      await attach(d);
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === "NotFoundError") { setStatus("idle"); return; }   // chooser closed with nothing picked
      setStatus("error");
      setError("Could not connect. Check that Broadcast Heart Rate is on and that no other app (Strava, Garmin Connect) is connected to the watch.");
    }
  }, [attach, onDrop, setStatus]);

  /** Manual retry after the automatic attempts gave up. */
  const reconnect = useCallback(async () => {
    if (!dev.current) return connect();
    wanted.current = true; looping.current = false; setError(null);
    await loopRef.current();
  }, [connect]);

  const disconnect = useCallback(() => {
    wanted.current = false; runId.current++; looping.current = false;
    try { chr.current?.removeEventListener("characteristicvaluechanged", onValue); } catch { /* already gone */ }
    dev.current?.removeEventListener("gattserverdisconnected", onDrop);
    try { dev.current?.gatt?.disconnect(); } catch { /* already gone */ }
    wake.current?.release().catch(() => {}); wake.current = null;
    setStatus("idle"); setBpm(null);
  }, [onValue, onDrop, setStatus]);

  // Chrome releases the screen lock when the tab is hidden, and a hidden tab may have
  // missed its retries: when the person returns, take the lock again and retry once.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !wanted.current) return;
      if (statusRef.current === "live" || statusRef.current === "reconnecting") void holdScreen();
      if (statusRef.current === "lost") void reconnect();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [holdScreen, reconnect]);

  useEffect(() => () => disconnect(), [disconnect]);

  return { status, bpm, contact, deviceName, error, gotRR, connect, reconnect, disconnect };
}
