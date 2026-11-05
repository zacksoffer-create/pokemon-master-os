// What's going on with this phone, for when the screen won't show: tap the Me tab five times fast (the tab bar always
// shows), or open the app with #/m/diag. A plain white panel on top of everything (no animations, blur or shadows, so it
// paints even when the rest won't): the build, the phone, how much memory the engine holds and how big the story is, what
// the screen behind it is doing, and a Simple look switch that turns every visual effect off.
import React, { useEffect, useState } from "react";
import { api } from "../api";

const PLAIN_KEY = "lifeos.plain";

export function plainOn(): boolean {
  try {
    return localStorage.getItem(PLAIN_KEY) === "1";
  } catch {
    return false;
  }
}

export function applyPlain(on: boolean) {
  document.documentElement.classList.toggle("ph-plain", on);
}

function screenReport(): Record<string, string> {
  const out: Record<string, string> = {};
  const scr = document.querySelector(".ph-screen") as HTMLElement | null;
  if (!scr) return { screen: "none on the page" };
  const cs = getComputedStyle(scr);
  out.screen = `opacity ${cs.opacity}, visibility ${cs.visibility}, display ${cs.display}, transform ${cs.transform}, `
    + `animation ${cs.animationName} ${cs.animationFillMode}`;
  out.size = `${Math.round(scr.clientWidth)}x${Math.round(scr.clientHeight)}, content ${scr.scrollHeight} tall, scrolled ${Math.round(scr.scrollTop)}`;
  out.inside = `${scr.querySelectorAll("*").length} elements`;
  const x = window.innerWidth / 2;
  const y = window.innerHeight / 3;
  const at = (document.elementsFromPoint ? document.elementsFromPoint(x, y) : [])
    .filter((e) => !e.closest(".ph-diag")).slice(0, 4)
    .map((e) => `${e.tagName.toLowerCase()}${typeof e.className === "string" && e.className ? "." + e.className.split(" ").slice(0, 2).join(".") : ""}`);
  out.at_center = at.join(" > ") || "nothing";
  return out;
}

export default function Diagnostics({ onClose }: { onClose: () => void }) {
  const [info, setInfo] = useState<Record<string, any>>({});
  const [plain, setPlain] = useState(plainOn());
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const base: Record<string, any> = {
      device: navigator.userAgent,
      screen_px: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x`,
      device_memory_gb: (navigator as any).deviceMemory ?? "not reported",
      installed_app: (navigator as any).standalone ? "yes (home screen)" : "no (browser)",
      ...screenReport(),
    };
    setInfo(base);
    api.get("/api/version").then((v: any) => setInfo((i) => ({ ...i, engine_running: v.engine }))).catch(() => undefined);
    fetch("version.json", { cache: "no-store" }).then((r) => r.json())
      .then((v: any) => setInfo((i) => ({ ...i, latest_online: `engine ${v.engine}, build ${v.build}` })))
      .catch(() => setInfo((i) => ({ ...i, latest_online: "couldn't check (offline?)" })));
    const own = [...document.querySelectorAll("script[src]")].map((e) => (e as HTMLScriptElement).src.split("/").pop()).find((n) => n && /^play-/.test(n));
    if (own) setInfo((i) => ({ ...i, screens_file: own }));
    api.get("/api/sim/memory?full=1").then((m: any) => setInfo((i) => ({ ...i, ...m }))).catch((e: any) => setInfo((i) => ({ ...i, memory: `couldn't read (${String(e?.message || e)})` })));
  }, []);
  const text = Object.entries(info).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join("\n");
  const flip = () => {
    const on = !plain;
    setPlain(on);
    try {
      localStorage.setItem(PLAIN_KEY, on ? "1" : "0");
    } catch { /* private mode */ }
    applyPlain(on);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`LIFE OS diagnostics\n${text}\nsimple look: ${plain ? "on" : "off"}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="ph-diag" role="dialog">
      <div className="ph-diag-in">
        <div className="ph-diag-h">
          <b>Diagnostics</b>
          <button onClick={onClose}>Close</button>
        </div>
        <p>Take a screenshot of this (or copy it) and send it over.</p>
        <label className="ph-diag-sw">
          <input type="checkbox" checked={plain} onChange={flip} />
          <span><b>Simple look</b><br />No animations, blur or shadows. If the screen stops going blank with this on, it's how the phone draws the effects.</span>
        </label>
        <pre>{text || "Reading…"}</pre>
        <div className="ph-diag-b">
          <button onClick={copy}>{copied ? "Copied" : "Copy all of it"}</button>
          <button onClick={() => window.location.reload()}>Restart the app</button>
        </div>
      </div>
    </div>
  );
}
