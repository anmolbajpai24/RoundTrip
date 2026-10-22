import { useState } from "react";
import { setMembersCanEdit, setMemberRole } from "../lib/session.js";
import { confirmDialog, toast } from "./dialogs.jsx";
import Avatar from "./Avatar.jsx";
import Toggle from "./ui/Toggle.jsx";
import s from "./TripPeople.module.css";

// Organiser-only part of trip settings: the "Members can edit" switch and the
// member list with "Make co-organiser". Both calls are organiser-only RPCs
// that throw on failure; the new role or switch reaches everyone's open app
// through session.js, so this only has to show the result.
export default function TripPeople({ members, myId, membersCanEdit, onMembersChanged }) {
  const [busy, setBusy] = useState(null); // "switch" | user id

  const flip = async (next) => {
    setBusy("switch");
    try { await setMembersCanEdit(next); }
    catch (e) { toast(e.message || "Couldn't change that.", { kind: "error" }); }
    setBusy(null);
  };

  const promote = async (m) => {
    const ok = await confirmDialog({
      title: `Make ${m.name} a co-organiser?`,
      message: "They'll be able to change the trip, its settings and who can edit, just like you.",
      confirmLabel: "Make co-organiser",
    });
    if (!ok) return;
    setBusy(m.user_id);
    try { await setMemberRole(m.user_id, "organiser"); await onMembersChanged?.(); }
    catch (e) { toast(e.message || "Couldn't change their role.", { kind: "error" }); }
    setBusy(null);
  };

  // Organisers first, then everyone else, each alphabetically.
  const sorted = [...(members || [])].sort((a, b) =>
    (a.role === "organiser" ? 0 : 1) - (b.role === "organiser" ? 0 : 1) || (a.name || "").localeCompare(b.name || ""));

  return (
    <div>
      <div className={s.card}>
        <div className={s.switchRow}>
          <span className={s.switchBody}>
            <span className={s.switchTitle}>Members can edit</span>
            <span className={s.switchSub}>
              {membersCanEdit
                ? "Everyone can change the plan, bookings and budget."
                : "Only organisers can change the plan and bookings. Budget is hidden."}
            </span>
          </span>
          <Toggle checked={membersCanEdit} onChange={flip} disabled={busy === "switch"} />
        </div>
      </div>

      <div className={s.list}>
        {sorted.map((m) => (
          <div key={m.user_id} className={s.member}>
            <Avatar name={m.name} color={m.color} size="xs" />
            <span className={s.name}>{m.name}{m.user_id === myId ? " (you)" : ""}</span>
            {m.role === "organiser" ? (
              <span className={s.role}>Organiser</span>
            ) : (
              <button onClick={() => promote(m)} disabled={busy === m.user_id} className={s.promote}>
                {busy === m.user_id ? "Saving…" : "Make co-organiser"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
