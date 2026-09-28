import { useState } from 'react';
import { BottomNav, Header } from '../components/Chrome';
import { Lead, Leader, Mast, SecHead } from '../components/Dish';
import { Icon } from '../components/Icon';
import { arr, listText, str } from '../interview/helpers';
import { ING, SECTION_ORDER } from '../planning/data/ingredients';
import { goalsOf } from '../planning/goals';
import { costEstimate, groceryList, type GroceryEdits, type GroceryItem } from '../planning/grocery';
import { buysMonthly, forecastWeeks, freezeOnArrival, monthList, MONTH_WEEKS } from '../planning/month';
import { defaultVariety } from '../planning/rules';
import { DAY_FULL, type Day } from '../planning/types';
import { useRemy } from '../store';

type Edit = (fn: (g: GroceryEdits) => GroceryEdits) => void;

/** The shopping list in the menu look: aisles as sections, item ........ amount, and the estimated total at the bottom like a bill. */
export function Grocery() {
  const { planState, ctx, actions } = useRemy();
  const [tab, setTab] = useState<'week' | 'month'>('week');
  if (!planState.plan) return null;
  const A = ctx.A;
  const monthly = planState.shopping === 'monthly';
  const view = monthly ? tab : 'week';
  const weekItems = groceryList(planState.plan, A, planState.groceries);
  // Shopping monthly: staples come off the weekly list and go on the month's list.
  const staplesThisWeek = monthly ? weekItems.filter((x) => !x.custom && buysMonthly(x.k) && !x.home) : [];
  const weekly = monthly ? weekItems.filter((x) => x.custom || !buysMonthly(x.k)) : weekItems;
  const month = monthly
    ? monthList(forecastWeeks(planState.plan, planState.variety ?? defaultVariety(A), ctx, goalsOf(planState.nutrition)), A, planState.month.edits)
    : [];
  const weekCost = costEstimate(weekly, A);
  const monthCost = costEstimate(month, A);
  const toBuy = weekly.filter((x) => !x.home).length;
  const prepDay = DAY_FULL[(str(A.prepday) || 'Sun') as Day];

  return (
    <>
      <Header title="Grocery list" sub={view === 'month' ? `Staples for the next ${MONTH_WEEKS} weeks` : `For ${prepDay} prep · ${toBuy} to buy`} />
      <main className="body wide">
        {monthly && (
          <div className="seg top-gap" role="group" aria-label="Which list">
            <button type="button" aria-pressed={tab === 'week'} onClick={() => setTab('week')}>
              This week
            </button>
            <button type="button" aria-pressed={tab === 'month'} onClick={() => setTab('month')}>
              This month
            </button>
          </div>
        )}

        {view === 'week' ? (
          <>
            <Mast kicker={`For ${prepDay} prep`} icon="cart" title="This week" sub={`${toBuy} to buy${monthly ? ', staples come from your monthly shop' : ''}`} />
            <ListView items={weekly} edits={planState.groceries} edit={actions.groceryEdit} cost={weekCost} monthlyShare={monthly && monthCost.show ? monthCost.low / MONTH_WEEKS : 0} />
            {staplesThisWeek.length > 0 && (
              <section className="msec">
                <details>
                  <summary className="row summary-toggle">
                    <Icon name="box" size={18} /> From your monthly shop ({staplesThisWeek.length})
                  </summary>
                  {staplesThisWeek.some((x) => freezeOnArrival(x.k)) && (
                    <p className="lead-note">
                      <b>The day before {prepDay}:</b> move{' '}
                      {listText(staplesThisWeek.filter((x) => freezeOnArrival(x.k)).map((x) => `${x.qtyText} ${x.n.toLowerCase()}`))} from the freezer to the fridge to thaw.
                    </p>
                  )}
                  <p className="hint">Already bought this month. This week uses:</p>
                  {staplesThisWeek.map((x) => (
                    <Lead key={x.k} k={x.n} v={x.qtyText} />
                  ))}
                </details>
              </section>
            )}
          </>
        ) : (
          <>
            <Mast kicker={`Staples for ${MONTH_WEEKS} weeks`} icon="cart" title="This month" sub={`${month.filter((x) => !x.home).length} to buy in one go`} />
            <div className="gap-top-lg">
              <p className="lead-note">
                An estimate from this week’s plan and how Remy rotates meals over the next {MONTH_WEEKS} weeks. Check-ins can change later weeks, so treat it as a guide; staples keep, and
                anything left over carries into next month.
              </p>
              <p className="lead-note">
                <b>When you get home:</b> freeze meat and fish in weekly bags (label them with the date). Keep potatoes somewhere cool and dark, not in the fridge.
              </p>
            </div>
            <ListView items={month} edits={planState.month.edits} edit={actions.monthEdit} cost={monthCost} period="month" />
            <button type="button" className="btn ghost wide gap-top-lg" onClick={actions.newMonth}>
              <Icon name="cal" size={17} /> Start a new month
            </button>
          </>
        )}

        <section className="msec">
          <SecHead title="How you shop" />
          <div className="seg gap-top" role="group" aria-label="How you shop">
            <button type="button" aria-pressed={!monthly} onClick={() => actions.setShopping('weekly')}>
              All weekly
            </button>
            <button type="button" aria-pressed={monthly} onClick={() => actions.setShopping('monthly')}>
              Staples monthly
            </button>
          </div>
          {monthly && (
            <p className="hint gap-top">
              Monthly: meat and fish, grains and pasta, pantry, hard cheese, frozen food and potatoes. Weekly: fresh fruit and vegetables, milk, yogurt, eggs, soft cheese and bread.
            </p>
          )}
        </section>
      </main>
      <BottomNav />
    </>
  );
}

/** One shopping list: progress, add an item, aisles, “already at home”, removed items and the estimated total. */
function ListView({
  items,
  edits,
  edit,
  cost,
  period = 'week',
  monthlyShare = 0,
}: {
  items: GroceryItem[];
  edits: GroceryEdits;
  edit: Edit;
  cost: ReturnType<typeof costEstimate>;
  period?: 'week' | 'month';
  monthlyShare?: number;
}) {
  const { ctx, actions } = useRemy();
  const [open, setOpen] = useState<string | null>(null);
  const [newItem, setNewItem] = useState('');
  const A = ctx.A;
  const buy = items.filter((x) => !x.home);
  const home = items.filter((x) => x.home);
  const checked = buy.filter((x) => edits.checked[x.k]).length;
  const deletedCount = Object.keys(edits.deleted).length;
  // From later check-in questions.
  const brands = arr(A.brands);
  const frozen = A.frozenveg === 'Fresh only' ? buy.filter((x) => x.sec === 'Frozen' && ING[x.k]?.f) : [];

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
        <div className={`gline${done ? ' done' : ''}`}>
          <button type="button" className="cb" aria-pressed={done} aria-label={`Check off ${x.n}`} onClick={() => edit((g) => ({ ...g, checked: { ...g.checked, [x.k]: !done } }))}>
            <span>{done && <Icon name="check" size={16} />}</span>
          </button>
          <button type="button" className="gline-main" aria-expanded={open === x.k} onClick={() => setOpen(open === x.k ? null : x.k)}>
            <span className="dish-line">
              <span className="nm">{x.n}</span>
              <Leader />
              <span className="qty">{x.qtyText || '—'}</span>
            </span>
            <span className="from">
              {x.from.join(', ')}
              {x.packs && ` · ${x.packs}`}
            </span>
          </button>
          {cost.show && <span className="price">{x.cost !== null ? `$${x.cost.toFixed(2)}` : ''}</span>}
        </div>
        {open === x.k && (
          <div className="gline-edit">
            <label className="hint" htmlFor={`qty-${period}-${x.k}`}>
              Quantity
            </label>
            <input
              id={`qty-${period}-${x.k}`}
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

  // The budget is weekly: a month's list is compared with 4 weeks of it, and a weekly list with a share of the month's staples.
  const budget = cost.show ? (period === 'month' ? cost.budget * MONTH_WEEKS : cost.budget) : 0;
  const high = cost.show ? cost.high + monthlyShare : 0;
  const low = cost.show ? cost.low + monthlyShare : 0;
  const status = cost.show ? (high <= budget ? ['p-ok', 'Within'] : low > budget ? ['p-warn', 'Over'] : ['p-warn', 'Close to']) : null;

  return (
    <>
      <div className="progress-line">
        <div className="bar tall" role="progressbar" aria-valuenow={checked} aria-valuemax={buy.length} aria-label="Items checked off">
          <div style={{ width: `${buy.length ? Math.round((100 * checked) / buy.length) : 0}%` }} />
        </div>
        <span className="mono hint">
          {checked}/{buy.length}
        </span>
      </div>

      {(brands.length > 0 || frozen.length > 0) && (
        <div className="gap-top-lg">
          {brands.length > 0 && (
            <p className="lead-note">
              <b>Your brands:</b> {listText(brands)}
            </p>
          )}
          {frozen.length > 0 && (
            <p className="lead-note">
              <b>You prefer fresh:</b> buy {listText(frozen.map((x) => x.n.replace(/^Frozen /, '').toLowerCase()))} fresh instead of frozen. Fresh produce keeps only a few days, so
              use it early in the week.
            </p>
          )}
        </div>
      )}

      <div className="row gap-top-lg">
        <input className="field grow" placeholder="Add an item" aria-label={`Add an item to the ${period === 'month' ? 'monthly' : 'weekly'} list`} value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button type="button" className="btn sm tall" onClick={add}>
          <Icon name="plus" size={18} /> Add
        </button>
      </div>

      <div className="masonry aisles">
        {SECTION_ORDER.map((sec) => {
          const list = buy.filter((x) => x.sec === sec);
          if (!list.length) return null;
          return (
            <section className="aisle" key={sec}>
              <SecHead title={sec} aside={list.length} />
              <div>{list.map(row)}</div>
            </section>
          );
        })}
      </div>

      {home.length > 0 && (
        <section className="msec">
          <details>
            <summary className="row summary-toggle">
              <Icon name="home" size={18} /> Already at home ({home.length})
            </summary>
            {home.map((x) => (
              <div className="gline" key={x.k}>
                <div className="gline-main">
                  <span className="nm muted">{x.n}</span>
                  <span className="from">From your pantry answer{x.qtyText && ` · need ${x.qtyText}`}</span>
                </div>
                <button type="button" className="btn sm ghost" onClick={() => edit((g) => ({ ...g, have: { ...g.have, [x.k]: false } }))}>
                  Need to buy
                </button>
              </div>
            ))}
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

      {cost.show ? (
        <div className="bill">
          <div className="dish-line">
            <span className="dish-name">Estimated total</span>
            <Leader />
            <span className="dish-kcal">
              ${cost.low}–{cost.high}
            </span>
          </div>
          <div className="row wrap gap-top">
            <span className={`pill ${status![0]}`}>
              {status![1]} ${budget}
            </span>
            <span className="bill-note grow">
              Rough estimate at a typical US supermarket{period === 'month' ? `, for ${MONTH_WEEKS} weeks` : ''}
              {cost.unknown > 0 && ` · excludes ${cost.unknown} item${cost.unknown > 1 ? 's' : ''} you added`}
            </span>
          </div>
          {monthlyShare > 0 && <p className="bill-note">Plus about ${Math.round(monthlyShare)} a week of staples from your monthly shop, counted in the budget check.</p>}
          {period === 'week' && cost.carryOver > 3 && <p className="bill-note">About ${cost.carryOver} of that is sauce, butter and other staples left over for next week.</p>}
        </div>
      ) : (
        <div className="bill row">
          <Icon name="info" size={18} />
          <span className="hint">{cost.why}</span>
        </div>
      )}
    </>
  );
}
