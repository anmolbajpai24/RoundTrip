import { useState } from "react";
import { useTripConfig, fmtMoney, fmtHome, currencySymbol } from "../lib/tripConfig.js";
import { saveKey } from "../lib/storage.js";
import { onColor } from "../theme.js";
import SectionTitle from "../components/SectionTitle.jsx";
import PersonBadge from "../components/PersonBadge.jsx";
import Icon from "../components/ui/icons.jsx";
import Button from "../components/ui/Button.jsx";
import { Input } from "../components/ui/Field.jsx";
import ProgressBar from "../components/ui/ProgressBar.jsx";
import s from "./BudgetTab.module.css";

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
  const spent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = (budget ?? 0) - spent;
  const pct = budget ? Math.min(100, (spent / budget) * 100) : 0;
  const homeSpent = fmtHome(config, spent);
  const barColor = pct > 90 ? "var(--danger)" : pct > 70 ? "var(--warning)" : "var(--success)";

  const persist = (next) => { setExpenses(next); saveKey("trip-expenses", next); };
  const add = () => {
    const a = parseFloat(amount);
    if (!desc.trim() || isNaN(a) || a <= 0) return;
    persist([{ id: Date.now(), desc: desc.trim(), amount: a, cat, paidBy: paidBy || myId, ts: new Date().toISOString() }, ...expenses]);
    setDesc(""); setAmount("");
  };
  const remove = (id) => persist(expenses.filter((e) => e.id !== id));

  const byCat = CATS.map((c) => ({ c, total: expenses.filter((e) => e.cat === c).reduce((sum, e) => sum + e.amount, 0) })).filter((x) => x.total > 0);

  // Settle-up: each member's fair share is an equal split of everything spent.
  const n = Math.max(members.length, 1);
  const share = spent / n;
  const balances = members.map((m) => {
    const paid = expenses.filter((e) => e.paidBy === m.user_id).reduce((sum, e) => sum + e.amount, 0);
    return { member: m, paid, net: paid - share };
  });

  const sub = budget
    ? `Budget ${money(budget)} for the trip${config.homeCurrency ? ` · ${money(1)} ≈ ${fmtHome(config, 1)}` : ""}`
    : `Tracking in ${cur}${config.homeCurrency ? ` · ${money(1)} ≈ ${fmtHome(config, 1)}` : ""}`;

  return (
    <div>
      <SectionTitle sub={sub}>Budget</SectionTitle>

      <div className={s.summary}>
        <div className={s.summaryTop}>
          <div>
            <div className={s.statLabel}>Spent</div>
            <div className={s.statNum}>{money(spent)}</div>
            {homeSpent && <div className={s.statSub}>≈ {homeSpent}</div>}
          </div>
          {budget != null && (
            <div className={s.statRight}>
              <div className={s.statLabel}>{remaining >= 0 ? "Left" : "Over"}</div>
              <div className={[s.statNum, remaining >= 0 ? s.good : s.bad].join(" ")}>{money(Math.abs(remaining))}</div>
            </div>
          )}
        </div>
        {budget != null && <ProgressBar value={pct} max={100} color={barColor} route className={s.bar} />}
        {byCat.length > 0 && (
          <div className={s.catTotals}>
            {byCat.map((x) => (
              <span key={x.c} className={s.catTotal}>{x.c} {money(x.total)}</span>
            ))}
          </div>
        )}
      </div>

      {/* Settle-up */}
      {members.length > 1 && spent > 0 && (
        <div className={s.card}>
          <div className={s.cardLabel}>Who paid · settle up</div>
          <div className={s.settleList}>
            {balances.map(({ member, paid, net }) => {
              const settled = Math.abs(net) < 0.5;
              return (
                <div key={member.user_id} className={s.settleRow}>
                  <span className={s.settleWho}>
                    <PersonBadge member={member} size="xs" />
                    <span className={s.settlePaid}>paid {money(paid)}</span>
                  </span>
                  <span className={[s.settleNet, settled || net > 0 ? s.good : s.bad].join(" ")}>
                    {settled ? "settled" : net > 0 ? `owed ${money(net)}` : `owes ${money(-net)}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={s.card}>
        <div className={s.addRow}>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What was it?" className={s.descInput} />
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={currencySymbol(cur)} inputMode="decimal" className={s.amtInput} />
        </div>
        <div className={s.chipRow}>
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={[s.catChip, cat === c && s.catChipActive].filter(Boolean).join(" ")}>{c}</button>
          ))}
        </div>
        <div className={s.paidRow}>
          <span className={s.paidLabel}>Paid by</span>
          {members.map((m) => {
            const active = paidBy === m.user_id;
            return (
              <button key={m.user_id} onClick={() => setPaidBy(m.user_id)}
                className={[s.payer, active && s.payerActive].filter(Boolean).join(" ")}
                style={active ? { backgroundColor: m.color, borderColor: m.color, color: onColor(m.color) } : undefined}>
                {m.name}
              </button>
            );
          })}
        </div>
        <Button full onClick={add}>Add expense</Button>
      </div>

      {expenses.length === 0 ? (
        <p className={s.emptyNote}>No expenses yet — log your first coffee.</p>
      ) : (
        <div className={s.list}>
          {expenses.map((e) => (
            <div key={e.id} className={s.expRow}>
              <div className={s.expMain}>
                <div className={s.expDesc}>{e.desc}</div>
                <div className={s.expMeta}>
                  {e.cat} · {new Date(e.ts).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  {e.paidBy && <PersonBadge member={membersById[e.paidBy]} size="xs" />}
                </div>
              </div>
              <div className={s.expAmt}>{money(e.amount, 2)}</div>
              <button onClick={() => remove(e.id)} aria-label="Remove" className={s.expRemove}><Icon name="x" size={13} strokeWidth={2} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
