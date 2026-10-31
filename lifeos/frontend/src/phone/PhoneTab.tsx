// The in-game phone: Messages and Contacts. route = path parts after "phone":
//   []                -> Messages list
//   ["thread", tid]   -> a conversation (tid: "dm:<id>", "family", "team:<group>")
//   ["contacts"]      -> Contacts
//   ["contact", cid]  -> a person's profile
import React from "react";
import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-800.css";
import "./messages.css";
import { pgo } from "./api";
import { usePhone } from "./PhoneContext";
import { ContactProfile, ContactsList } from "./Contacts";
import { Conversation, MessagesList } from "./Messages";

export default function PhoneTab({ route }: { route: string[] }) {
  const [view, arg] = route;
  const id = arg ? decodeURIComponent(arg) : "";
  if (view === "thread" && id) return <div className="pm-root"><Conversation key={id} tid={id} /></div>;
  if (view === "contact" && id) return <div className="pm-root"><ContactProfile key={id} cid={id} /></div>;
  const contacts = view === "contacts";
  return (
    <div className="pm-root">
      <Header contacts={contacts} />
      <div className="pm-scroll">{contacts ? <ContactsList /> : <MessagesList />}</div>
    </div>
  );
}

function Header({ contacts }: { contacts: boolean }) {
  const { state } = usePhone();
  const unread = state?.unread || 0;
  return (
    <header className="pm-head">
      <h1>{contacts ? "Contacts" : "Messages"}</h1>
      <div className="pm-seg" role="tablist">
        <button role="tab" aria-selected={!contacts} className={!contacts ? "on" : ""} onClick={() => pgo("phone")}>
          Messages{unread > 0 && <span className="pm-seg-badge">{unread > 99 ? "99+" : unread}</span>}
        </button>
        <button role="tab" aria-selected={contacts} className={contacts ? "on" : ""} onClick={() => pgo("phone/contacts")}>
          Contacts
        </button>
      </div>
    </header>
  );
}
