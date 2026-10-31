import React from "react";
import { Portrait } from "./portrait";
import { HAIR_STYLES, SKIN, HAIR_COLORS, fullLook } from "./looks";
export default function Gallery() {
  const base = fullLook({ skin: "light", hair: "short", hair_color: "brown", eyes: "blue", facial_hair: "none", glasses: false, freckles: false }, "x");
  return <div style={{ padding: 12, background: "#fff8ef", display: "flex", flexWrap: "wrap", gap: 8 }}>
    {HAIR_STYLES.map((h, i) => <div key={h} style={{ textAlign: "center", fontSize: 10 }}><Portrait size={110} look={{ ...base, hair: h, skin: SKIN[i % 8], hair_color: HAIR_COLORS[i % 10] } as any} mood={["happy", "neutral", "flirty"][i % 3] as any} />{h}</div>)}
    {["neutral", "happy", "sad", "angry", "flirty", "surprised", "tired"].map((m) => <div key={m} style={{ textAlign: "center", fontSize: 10 }}><Portrait size={110} look={{ ...base, hair: "long_wavy", glasses: m === "sad", freckles: true } as any} mood={m as any} />{m}</div>)}
    {["none", "stubble", "mustache", "goatee", "beard"].map((f) => <Portrait key={f} size={110} look={{ ...base, facial_hair: f, skin: "tan", hair: "crew" } as any} jersey={f === "beard" ? 12 : null} />)}
    {[32, 48, 64, 180].map((s) => <Portrait key={s} size={s} name={"Zack" + s} />)}
  </div>;
}
