import { useState, useRef } from "react";
import { saveKey } from "../lib/storage.js";
import { DOCS_KEY, uploadDocument, docUrl, removeDocument, docIcon, docSize } from "../lib/documents.js";
import SectionTitle from "../components/SectionTitle.jsx";
import PersonBadge from "../components/PersonBadge.jsx";

export default function BookingsTab({ bookings, setBookings, documents, setDocuments, membersById, myId }) {
  const [newItem, setNewItem] = useState("");
  const [attachFor, setAttachFor] = useState(null); // booking id picking a document
  const done = bookings.filter((b) => b.done).length;
  const persist = (next) => { setBookings(next); saveKey("trip-bookings", next); };
  const toggle = (id) => persist(bookings.map((b) => (b.id === id ? { ...b, done: !b.done } : b)));
  const add = () => {
    const t = newItem.trim();
    if (!t) return;
    persist([...bookings, { id: Date.now(), text: t, urgent: false, done: false, addedBy: myId }]);
    setNewItem("");
  };
  const remove = (id) => persist(bookings.filter((b) => b.id !== id));
  const setDocFor = (id, docId) => { persist(bookings.map((b) => (b.id === id ? { ...b, docId } : b))); setAttachFor(null); };

  const docsById = Object.fromEntries((documents || []).map((d) => [d.id, d]));
  const sorted = [...bookings].sort((a, b) => (a.done - b.done) || (b.urgent - a.urgent));

  return (
    <div>
      <SectionTitle sub={`${done} of ${bookings.length} booked · shared`}>Booking checklist</SectionTitle>
      <div className="rounded-2xl border overflow-hidden mb-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        {sorted.map((b, i) => (
          <div key={b.id} style={{ borderBottom: i < sorted.length - 1 ? "1px solid var(--divider)" : "none", backgroundColor: b.urgent && !b.done ? "var(--danger-soft)" : "transparent" }}>
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => toggle(b.id)}
                className="w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                style={{ borderColor: b.done ? "#2E7D4F" : b.urgent ? "#C8102E" : "var(--faint)", backgroundColor: b.done ? "#2E7D4F" : "transparent" }}
              >
                {b.done ? "✓" : ""}
              </button>
              <div className="flex-1">
                <span className="text-sm" style={{ color: b.done ? "var(--faint)" : "var(--ink)", textDecoration: b.done ? "line-through" : "none" }}>{b.text}</span>
                {b.urgent && !b.done && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#C8102E", color: "#FFF" }}>URGENT</span>}
                {b.addedBy && <span className="ml-2 align-middle"><PersonBadge member={membersById[b.addedBy]} size="xs" /></span>}
                {b.docId && docsById[b.docId] && (
                  <DocChip doc={docsById[b.docId]} onUnlink={() => setDocFor(b.id, undefined)} />
                )}
              </div>
              {(documents?.length || 0) > 0 && !b.docId && (
                <button onClick={() => setAttachFor(attachFor === b.id ? null : b.id)} title="Attach a document" className="text-xs px-1" style={{ color: "var(--faint)" }}>📎</button>
              )}
              <button onClick={() => remove(b.id)} className="text-xs px-1" style={{ color: "var(--faint)" }}>✕</button>
            </div>
            {attachFor === b.id && (
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {(documents || []).map((d) => (
                  <button key={d.id} onClick={() => setDocFor(b.id, d.id)} className="text-[11px] font-semibold px-2.5 py-1 rounded-full border" style={{ borderColor: "var(--border)", color: "var(--ink)" }}>
                    {docIcon(d.type)} {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-6">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a booking…"
          className="flex-1 text-sm rounded-full border px-4 py-2.5"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", color: "var(--ink)" }}
        />
        <button onClick={add} className="text-sm font-bold text-white px-5 rounded-full" style={{ backgroundColor: "var(--solid)" }}>Add</button>
      </div>

      <DocumentsSection documents={documents} setDocuments={setDocuments} bookings={bookings} persistBookings={persist} membersById={membersById} />
    </div>
  );
}

function DocChip({ doc, onUnlink }) {
  const open = async (e) => {
    e.stopPropagation();
    try { window.open(await docUrl(doc.path), "_blank"); } catch { /* surfaced in docs section */ }
  };
  return (
    <span className="inline-flex items-center gap-1 ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full align-middle" style={{ backgroundColor: "var(--chip)", color: "var(--chip-ink)" }}>
      <button onClick={open}>{docIcon(doc.type)} {doc.name.length > 18 ? doc.name.slice(0, 16) + "…" : doc.name}</button>
      <button onClick={onUnlink} title="Unlink" style={{ color: "var(--faint)" }}>✕</button>
    </span>
  );
}

// Shared wallet for tickets / PDFs / screenshots (Supabase Storage).
function DocumentsSection({ documents, setDocuments, bookings, persistBookings, membersById }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [error, setError] = useState("");
  const [viewer, setViewer] = useState(null); // { url, name }

  const persist = (next) => { setDocuments(next); saveKey(DOCS_KEY, next); };

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setError("");
    try { persist([...(documents || []), await uploadDocument(file)]); }
    catch (err) { setError(err.message || "Upload failed."); }
    setBusy(false);
  };

  const open = async (doc) => {
    setOpeningId(doc.id); setError("");
    try {
      const url = await docUrl(doc.path);
      if (doc.type?.startsWith("image/")) setViewer({ url, name: doc.name });
      else window.open(url, "_blank");
    } catch (err) { setError(err.message || "Couldn't open that file."); }
    setOpeningId(null);
  };

  const del = async (doc) => {
    if (!window.confirm(`Delete "${doc.name}" for everyone on the trip?`)) return;
    setError("");
    try {
      await removeDocument(doc);
      persist((documents || []).filter((d) => d.id !== doc.id));
      if (bookings.some((b) => b.docId === doc.id)) {
        persistBookings(bookings.map((b) => (b.docId === doc.id ? { ...b, docId: undefined } : b)));
      }
    } catch (err) { setError(err.message || "Couldn't delete that file."); }
  };

  const docs = documents || [];

  return (
    <div>
      <SectionTitle sub="tickets, PDFs, screenshots · shared · max 10 MB">Documents</SectionTitle>
      {docs.length > 0 && (
        <div className="rounded-2xl border overflow-hidden mb-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          {docs.map((d, i) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < docs.length - 1 ? "1px solid var(--divider)" : "none" }}>
              <span className="text-lg flex-shrink-0">{docIcon(d.type)}</span>
              <button onClick={() => open(d)} className="flex-1 min-w-0 text-left">
                <div className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
                  {openingId === d.id ? "Opening…" : d.name}
                </div>
                <div className="text-[11px] flex items-center gap-2" style={{ color: "var(--muted)" }}>
                  {docSize(d.size)} <PersonBadge member={membersById[d.addedBy]} size="xs" />
                </div>
              </button>
              <button onClick={() => del(d)} className="text-xs px-1" style={{ color: "var(--faint)" }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <button onClick={() => fileRef.current?.click()} disabled={busy}
        className="w-full text-sm font-bold py-2.5 rounded-full border" style={{ borderColor: "var(--border)", color: "var(--ink)", backgroundColor: "var(--card)" }}>
        {busy ? "Uploading…" : "＋ Add a document"}
      </button>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onPick} />
      <p className="text-[11px] mt-2 text-center" style={{ color: "var(--faint)" }}>
        Shared with everyone on the trip. Avoid uploading sensitive scans like passport photo pages unless you need to.
      </p>
      {error && <p className="text-xs mt-2" style={{ color: "#C8102E" }}>{error}</p>}

      {viewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }} onClick={() => setViewer(null)}>
          <div className="max-w-lg w-full">
            <img src={viewer.url} alt={viewer.name} className="w-full rounded-xl" style={{ maxHeight: "80vh", objectFit: "contain" }} />
            <p className="text-center text-xs text-white mt-2 opacity-80">{viewer.name} · tap to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
