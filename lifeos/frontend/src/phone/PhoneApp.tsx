import React from "react";
import { PhoneProvider } from "./PhoneContext";
export default function PhoneApp({ route }: { route: string[] }) {
  return <PhoneProvider><div style={{ padding: 20 }}>Phone app coming together... ({route.join("/")})</div></PhoneProvider>;
}
