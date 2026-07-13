import { useState } from "react";
import { useTripConfig, fmtMoney, fmtHome, currencySymbol } from "../lib/tripConfig.js";
import { saveKey } from "../lib/storage.js";
import SectionTitle from "../components/SectionTitle.jsx";
import PersonBadge from "../components/PersonBadge.jsx";

const CATS = ["Food", "Transport", "Stay", "Sights", "Shows", "Shopping", "Other"];

export default function BudgetTab({ expenses, setExpenses, members, membersById, myId }) {
  const config = useTripConfig();
  const cur = config.currency || "USD";
  const budget = config.budget ?? null;
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("Food");
  const [paidBy, setPaidBy] = useState(myId);

  const money = (n, frac = 0) => fmtMoney(n, cur, frac);
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = (budget ?? 0) - spent;
  const pct = budget ? Math.min(100, (spent / budget) * 100) : 0;
  const homeSpent = fmtHome(config, spent);

  const persist = (next) => { setExpenses(next); saveKey("trip-expenses", next); };
  const add = () => {
    const a = parseFloat(amount);
    if (!desc.trim() || isNaN(a) || a <= 0) return;
    persist([{ id: Date.now(), desc: desc.trim(), amount: a, cat, paidBy: paidBy || myId, ts: new Date().toISOString() }, ...expenses]);
    setDesc(""); setAmount("");
  };
  const remove = (id) => persist(expenses.filter((e) => e.id !== id));

  const byCat = CATS.map((c) => ({ c, total: expenses.filter((e) => e.cat === c).reduce((s, e) => s + e.amount, 0) })).filter((x) => x.total > 0);

  // Settle-up: each member's fair share is an equal split of everything spent.
  const n = Math.max(members.length, 1);
  const share = spent / n;
  const balances = members.map((m) => {
    const paid = expenses.filter((e) => e.paidBy === m.user_id).reduce((s, e) => s + e.amount, 0);
    return { member: m, paid, net: paid - share };
  });

  const sub = budget
    ? `Budget ${money(budget)} for the trip${config.homeCurrency ? ` · ${money(1)} ≈ ${fmtHome(config, 1)}` : ""}`
    : `Tracking in ${cur}${config.homeCurrency ? ` · ${money(1)} ≈ ${fmtHome(config, 1)}` : ""}`;

  return (
    <div>
      <SectionTitle sub={sub}>Budget</SectionTitle>

      <div className="rounded-2xl border p-4 mb-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Spent</div>
            <div className="text-2xl font-bold" style={{ color: "var(--ink)", fontFamily: "ui-monospace, monospace" }}>{money(spent)}</div>
            {homeSpent && <div className="text-xs" style={{ color: "var(--muted)" }}>≈ {homeSpent}</div>}
          </div>
          {budget != null && (
            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{remaining >= 0 ? "Left" : "Over"}</div>
              <div className="text-2xl font-bold" style={{ color: remaining >= 0 ? "#2E7D4F" : "#C8102E", fontFamily: "ui-monospace, monospace" }}>{money(Math.abs(remaining))}</div>
            </div>
          )}
        </div>
        {budget != null && (
          <div className="h-2.5 rounded-full mt-3" style={{ backgroundColor: "var(--chip)" }}>
            <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct > 90 ? "#C8102E" : pct > 70 ? "#C77E1F" : "#2E7D4F" }} />
          </div>
        )}
        {byCat.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {byCat.map((x) => (
              <span key={x.c} className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "var(--chip)", color: "var(--ink)" }}>{x.c} {money(x.total)}</span>
            ))}
          </div>
        )}
      </div>

      {/* Settle-up */}
      {members.length > 1 && spent > 0 && (
        <div className="rounded-2xl border p-4 mb-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>Who paid · settle up</div>
          <div className="space-y-2">
            {balances.map(({ member, paid, net }) => (
              <div key={member.user_id} className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <PersonBadge member={member} size="xs" />
                  <span className="text-[11px]" style={{ color: "var(--muted)" }}>paid {money(paid)}</span>
                </span>
                <span className="text-xs font-bold" style={{ color: Math.abs(net) < 0.5 ? "#2E7D4F" : net > 0 ? "#2E7D4F" : "#C8102E" }}>
                  {Math.abs(net) < 0.5 ? "settled" : net > 0 ? `owed ${money(net)}` : `owes ${money(-net)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border p-4 mb-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <div className="flex gap-2 mb-2">
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What was it?" className="flex-1 text-sm rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border)", backgroundColor: "var(--field)", color: "var(--ink)" }} />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={currencySymbol(cur)} inputMode="decimal" className="w-20 text-sm rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border)", backgroundColor: "var(--field)", color: "var(--ink)" }} />
        </div>
        <div className="flex gap-1.5 flex-wrap mb-3">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full border" style={{ borderColor: cat === c ? "var(--solid)" : "var(--border)", backgroundColor: cat === c ? "var(--solid)" : "var(--card)", color: cat === c ? "#FFF" : "var(--muted)" }}>{c}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Paid by</span>
          {members.map((m) => (
            <button key={m.user_id} onClick={() => setPaidBy(m.user_id)} className="text-[11px] font-semibold px-3 py-1.5 rounded-full border" style={{ borderColor: paidBy === m.user_id ? m.color : "var(--border)", backgroundColor: paidBy === m.user_id ? m.color : "var(--card)", color: paidBy === m.user_id ? "#FFF" : "var(--muted)" }}>{m.name}</button>
          ))}
        </div>
        <button onClick={add} className="w-full text-sm font-bold text-white py-2.5 rounded-full" style={{ backgroundColor: "#C8102E" }}>Add expense</button>
      </div>

      {expenses.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: "var(--faint)" }}>No expenses yet — log your first coffee.</p>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
          {expenses.map((e, i) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < expenses.length - 1 ? "1px solid var(--divider)" : "none" }}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>{e.desc}</div>
                <div className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                  {e.cat} · {new Date(e.ts).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  {e.paidBy && <PersonBadge member={membersById[e.paidBy]} size="xs" />}
                </div>
              </div>
              <div className="text-sm font-bold" style={{ color: "var(--ink)", fontFamily: "ui-monospace, monospace" }}>{money(e.amount, 2)}</div>
              <button onClick={() => remove(e.id)} className="text-xs px-1" style={{ color: "var(--faint)" }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
