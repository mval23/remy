import { useState } from 'react';
import { BottomNav, Header } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { str } from '../interview/helpers';
import { SECTION_ORDER } from '../planning/data/ingredients';
import { costEstimate, groceryList, type GroceryItem } from '../planning/grocery';
import { DAY_FULL, type Day } from '../planning/types';
import { useRemy } from '../store';

export function Grocery() {
  const { planState, ctx, actions } = useRemy();
  const [open, setOpen] = useState<string | null>(null);
  const [newItem, setNewItem] = useState('');
  if (!planState.plan) return null;
  const A = ctx.A;
  const edits = planState.groceries;
  const items = groceryList(planState.plan, A, edits);
  const buy = items.filter((x) => !x.home);
  const home = items.filter((x) => x.home);
  const cost = costEstimate(items, A);
  const checked = buy.filter((x) => edits.checked[x.k]).length;
  const deletedCount = Object.keys(edits.deleted).length;
  const edit = actions.groceryEdit;

  const add = () => {
    const n = newItem.trim();
    if (!n) return;
    edit((g) => ({ ...g, custom: [...g.custom, { id: `c${Date.now()}`, n, sec: 'Other', q: '' }] }));
    setNewItem('');
    actions.toast(`Added ${n}`);
  };

  const row = (x: GroceryItem) => {
    const done = !!edits.checked[x.k];
    return (
      <div key={x.k}>
        <div className={`gi${done ? ' done' : ''}`}>
          <button
            type="button"
            className="cb"
            aria-pressed={done}
            aria-label={`Check off ${x.n}`}
            onClick={() => edit((g) => ({ ...g, checked: { ...g.checked, [x.k]: !done } }))}
          >
            {done && <Icon name="check" size={16} />}
          </button>
          <button type="button" className="gi-main" aria-expanded={open === x.k} onClick={() => setOpen(open === x.k ? null : x.k)}>
            <div className="nm">{x.n}</div>
            <div className="hint small">
              {x.from.join(', ')}
              {x.packs && ` · ${x.packs}`}
            </div>
          </button>
          <span className="qty">{x.qtyText || '—'}</span>
          {cost.show && <span className="price">{x.cost !== null ? `$${x.cost.toFixed(2)}` : ''}</span>}
        </div>
        {open === x.k && (
          <div className="gi gi-edit">
            <label className="hint" htmlFor={`qty-${x.k}`}>Quantity</label>
            <input
              id={`qty-${x.k}`}
              className="field qty-field"
              value={edits.qty[x.k] ?? x.qtyText}
              onChange={(e) => edit((g) => ({ ...g, qty: { ...g.qty, [x.k]: e.target.value } }))}
              onKeyDown={(e) => e.key === 'Enter' && setOpen(null)}
            />
            <button type="button" className="btn sm soft" onClick={() => { edit((g) => ({ ...g, have: { ...g.have, [x.k]: true } })); setOpen(null); actions.toast('Moved to “Already at home”'); }}>
              <Icon name="home" size={15} /> I have this
            </button>
            <button type="button" className="btn sm ghost" onClick={() => { edit((g) => ({ ...g, deleted: { ...g.deleted, [x.k]: true } })); setOpen(null); actions.toast('Item removed'); }}>
              <Icon name="trash" size={15} /> Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  const status = cost.show ? (cost.high <= cost.budget ? ['p-ok', 'Within'] : cost.low > cost.budget ? ['p-warn', 'Over'] : ['p-warn', 'Close to']) : null;

  return (
    <>
      <Header title="Grocery list" sub={`For ${DAY_FULL[(str(A.prepday) || 'Sun') as Day]} prep · ${buy.length} to buy`} />
      <main className="body">
        {cost.show ? (
          <div className="panel top-gap">
            <div className="row">
              <div className="grow">
                <div className="stat">${cost.low}–{cost.high}</div>
                <p className="hint">
                  Rough estimate at a typical US supermarket
                  {cost.unknown > 0 && ` · excludes ${cost.unknown} item${cost.unknown > 1 ? 's' : ''} you added`}
                </p>
              </div>
              <span className={`pill ${status![0]}`}>{status![1]} ${cost.budget}</span>
            </div>
            {cost.carryOver > 3 && <p className="hint gap-top">About ${cost.carryOver} of that is sauce, butter and other staples left over for next week.</p>}
          </div>
        ) : (
          <div className="panel row top-gap">
            <Icon name="info" size={18} />
            <span className="hint">{cost.why}</span>
          </div>
        )}

        <div className="row gap-top-lg">
          <div className="grow bar tall" role="progressbar" aria-valuenow={checked} aria-valuemax={buy.length} aria-label="Items checked off">
            <div style={{ width: `${buy.length ? Math.round((100 * checked) / buy.length) : 0}%` }} />
          </div>
          <span className="mono hint">{checked}/{buy.length}</span>
        </div>

        <div className="row gap-top-lg">
          <input className="field grow" placeholder="Add an item" aria-label="Add a grocery item" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button type="button" className="btn sm tall" onClick={add}>
            <Icon name="plus" size={18} /> Add
          </button>
        </div>

        {SECTION_ORDER.map((sec) => {
          const list = buy.filter((x) => x.sec === sec);
          if (!list.length) return null;
          return (
            <section className="sec" key={sec}>
              <h2>
                <span className="grow">{sec}</span>
                <span className="mono">{list.length}</span>
              </h2>
              <div className="list">{list.map(row)}</div>
            </section>
          );
        })}

        {home.length > 0 && (
          <section className="sec">
            <details>
              <summary className="row summary-toggle">
                <Icon name="home" size={18} /> Already at home ({home.length})
              </summary>
              <div className="list gap-top">
                {home.map((x) => (
                  <div className="gi" key={x.k}>
                    <div className="grow">
                      <div className="nm muted">{x.n}</div>
                      <div className="hint small">From your pantry answer{x.qtyText && ` · need ${x.qtyText}`}</div>
                    </div>
                    <button type="button" className="btn sm ghost" onClick={() => edit((g) => ({ ...g, have: { ...g.have, [x.k]: false } }))}>
                      Need to buy
                    </button>
                  </div>
                ))}
              </div>
            </details>
          </section>
        )}

        {deletedCount > 0 && (
          <p className="hint gap-top-lg">
            {deletedCount} item{deletedCount > 1 ? 's' : ''} removed.{' '}
            <button type="button" className="linkbtn tight inline" onClick={() => edit((g) => ({ ...g, deleted: {} }))}>
              Restore
            </button>
          </p>
        )}
      </main>
      <BottomNav />
    </>
  );
}
