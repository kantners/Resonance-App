// Web Bluetooth connection to a standard Heart Rate sensor (service 0x180D).
// Works in Chrome on Android and desktop over HTTPS. Not in iOS Safari.
// The stream stays in the browser: nothing here touches the server.
import { useCallback, useEffect, useRef, useState } from "react";
import { HR_MAX, HR_MIN, parseHeartRateMeasurement, type Contact } from "@shared/heartRate";

export type SensorStatus = "idle" | "connecting" | "live" | "lost" | "error";

// Web Bluetooth has no bundled TypeScript types; only what is used here.
type Gatt = { connected: boolean; connect(): Promise<Gatt>; disconnect(): void; getPrimaryService(s: string): Promise<{ getCharacteristic(c: string): Promise<Char> }> };
type Char = { startNotifications(): Promise<Char>; stopNotifications(): Promise<Char>; addEventListener(t: string, f: (e: Event) => void): void; removeEventListener(t: string, f: (e: Event) => void): void; value?: DataView };
type Dev = { name?: string; gatt?: Gatt; addEventListener(t: string, f: () => void): void; removeEventListener(t: string, f: () => void): void };

export const bluetoothSupported = () => typeof navigator !== "undefined" && "bluetooth" in navigator;

export function useHeartRateSensor(onSample?: (bpm: number) => void) {
  const [status, setStatus] = useState<SensorStatus>("idle");
  const [bpm, setBpm] = useState<number | null>(null);
  const [contact, setContact] = useState<Contact>("unsupported");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gotRR, setGotRR] = useState(false);

  const dev = useRef<Dev | null>(null);
  const chr = useRef<Char | null>(null);
  const cb = useRef(onSample); cb.current = onSample;
  const wake = useRef<{ release(): Promise<void> } | null>(null);

  const onValue = useCallback((e: Event) => {
    const v = (e.target as unknown as Char).value;
    const m = v ? parseHeartRateMeasurement(v) : null;
    if (!m || m.bpm < HR_MIN || m.bpm > HR_MAX) return;
    setBpm(m.bpm); setContact(m.contact);
    if (m.rrMs.length) setGotRR(true);
    cb.current?.(m.bpm);
  }, []);

  const onDrop = useCallback(() => { setStatus("lost"); setBpm(null); }, []);

  const attach = useCallback(async (d: Dev) => {
    const server = await d.gatt!.connect();
    const svc = await server.getPrimaryService("heart_rate");
    const c = await svc.getCharacteristic("heart_rate_measurement");
    c.addEventListener("characteristicvaluechanged", onValue);
    await c.startNotifications();
    chr.current = c;
    setStatus("live");
    try { wake.current = await (navigator as any).wakeLock?.request("screen"); } catch { /* optional */ }
  }, [onValue]);

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
      await attach(d);
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === "NotFoundError") { setStatus("idle"); return; }   // chooser closed with nothing picked
      setStatus("error");
      setError("Could not connect. Check that Broadcast Heart Rate is on and that no other app (Strava, Garmin Connect) is connected to the watch.");
    }
  }, [attach, onDrop]);

  const reconnect = useCallback(async () => {
    if (!dev.current) return connect();
    try { setStatus("connecting"); await attach(dev.current); }
    catch { setStatus("lost"); setError("Still cannot reach the watch."); }
  }, [attach, connect]);

  const disconnect = useCallback(() => {
    try { chr.current?.removeEventListener("characteristicvaluechanged", onValue); } catch { /* already gone */ }
    dev.current?.removeEventListener("gattserverdisconnected", onDrop);
    try { dev.current?.gatt?.disconnect(); } catch { /* already gone */ }
    wake.current?.release().catch(() => {}); wake.current = null;
    setStatus("idle"); setBpm(null);
  }, [onValue, onDrop]);

  useEffect(() => () => disconnect(), [disconnect]);

  return { status, bpm, contact, deviceName, error, gotRR, connect, reconnect, disconnect };
}
