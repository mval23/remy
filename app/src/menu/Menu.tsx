import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { describe } from '../components/Dish';
import { Icon } from '../components/Icon';
import { MacroRow } from '../components/Macros';
import { baseSlot, R } from '../planning/data/recipes';
import { isDetailed, renderLine, scaledIngredients } from '../planning/method';
import { nutritionSource } from '../planning/macros';
import type { Recipe, Slot } from '../planning/types';

/**
 * Every recipe in Remy as a restaurant menu, with calories and macros per portion and the full preparation.
 * Runs only on the owner's computer (menu.html with `npm run dev`). Deleting a recipe writes removed.json
 * through the dev server, so once published, Remy never plans it again.
 */

const SECTIONS: { slot: Slot | 'Side'; name: string; blurb: string }[] = [
  { slot: 'Breakfast', name: 'Breakfast', blurb: 'Made on prep day, ready to grab.' },
  { slot: 'Lunch', name: 'Lunch', blurb: 'Bowls, bakes and sheet-pan plates that reheat well.' },
  { slot: 'Dinner', name: 'Dinner', blurb: 'Comfort food and lighter plates.' },
  { slot: 'Afternoon snack', name: 'Snacks', blurb: 'Something between lunch and dinner.' },
  { slot: 'Evening sweet', name: 'Sweets', blurb: 'Planned and portioned, every day if you like.' },
  { slot: 'Side', name: 'Sides', blurb: 'Added to a meal for protein or a serving of fruit and veg.' },
];

type Sort = 'menu' | 'kcal' | 'protein';

const handsOn = (r: Recipe) => r.tasks.filter((t) => t.l === 'hands').reduce((s, t) => s + t.m, 0);

function tags(r: Recipe): string[] {
  if (r.side && r.st) return [r.st.l.replace(' · ', ', ')];
  const out: string[] = [];
  if (r.store) out.push('Store-bought');
  else if (r.room) out.push(`Keeps ${r.fridge} days in the pantry`);
  else if (r.fridge) out.push(`Fridge ${r.fridge} day${r.fridge > 1 ? 's' : ''}`);
  out.push(r.freezer ? `Freezes ${r.freezer} month${r.freezer > 1 ? 's' : ''}` : r.store ? 'Keep frozen' : 'Not for the freezer');
  if (!r.side) out.push(`Makes ${r.serves}`);
  const h = handsOn(r);
  if (h) out.push(`${h} min hands-on`);
  if (r.cold) out.push('Eaten cold');
  return out;
}

async function saveSlot(id: string, slot: Slot | null): Promise<void> {
  const res = await fetch('/__menu/slots', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-remy-menu': '1' }, body: JSON.stringify({ id, slot }) });
  if (!res.ok) throw new Error(String(res.status));
}

async function saveRemoved(id: string, removed: boolean): Promise<string[]> {
  const res = await fetch('/__menu/removed', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-remy-menu': '1' }, body: JSON.stringify({ id, removed }) });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

const SCROLL_KEY = 'remy-menu-scroll';

export function Menu() {
  const [removed, setRemoved] = useState<string[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<Slot | 'Side' | 'all'>('all');
  const [sort, setSort] = useState<Sort>('menu');
  const [open, setOpen] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    fetch('/__menu/removed')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setRemoved)
      .catch(() => {
        setRemoved([]);
        setProblem('Deleting only works while Remy runs on this computer (npm run dev). You can still browse the menu.');
      });
    // Saving a change reloads the page; come back to the same place.
    try {
      const y = Number(sessionStorage.getItem(SCROLL_KEY));
      if (y) requestAnimationFrame(() => window.scrollTo(0, y));
      sessionStorage.removeItem(SCROLL_KEY);
    } catch {
      /* storage blocked: start at the top */
    }
  }, []);

  const all = useMemo(() => Object.values(R).filter((r) => !r.id.startsWith('ai_')), []);
  const gone = new Set(removed ?? []);
  const q = query.trim().toLowerCase();
  const matches = (r: Recipe) => !q || `${r.name} ${r.short} ${describe(r)}`.toLowerCase().includes(q);
  const order = (list: Recipe[]) =>
    sort === 'kcal' ? [...list].sort((a, b) => a.kcal - b.kcal) : sort === 'protein' ? [...list].sort((a, b) => b.pro - a.pro) : list;
  const live = all.filter((r) => !gone.has(r.id));
  const deleted = all.filter((r) => gone.has(r.id));

  const change = async (id: string, remove: boolean) => {
    setConfirming(null);
    try {
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    } catch {
      /* fine without it */
    }
    try {
      setRemoved(await saveRemoved(id, remove));
    } catch {
      setProblem('Couldn’t save that change. Is Remy still running on this computer (npm run dev)?');
    }
  };

  /** Move a dish to another meal; choosing its own meal again undoes the move. The page reloads with the change. */
  const move = async (id: string, slot: Slot) => {
    try {
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    } catch {
      /* fine without it */
    }
    try {
      await saveSlot(id, slot === baseSlot(id) ? null : slot);
    } catch {
      setProblem('Couldn’t save that change. Is Remy still running on this computer (npm run dev)?');
    }
  };

  const recipe = open ? R[open] : null;

  return (
    <div className="menu-page">
      <header className="menu-mast">
        <p className="menu-kicker">
          <Icon name="toque" size={20} /> Remy’s kitchen
        </p>
        <h1>The menu</h1>
        <p className="menu-sub">
          {live.filter((r) => !r.side).length} dishes and {live.filter((r) => r.side).length} sides. Calories and macros are per portion, added up from the ingredients: good
          estimates, not lab numbers.
        </p>
      </header>

      <div className="menu-controls" role="search">
        <input className="field" type="search" placeholder="Search dishes or ingredients" aria-label="Search dishes or ingredients" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="chips" role="group" aria-label="Section">
          {[{ slot: 'all' as const, name: 'All' }, ...SECTIONS].map((s) => (
            <button key={s.slot} type="button" className="chip" aria-pressed={section === s.slot} onClick={() => setSection(s.slot)}>
              {s.name}
            </button>
          ))}
        </div>
        <label className="menu-sort">
          <span className="hint">Order</span>
          <select className="field" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="menu">As on the menu</option>
            <option value="kcal">Lightest first</option>
            <option value="protein">Most protein first</option>
          </select>
        </label>
      </div>

      {problem && (
        <p className="warnline menu-problem" role="status">
          <Icon name="info" size={16} /> {problem}
        </p>
      )}

      {SECTIONS.filter((s) => section === 'all' || section === s.slot).map((s) => {
        const list = order(live.filter((r) => r.slot === s.slot && matches(r)));
        if (!list.length) return null;
        return (
          <section className="menu-section" key={s.slot} aria-labelledby={`sec-${s.slot}`}>
            <div className="menu-section-head">
              <h2 id={`sec-${s.slot}`}>{s.name}</h2>
              <p className="hint">{s.blurb}</p>
            </div>
            <ul className="menu-items">
              {list.map((r) => (
                <li className="menu-item" key={r.id}>
                  <span className="menu-emoji" aria-hidden="true">
                    {r.e}
                  </span>
                  <div className="menu-body">
                    <p className="menu-line">
                      <span className="menu-name">{r.name}</span>
                      <span className="menu-dots" aria-hidden="true" />
                      <span className="menu-kcal">{r.kcal.toLocaleString('en-US')} kcal</span>
                    </p>
                    <p className="menu-desc">{describe(r)}</p>
                    <p className="menu-macros">
                      <b>{r.pro} g</b> protein · <b>{r.carb} g</b> carbs · <b>{r.fat} g</b> fat · <b>{r.fiber} g</b> fiber · <span className="hint">{nutritionSource(r.ing)}</span>
                    </p>
                    <div className="chips tight">
                      {tags(r).map((t) => (
                        <span className="pill p-muted" key={t}>
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="menu-actions">
                      <button type="button" className="btn sm soft" onClick={() => setOpen(r.id)}>
                        <Icon name="list" size={16} /> Preparation
                      </button>
                      {confirming === r.id ? (
                        <>
                          <button type="button" className="btn sm warn" onClick={() => void change(r.id, true)}>
                            <Icon name="trash" size={16} /> Delete {r.short}
                          </button>
                          <button type="button" className="btn sm ghost" onClick={() => setConfirming(null)}>
                            Keep it
                          </button>
                        </>
                      ) : (
                        <button type="button" className="btn sm ghost" onClick={() => setConfirming(r.id)} disabled={removed === null}>
                          <Icon name="trash" size={16} /> Delete
                        </button>
                      )}
                      {!r.side && (
                        <label className="menu-slot">
                          <span className="hint">Served at</span>
                          <select className="field" value={r.slot} onChange={(e) => void move(r.id, e.target.value as Slot)} disabled={!!problem}>
                            {SECTIONS.filter((x) => x.slot !== 'Side').map((x) => (
                              <option key={x.slot} value={x.slot}>
                                {x.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    {!r.side && baseSlot(r.id) && baseSlot(r.id) !== r.slot && (
                      <p className="hint">Moved here from {SECTIONS.find((x) => x.slot === baseSlot(r.id))?.name.toLowerCase()}.</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {deleted.length > 0 && (
        <section className="menu-section menu-deleted" aria-labelledby="sec-deleted">
          <div className="menu-section-head">
            <h2 id="sec-deleted">Deleted ({deleted.length})</h2>
            <p className="hint">Remy won’t plan these. The change reaches your phone and iPad once it’s published; ask Claude to publish it.</p>
          </div>
          <ul className="list">
            {deleted.map((r) => (
              <li className="li" key={r.id}>
                <span className="em-lg" aria-hidden="true">
                  {r.e}
                </span>
                <div className="grow">
                  <div className="t">{r.name}</div>
                  <div className="s">
                    {SECTIONS.find((s) => s.slot === r.slot)?.name} · {r.kcal} kcal
                  </div>
                </div>
                <button type="button" className="btn sm ghost" onClick={() => void change(r.id, false)}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recipe && <Preparation r={recipe} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** The full recipe for one batch, in a dialog. */
function Preparation({ r, onClose }: { r: Recipe; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => opener?.focus?.();
  }, []);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') onClose();
    if (e.key !== 'Tab' || !ref.current) return;
    const all = [...ref.current.querySelectorAll<HTMLElement>('button, summary, [href]')];
    if (!all.length) return;
    if (e.shiftKey && document.activeElement === all[0]) {
      e.preventDefault();
      all[all.length - 1].focus();
    } else if (!e.shiftKey && document.activeElement === all[all.length - 1]) {
      e.preventDefault();
      all[0].focus();
    }
  };
  const source = [{ r, batches: 1 }];
  const detailed = isDetailed(r);
  const bold = (line: string) => renderLine(line, source).map((p, i) => (p.amount ? <b key={i}>{p.t}</b> : <span key={i}>{p.t}</span>));

  return (
    <div className="menu-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="menu-dialog" role="dialog" aria-modal="true" aria-labelledby="prep-title" tabIndex={-1} ref={ref} onKeyDown={onKeyDown}>
        <button type="button" className="iconbtn menu-close" aria-label="Close" onClick={onClose}>
          <Icon name="x" size={20} />
        </button>
        <p className="menu-kicker">
          <span aria-hidden="true">{r.e}</span> {SECTIONS.find((s) => s.slot === r.slot)?.name}
        </p>
        <h2 id="prep-title" className="menu-dialog-title">
          {r.name}
        </h2>
        <MacroRow n={r} note="per portion" />
        <p className="hint gap-top">{r.side ? 'One portion.' : `Makes ${r.serves} portions. ${r.plate}`}</p>
        {r.note && (
          <p className="warnline">
            <Icon name="info" size={16} /> {r.note}
          </p>
        )}

        <h3>Ingredients</h3>
        <ul className="menu-ing">
          {scaledIngredients(r, 1).map((x) => (
            <li key={x.k}>
              <b>{x.amount}</b> {x.name}
            </li>
          ))}
        </ul>

        <h3>Preparation</h3>
        {detailed ? (
          <ol className="menu-method">
            {r.tasks.map((t, i) => (
              <li key={i}>
                <p className="strong">
                  {t.t} <span className="hint">· {t.m} min{t.temp ? ` · ${t.temp}°C` : ''}</span>
                </p>
                <ul>
                  {(t.how ?? []).map((line, j) => (
                    <li key={j}>{bold(line)}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        ) : r.steps.length ? (
          <ol className="menu-method simple">
            {r.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        ) : (
          <p className="hint">Ready to eat. Nothing to cook.</p>
        )}

        {!r.side && (
          <>
            <h3>Storing and reheating</h3>
            <ul className="menu-ing">
              <li>
                <b>Fridge:</b> {r.store ? 'Keep frozen until eating.' : r.room ? `Airtight, at room temperature, up to ${r.fridge} days.` : r.fridge ? `Up to ${r.fridge} days after prep day, at 4°C or colder.` : 'Not kept in the fridge; it goes straight to the freezer.'}
              </li>
              <li>
                <b>Freezer:</b> {r.freezer ? `Up to ${r.freezer} months, at −18°C.` : 'Don’t freeze.'}
              </li>
              {r.thaw && (
                <li>
                  <b>Thawing:</b> {r.thaw}
                </li>
              )}
              <li>
                <b>Reheating:</b> {r.reheat}
              </li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
