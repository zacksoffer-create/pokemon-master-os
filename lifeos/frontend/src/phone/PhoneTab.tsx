import React from "react";
// Messages + Contacts. route = path parts after "phone", e.g. [] | ["thread", tid] | ["contacts"] | ["contact", cid]
export default function PhoneTab({ route }: { route: string[] }) {
  return <div style={{ padding: 20 }}>Messages ({route.join("/")})</div>;
}
