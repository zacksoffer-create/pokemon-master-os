import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { StoreProvider } from "../store";
import { PhoneProvider } from "./PhoneContext";
import PhoneTab from "./PhoneTab";

function Harness() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const f = () => setHash(window.location.hash);
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const route = parts[0] === "m" && parts[1] === "phone" ? parts.slice(2) : [];
  return <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}><PhoneTab route={route} /></div>;
}
createRoot(document.getElementById("root")!).render(<StoreProvider><PhoneProvider><Harness /></PhoneProvider></StoreProvider>);
