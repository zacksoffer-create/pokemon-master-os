// The phone app: your story in first person. Tabs: Story, Phone (texts + contacts), Home (family + pets), Me.
import "@fontsource/fredoka/600.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import React, { useEffect, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import { pgo } from "./api";
import { Portrait, Scene } from "./art";
import Gallery from "./art/Gallery";
import HomeTab from "./HomeTab";
import { PIcon } from "./icons";
import { cx, errText, Toasts } from "./kit";
import MeTab from "./MeTab";
import { PhoneProvider, usePhone } from "./PhoneContext";
import PhoneTab from "./PhoneTab";
import StoryTab from "./StoryTab";
import "./phone.css";

export default function PhoneApp({ route }: { route: string[] }) {
  useEffect(() => {
    document.documentElement.classList.add("ph-html");
    const meta = document.querySelector('meta[name="theme-color"]');
    const prev = meta?.getAttribute("content");
    meta?.setAttribute("content", "#fff4e6");
    return () => {
      document.documentElement.classList.remove("ph-html");
      if (meta && prev) meta.setAttribute("content", prev);
    };
  }, []);
  return (
    <PhoneProvider>
      <div className="ph-root">
        <div className="ph-frame">
          <Shell route={route} />
          <div id="ph-portal" />
          <Toasts />
        </div>
      </div>
    </PhoneProvider>
  );
}

function Shell({ route }: { route: string[] }) {
  const { state, error, refresh } = usePhone();
  const tab = route[0] || "story";
  // keep the badges fresh when coming back to the app
  useEffect(() => {
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);
  useEffect(() => {
    if (tab !== "story") refresh();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (tab === "gallery") return <div className="ph-screen"><Gallery /></div>;
  if (!state) {
    return (
      <div className="ph-loading">
        {error ? (
          <>
            <div className="ph-loading-t">Can't reach your game</div>
            <p>{error}</p>
            <p className="ph-dim">Make sure LIFE OS is running on your computer and your phone is on the same Wi-Fi.</p>
            <button className="ph-btn primary" onClick={() => refresh()}>Try again</button>
          </>
        ) : (
          <>
            <div className="ph-spinner" />
            <div className="ph-loading-t">Waking up {""}your story…</div>
          </>
        )}
      </div>
    );
  }
  if (!state.active) return <Welcome />;
  let body: React.ReactNode;
  if (tab === "phone") body = <PhoneTab route={route.slice(1)} />;
  else if (tab === "home") body = <HomeTab />;
  else if (tab === "me") body = <MeTab />;
  else body = <StoryTab />;
  return (
    <>
      <div className={cx("ph-screen", "tab-" + tab)} key={tab}>{body}</div>
      <TabBar tab={tab} />
    </>
  );
}

function TabBar({ tab }: { tab: string }) {
  const { state } = usePhone();
  const items: [string, string, string, React.ReactNode?][] = [
    ["story", "Story", "story", state?.moments.length ? <i className="ph-dot" /> : null],
    ["phone", "Phone", "phone", state?.unread ? <b className="ph-badge">{state.unread > 99 ? "99+" : state.unread}</b> : state?.needs_reply ? <i className="ph-dot" /> : null],
    ["home", "Home", "home", state?.pet_setup_needed ? <i className="ph-dot" /> : null],
    ["me", "Me", "me", null],
  ];
  return (
    <nav className="ph-tabbar">
      {items.map(([k, label, icon, badge]) => (
        <button key={k} className={cx("ph-tab", tab === k && "on")} onClick={() => pgo(k === "story" ? "" : k)}>
          <span className="ph-tab-i"><PIcon name={icon} size={23} stroke={tab === k ? 2.4 : 2} />{badge}</span>
          <span className="ph-tab-l">{label}</span>
        </button>
      ))}
    </nav>
  );
}

function Welcome() {
  const { refresh, toast } = usePhone();
  const lab = useStore();
  const [list, setList] = useState<any[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    api.get("/api/characters").then((cs: any[]) => setList(cs.filter((c) => c.role === "student" && c.status === "active"))).catch(() => setList([]));
  }, []);
  const pick = async (id: string) => {
    setBusy(id);
    try {
      await api.post("/api/story/protagonist", { id });
      await refresh();
      lab.refresh();
      pgo("");
    } catch (e) {
      toast(errText(e), "bad");
    } finally {
      setBusy(null);
    }
  };
  const shown = (list || []).filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="ph-screen ph-welcome">
      <div className="ph-hero welcome">
        <Scene art="school_hall" season="fall" phase="after_school" className="ph-hero-art" />
        <div className="ph-hero-fade" />
        <div className="ph-hero-text">
          <div className="ph-kicker">LIFE OS</div>
          <h1>Seven years. One life. Yours.</h1>
          <p>Freshman year through college. Every choice is yours, and everyone else is living their own life too.</p>
        </div>
      </div>
      <div className="ph-pad">
        <div className="ph-card">
          <div className="ph-card-row">
            <div className="ph-icon-bubble"><PIcon name="laptop" size={22} /></div>
            <div>
              <h3>Set up your story on your computer</h3>
              <p className="ph-dim">Build yourself, your family and your people in the story builder, then pick it up here.</p>
            </div>
          </div>
          <a className="ph-btn primary block" href="#/story/new">Open the story builder</a>
        </div>
        <div className="ph-section-t">Or play as someone already in town</div>
        <input className="ph-input" type="search" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="ph-list">
          {list === null && <div className="ph-dim ph-center">Loading people…</div>}
          {shown.slice(0, 60).map((c) => (
            <button key={c.id} className="ph-row" onClick={() => pick(c.id)} disabled={!!busy}>
              <Portrait look={c.look} size={46} color={c.color} name={c.first} />
              <div className="ph-row-main">
                <b>{c.name}</b>
                <span className="ph-dim">{c.year_label}{c.memberships?.length ? ` · ${c.memberships.slice(0, 2).map((m: any) => m.name).join(", ")}` : ""}</span>
              </div>
              {busy === c.id ? <span className="ph-spinner small" /> : <PIcon name="chevron" size={18} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
