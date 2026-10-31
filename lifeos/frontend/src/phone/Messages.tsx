// The Messages app: your conversations, and the conversation view with reply chips and staged replies.
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Msg, Thread, ThreadSummary, phoneApi, pgo } from "./api";
import { usePhone } from "./PhoneContext";
import {
  Chevron, GroupAvatar, PersonAvatar, dayLabel, listTime, minutes, pendingCompose, sleep, usePeople,
} from "./MessagesUtil";

const ME = "me";

function threadKind(t: { id: string; kind: string }): "family" | "team" | "group" | "dm" {
  if (t.kind === "dm") return "dm";
  if (t.id === "family") return "family";
  if (t.id.startsWith("team:")) return "team";
  return "group";
}

// ------------------------------------------------------------------------------------------- list

export function MessagesList() {
  const { state, refresh } = usePhone();
  const people = usePeople();
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    phoneApi.threads().then((r) => alive && setThreads(r.threads)).catch((e) => alive && setErr(e.message));
    refresh();
    return () => {
      alive = false;
    };
  }, [refresh]);
  const parents = state?.family?.guardians || [];
  if (err) return <div className="pm-empty">{err}</div>;
  if (!threads) return <ListSkeleton />;
  if (!threads.length)
    return (
      <div className="pm-empty">
        <div className="pm-empty-ico">💬</div>
        <b>No messages yet</b>
        <span>When friends, family or your team text you, it shows up here.</span>
      </div>
    );
  return (
    <div className="pm-list" role="list">
      {threads.map((t) => {
        const k = threadKind(t);
        const fromMe = t.last_from === "You";
        const day = dayFromDate(t.date, state?.day, state?.date);
        return (
          <button key={t.id} role="listitem" className={`pm-row${t.unread ? " unread" : ""}`} onClick={() => pgo(`phone/thread/${t.id}`)}>
            <div className="pm-row-av">
              {k === "dm" ? (
                <PersonAvatar id={t.members[0]} people={people} size={52} />
              ) : (
                <GroupAvatar members={t.members} kind={k === "family" ? "family" : "team"} people={people} parents={parents} />
              )}
              {t.needs_reply && !t.unread && <span className="pm-reply-dot" title="Waiting on your reply" />}
            </div>
            <div className="pm-row-main">
              <div className="pm-row-top">
                <span className="pm-row-name">{t.title}</span>
                <span className="pm-row-time">{listTime(day, t.date, t.at, state?.day)}</span>
              </div>
              <div className="pm-row-bottom">
                <span className="pm-row-last">
                  {fromMe ? <span className="pm-dim">You: </span> : k !== "dm" ? <span className="pm-dim">{t.last_from}: </span> : null}
                  {t.last}
                </span>
                {t.unread > 0 && <span className="pm-unread">{t.unread > 9 ? "9+" : t.unread}</span>}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Thread summaries only carry a date string; turn it into a day number relative to today. */
function dayFromDate(date: string, today?: number, todayDate?: string) {
  if (today === undefined || !todayDate) return undefined;
  const a = Date.parse(date.replace(/^\w{3}, /, ""));
  const b = Date.parse(todayDate.replace(/^\w{3}, /, ""));
  if (Number.isNaN(a) || Number.isNaN(b)) return undefined;
  return today - Math.round((b - a) / 864e5);
}

function ListSkeleton() {
  return (
    <div className="pm-list">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="pm-row skel">
          <div className="pm-skel-av" />
          <div className="pm-row-main">
            <div className="pm-skel-line w40" />
            <div className="pm-skel-line w70" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------------------------ conversation

type Note = { id: string; after: string; text: string };

export function Conversation({ tid }: { tid: string }) {
  const { state, refresh, toast } = usePhone();
  const people = usePeople();
  const parents = state?.family?.guardians || [];
  const [thread, setThread] = useState<Thread | null>(null);
  const [shown, setShown] = useState<Msg[]>([]);
  const [typing, setTyping] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [openTs, setOpenTs] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [hasNumber, setHasNumber] = useState<boolean | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const kind = threadKind({ id: tid, kind: tid.startsWith("dm:") ? "dm" : "group" });
  const otherId = kind === "dm" ? tid.slice(3) : null;
  const other = otherId ? people[otherId] : null;

  const load = useCallback(async () => {
    try {
      const t = await phoneApi.thread(tid);
      setThread(t);
      setShown(t.msgs);
      setErr(null);
      refresh();
      return t;
    } catch (e: any) {
      setErr(e.message);
      return null;
    }
  }, [tid, refresh]);

  useEffect(() => {
    setThread(null);
    setShown([]);
    setNotes([]);
    load().then((t) => {
      if (t && pendingCompose.tid === tid && pendingCompose.kind) {
        const k = pendingCompose.kind;
        pendingCompose.tid = null;
        pendingCompose.kind = null;
        if (t.text_options.some((o) => o.kind === k)) send(k, t);
      }
    });
    if (otherId) {
      phoneApi.contacts().then((r) => {
        const all = r.groups.flatMap((g) => g.people);
        const row = all.find((p) => p.id === otherId);
        setHasNumber(row ? row.has_number : false);
      }).catch(() => setHasNumber(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid]);

  const scrollDown = useCallback((smooth = true) => {
    const el = scroller.current;
    if (!el) return;
    const behavior: ScrollBehavior = smooth ? "smooth" : "auto";
    if (el.scrollHeight > el.clientHeight + 4) el.scrollTo({ top: el.scrollHeight, behavior });
    else (el.lastElementChild as HTMLElement | null)?.scrollIntoView({ block: "end", behavior });
  }, []);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (!shown.length) return;
    scrollDown(!first.current);
    first.current = false;
  }, [shown.length, typing, notes.length, scrollDown]);

  /** Show the server's new messages in order: yours right away, then dots, then theirs. */
  const stage = useCallback(async (next: Thread, before: Msg[], optimisticId: string | null) => {
    const known = new Set(before.map((m) => m.id));
    const fresh = next.msgs.filter((m) => !known.has(m.id));
    const mine = fresh.filter((m) => m.from === ME);
    const theirs = fresh.filter((m) => m.from !== ME);
    const base = before.filter((m) => m.id !== optimisticId).map((m) => next.msgs.find((x) => x.id === m.id) || m);
    setShown([...base, ...mine]);
    for (const m of theirs) {
      setTyping(m.from);
      await sleep(800 + Math.min(800, m.text.length * 22) + Math.random() * 250);
      setTyping(null);
      setShown((s) => [...s, m]);
      await sleep(120);
    }
    setThread(next);
    setShown(next.msgs);
  }, []);

  const optimistic = (label: string): Msg => ({
    id: `local-${Date.now()}`, from: ME, from_name: "You", text: label, at: "", day: state?.day ?? 0, date: state?.date ?? "",
    kind: "reply", read: false, replies: null, chosen: null,
  });

  const answer = async (m: Msg, index: number) => {
    if (sending || !thread) return;
    setSending(true);
    const label = m.replies![index];
    const before = shown.map((x) => (x.id === m.id ? { ...x, replies: null, chosen: index } : x));
    const temp = optimistic(label);
    setShown([...before, temp]);
    try {
      const r = await phoneApi.reply(tid, m.id, index);
      await stage(r.thread, [...before, temp], temp.id);
      refresh();
    } catch (e: any) {
      toast(e.message, "bad");
      await load();
    } finally {
      setSending(false);
    }
  };

  const send = async (k: string, t: Thread | null = thread) => {
    if (sending || !t) return;
    const opt = t.text_options.find((o) => o.kind === k);
    if (!opt) return;
    setSending(true);
    const before = [...(t === thread ? shown : t.msgs)];
    try {
      const r = await phoneApi.text(t.members[0], k);
      await stage(r.thread, before, null);
      if (r.plans) {
        const last = r.thread.msgs[r.thread.msgs.length - 1];
        setNotes((n) => [...n, { id: `plans-${last.id}`, after: last.id, text: "Plans made. You'll hang out at your next free time." }]);
      }
      refresh();
    } catch (e: any) {
      toast(e.message, "bad");
      await load();
    } finally {
      setSending(false);
    }
  };

  const pendingReply = useMemo(() => {
    for (let i = shown.length - 1; i >= 0; i--) {
      const m = shown[i];
      if (m.from === ME) return null;
      if (m.replies && m.replies.length && m.chosen === null) return m;
    }
    return null;
  }, [shown]);

  const title = thread?.title || (other ? other.name : kind === "family" ? "Family" : "Messages");
  const memberNames = (thread?.members || []).map((m) => (m.startsWith("parent") ? parents.find((p) => p.id === m)?.name : people[m]?.first)).filter(Boolean);
  const subtitle = kind === "dm"
    ? (other?.year_label || "")
    : thread
      ? memberNames.length && memberNames.length <= 6 ? `${memberNames.join(", ")} & you` : `${thread.members.length + 1} people`
      : "";

  return (
    <div className="pm-convo">
      <header className="pm-convo-head">
        <button className="pm-back" onClick={() => pgo("phone")} aria-label="Back to messages">
          <Chevron />
        </button>
        <button className="pm-convo-who" onClick={() => otherId && pgo(`phone/contact/${otherId}`)} disabled={!otherId}>
          {kind === "dm" && otherId ? (
            <PersonAvatar id={otherId} people={people} size={36} />
          ) : (
            <GroupAvatar members={thread?.members || []} kind={kind === "family" ? "family" : "team"} people={people} parents={parents} size={36} />
          )}
          <span className="pm-convo-title">
            <b>{title}</b>
            {subtitle && <small>{subtitle}{kind === "dm" ? " ›" : ""}</small>}
          </span>
        </button>
      </header>

      <div className="pm-thread" ref={scroller}>
        {err && <div className="pm-empty">{err}</div>}
        {!thread && !err && <div className="pm-thread-loading"><span /><span /><span /></div>}
        {thread && !shown.length && (
          <div className="pm-thread-start">
            {otherId && <PersonAvatar id={otherId} people={people} size={72} />}
            <b>{title}</b>
            <span>No messages yet. Say something.</span>
          </div>
        )}
        <Bubbles
          msgs={shown} kind={kind} today={state?.day} openTs={openTs} setOpenTs={setOpenTs} people={people} parents={parents} notes={notes}
        />
        {typing && (
          <div className={`pm-msgrow them${kind !== "dm" ? " group" : ""}`}>
            {kind !== "dm" && <div className="pm-msg-av"><PersonAvatar id={typing} people={people} parents={parents} size={28} /></div>}
            <div className="pm-bubble them tail pm-typing" aria-label="typing"><span /><span /><span /></div>
          </div>
        )}
      </div>

      <footer className="pm-compose">
        {pendingReply ? (
          <>
            <div className="pm-compose-label">Reply</div>
            <div className="pm-chips">
              {pendingReply.replies!.map((r, i) => (
                <button key={i} className="pm-chip reply" disabled={sending} onClick={() => answer(pendingReply, i)}>{r}</button>
              ))}
            </div>
          </>
        ) : kind === "dm" && thread && thread.text_options.length ? (
          <>
            <div className="pm-compose-label">Text {other?.first || "them"}</div>
            <div className="pm-chips">
              {thread.text_options.map((o) => (
                <button key={o.kind} className="pm-chip" disabled={sending || !!typing} onClick={() => send(o.kind)}>{o.label}</button>
              ))}
            </div>
          </>
        ) : thread ? (
          <div className="pm-compose-note">
            {kind !== "dm"
              ? "Group chat. You'll get a chance to reply when someone asks you something."
              : hasNumber === false
                ? `You don't have ${other?.first || "their"}'s number yet.`
                : `You've already texted ${other?.first || "them"} today.`}
          </div>
        ) : null}
      </footer>
    </div>
  );
}

function Bubbles({ msgs, kind, today, openTs, setOpenTs, people, parents, notes }: {
  msgs: Msg[]; kind: string; today?: number; openTs: string | null; setOpenTs: (id: string | null) => void;
  people: any; parents: { id: string; name: string }[]; notes: Note[];
}) {
  const group = kind !== "dm";
  const lastMine = [...msgs].reverse().find((m) => m.from === ME);
  const lastMineIsLast = !!lastMine && msgs[msgs.length - 1]?.id === lastMine.id;
  const out: React.ReactNode[] = [];
  msgs.forEach((m, i) => {
    const prev = msgs[i - 1];
    const next = msgs[i + 1];
    const newDay = !prev || prev.day !== m.day;
    if (newDay) out.push(<div key={`d-${m.id}`} className="pm-day"><span>{dayLabel(m.day, m.date, today)}</span>{m.at && <em>{m.at}</em>}</div>);
    else if (m.at && prev?.at && minutes(m.at) - minutes(prev.at) >= 90) out.push(<div key={`t-${m.id}`} className="pm-gap">{m.at}</div>);
    const mine = m.from === ME;
    const startRun = newDay || !prev || prev.from !== m.from || (prev.at && m.at && minutes(m.at) - minutes(prev.at) >= 90);
    const endRun = !next || next.from !== m.from || next.day !== m.day || (next.at && m.at && minutes(next.at) - minutes(m.at) >= 90);
    const showName = group && !mine && startRun;
    out.push(
      <div key={m.id} className={`pm-msgrow ${mine ? "me" : "them"}${group ? " group" : ""}${startRun ? " start" : ""}`}>
        {group && !mine && (
          <div className="pm-msg-av">{endRun ? <PersonAvatar id={m.from} people={people} parents={parents} size={28} /> : null}</div>
        )}
        <div className="pm-msg-col">
          {showName && <div className="pm-msg-name">{m.from_name}</div>}
          <button
            className={`pm-bubble ${mine ? "me" : "them"}${endRun ? " tail" : ""}${isEmojiOnly(m.text) ? " emoji" : ""}`}
            onClick={() => setOpenTs(openTs === m.id ? null : m.id)}
          >
            {m.text}
          </button>
          {openTs === m.id && m.at && <div className="pm-msg-ts">{m.at}</div>}
        </div>
      </div>
    );
    if (mine && lastMine && m.id === lastMine.id) {
      if (m.read) out.push(<div key={`r-${m.id}`} className="pm-receipt">Read</div>);
      else if (lastMineIsLast && !m.id.startsWith("local-")) out.push(<div key={`r-${m.id}`} className="pm-receipt">Delivered</div>);
    }
    for (const n of notes) if (n.after === m.id) out.push(<div key={n.id} className="pm-sysnote">{n.text}</div>);
  });
  return <>{out}</>;
}

function isEmojiOnly(s: string) {
  const t = s.trim();
  return t.length > 0 && t.length <= 6 && !/[\p{L}\p{N}]/u.test(t);
}
