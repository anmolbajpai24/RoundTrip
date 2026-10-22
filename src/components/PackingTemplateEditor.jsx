import { Input, TextArea } from "./ui/Field.jsx";
import Icon from "./ui/icons.jsx";
import s from "./PackingTemplateEditor.module.css";

// Organiser-only editor in trip settings. Members' lists are seeded from the
// template when they first open the trip, so later edits don't reach people
// who already have a list.
export default function PackingTemplateEditor({ draft, setDraft }) {
  const update = (i, patch) => setDraft((d) => d.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const remove = (i) => setDraft((d) => d.filter((_, j) => j !== i));
  const add = () => setDraft((d) => [...d, { cat: "", text: "" }]);

  return (
    <div>
      <p className={s.note}>
        Members get this list when they join. Set it before you share the link: people already on the trip keep their own list.
      </p>
      <div className={s.list}>
        {draft.map((c, i) => (
          <div key={i} className={s.cat}>
            <div className={s.catHead}>
              <Input value={c.cat} onChange={(e) => update(i, { cat: e.target.value })} maxLength={30}
                placeholder="Category, e.g. Clothes" aria-label="Category name" className={s.catName} />
              <button onClick={() => remove(i)} aria-label={`Remove ${c.cat || "category"}`} className={s.remove}>
                <Icon name="x" size={13} strokeWidth={1.8} />
              </button>
            </div>
            <TextArea value={c.text} onChange={(e) => update(i, { text: e.target.value })} rows={4}
              placeholder={"One item per line\ne.g. Warm jacket"} aria-label={`Items in ${c.cat || "this category"}`} />
          </div>
        ))}
        <div className={s.addRow}>
          <button onClick={add} className={s.addBtn}>
            <Icon name="plus" size={12} strokeWidth={2} /> Add a category
          </button>
        </div>
      </div>
    </div>
  );
}
