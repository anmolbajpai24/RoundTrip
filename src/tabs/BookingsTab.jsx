import { useState, useRef } from "react";
import { saveKey } from "../lib/storage.js";
import { DOCS_KEY, uploadDocument, docUrl, removeDocument, docSize } from "../lib/documents.js";
import { confirmDialog } from "../components/dialogs.jsx";
import useBackClose from "../lib/useBackClose.js";
import PersonBadge from "../components/PersonBadge.jsx";
import Icon from "../components/ui/icons.jsx";
import Button from "../components/ui/Button.jsx";
import { Input } from "../components/ui/Field.jsx";
import s from "./BookingsTab.module.css";

// Icon for a document by MIME type (attach chips) + short filetype badge text.
const docGlyph = (type) => (type?.startsWith("image/") ? "image" : type === "application/pdf" ? "ticket" : "clip");
const docExt = (type) =>
  type === "application/pdf" ? "PDF"
  : type?.startsWith("image/") ? (type.split("/")[1] || "IMG").replace("jpeg", "jpg").slice(0, 4).toUpperCase()
  : "FILE";

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

  const urgentLeft = bookings.filter((b) => b.urgent && !b.done).length;

  return (
    <div>
      <div className={s.hero}>
        <span className={s.heroNum}>{done}</span>
        <span className={s.heroText}>of {bookings.length} booked{urgentLeft ? ` · ${urgentLeft} urgent` : ""} · shared</span>
      </div>
      <div className={s.bookingStack}>
        {sorted.map((b) => (
          <div key={b.id} className={[s.bookingWrap, b.urgent && !b.done && s.urgentWrap].filter(Boolean).join(" ")}>
            <div className={s.booking}>
              <button
                onClick={() => toggle(b.id)}
                aria-label={b.text}
                className={[s.check, b.done && s.checkDone, b.urgent && !b.done && s.checkUrgent].filter(Boolean).join(" ")}
              >
                {b.done && <Icon name="check" size={12} strokeWidth={2} />}
              </button>
              <div className={s.bookingBody}>
                <span className={[s.bookingText, b.done && s.bookingDone].filter(Boolean).join(" ")}>{b.text}</span>
                {b.urgent && !b.done && <span className={s.urgentTag}>Urgent</span>}
                {b.addedBy && <span className={s.badgeInline}><PersonBadge member={membersById[b.addedBy]} size="disc" /></span>}
                {b.docId && docsById[b.docId] && (
                  <DocChip doc={docsById[b.docId]} onUnlink={() => setDocFor(b.id, undefined)} />
                )}
              </div>
              {(documents?.length || 0) > 0 && !b.docId && (
                <button onClick={() => setAttachFor(attachFor === b.id ? null : b.id)} title="Attach a document" aria-label="Attach a document" className={s.iconBtn}><Icon name="clip" size={15} /></button>
              )}
              <button onClick={() => remove(b.id)} aria-label="Remove" className={s.iconBtn}><Icon name="x" size={14} strokeWidth={2} /></button>
            </div>
            {attachFor === b.id && (
              <div className={s.attachPicker}>
                {(documents || []).map((d) => (
                  <button key={d.id} onClick={() => setDocFor(b.id, d.id)} className={s.attachChip}>
                    <Icon name={docGlyph(d.type)} size={13} /> {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className={s.addRow}>
        <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add a booking…" />
        <Button onClick={add}>Add</Button>
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
    <span className={s.docChip}>
      <button onClick={open} className={s.docChipOpen}><Icon name={docGlyph(doc.type)} size={12} /> {doc.name.length > 18 ? doc.name.slice(0, 16) + "…" : doc.name}</button>
      <button onClick={onUnlink} title="Unlink" aria-label="Unlink" className={s.docChipX}><Icon name="x" size={11} strokeWidth={2} /></button>
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
    const ok = await confirmDialog({
      title: "Delete this document?",
      message: `"${doc.name}" will be removed for everyone on the trip.`,
      confirmLabel: "Delete", danger: true,
    });
    if (!ok) return;
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

  const totalSize = docs.reduce((n, d) => n + (d.size || 0), 0);

  return (
    <div className={s.docs}>
      <div className={s.docsHead}>
        <span className={s.sectionLabelInline}>Documents</span>
        <span className={s.headSpacer} />
        {docs.length > 0 && (
          <span className={s.docsCount}>{docs.length} file{docs.length === 1 ? "" : "s"} · {docSize(totalSize)}</span>
        )}
      </div>
      {docs.length > 0 && (
        <div className={s.list}>
          {docs.map((d) => (
            <div key={d.id} className={s.docRow}>
              <span className={s.docBadge}>{docExt(d.type)}</span>
              <button onClick={() => open(d)} className={s.docOpen}>
                <div className={s.docName}>{openingId === d.id ? "Opening…" : d.name}</div>
                <div className={s.docMeta}>{docSize(d.size)} <PersonBadge member={membersById[d.addedBy]} size="disc" /></div>
              </button>
              <button onClick={() => del(d)} aria-label="Delete" className={s.iconBtn}><Icon name="x" size={14} strokeWidth={2} /></button>
            </div>
          ))}
        </div>
      )}
      <Button full variant="tonal" icon="plus" onClick={() => fileRef.current?.click()} disabled={busy} className={s.addDoc}>
        {busy ? "Uploading…" : "Add a document"}
      </Button>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className={s.hiddenFile} onChange={onPick} />
      <p className={s.docsHint}>
        Shared with everyone on the trip. Avoid uploading sensitive scans like passport photo pages unless you need to.
      </p>
      {error && <p className={s.error}>{error}</p>}

      {viewer && <ImageViewer viewer={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}

// Full-screen document image preview (own component so it can register with
// the Back-button stack). Dark viewer surface is a deliberate photo affordance.
function ImageViewer({ viewer, onClose }) {
  const requestClose = useBackClose(onClose);
  return (
    <div className={s.viewer} onClick={requestClose}>
      <div className={s.viewerInner}>
        <img src={viewer.url} alt={viewer.name} className={s.viewerImg} />
        <p className={s.viewerCaption}>{viewer.name} · tap to close</p>
      </div>
    </div>
  );
}
