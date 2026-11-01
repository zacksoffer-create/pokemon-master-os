// LIFE OS: Story, the phone app. The game engine runs on the phone (Python compiled to WebAssembly, in a worker).
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import PhoneApp from "../phone/PhoneApp";
import { StoreProvider, useRoute } from "../store";
import "../styles.css";
import "./standalone.css";
import { ready, startEngine } from "./bridge";

(window as any).__LIFEOS_STANDALONE__ = true;

function Root() {
  const route = useRoute();
  useEffect(() => {
    if (route[0] !== "m") window.location.replace("#/m");
  }, [route[0]]);
  if (route[0] !== "m") return null;
  return <PhoneApp route={route.slice(1)} />;
}

function Boot() {
  const [msg, setMsg] = useState("Getting ready…");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    startEngine(setMsg);
    ready.then(() => setOk(true)).catch((e) => setErr(e.message || String(e)));
    try {
      (navigator as any).storage?.persist?.();
    } catch {
      /* not supported */
    }
  }, []);
  if (ok) {
    return (
      <StoreProvider>
        <Root />
      </StoreProvider>
    );
  }
  return (
    <div className="sa-boot">
      <img src="./icon.svg" alt="" width={84} height={84} />
      <h1>LIFE OS</h1>
      {err ? (
        <>
          <p className="sa-err">{err}</p>
          <button onClick={() => window.location.reload()}>Try again</button>
        </>
      ) : (
        <>
          <div className="sa-spin" />
          <p>{msg}</p>
          <small>The first time, this downloads about 12 MB. After that it starts fast and works offline.</small>
        </>
      )}
    </div>
  );
}

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

createRoot(document.getElementById("root")!).render(<Boot />);
