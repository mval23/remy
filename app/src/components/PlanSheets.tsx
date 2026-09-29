import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { FOODS } from '../interview/questions';
import { R, SIDE_IDS } from '../planning/data/recipes';
import { REJECT_REASONS, WEEKS } from '../planning/data/weeks';
import { estimatesOn, sideOptions } from '../planning/nutrition';
import { approvalCounts, autoReplacement, handsOnMinutes, menuCountText, moveBlocker, replacementOptions, sortOptions, type OptionOrder } from '../planning/planner';
import { heatShort } from '../planning/method';
import { check, matches, storage, windowMinutes } from '../planning/rules';
import { duration, schedule } from '../planning/schedule';
import { goalsOf, hasGoals, weekAverage } from '../planning/goals';
import { str } from '../interview/helpers';
import { DAY_FULL, DAYS, SLOT_SHORT, type Day, type Variety } from '../planning/types';
import { useRemy, type SheetArg } from '../store';
import { AiIdea } from './AiIdea';
import { StoragePill } from './Chrome';
import { Icon, type IconName } from './Icon';
import { describe, DishLine, MacroLine, Mast, SecHead } from './Dish';

const FOCUSABLE = 'button:not(:disabled), [href], input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/** A bottom sheet: takes keyboard focus while open, keeps Tab inside, closes on Escape, and gives focus back when it closes. */
export function SheetFrame({ children, label }: { children: ReactNode; label: string }) {
  const { actions } = useRemy();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => opener?.focus?.();
  }, []);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      actions.closeSheet();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const all = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!all.length) return;
    const first = all[0];
    const last = all[all.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && actions.closeSheet()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref} onKeyDown={onKeyDown}>
        <div className="grab" />
        <button type="button" className="iconbtn sheet-close" aria-label="Close" onClick={actions.closeSheet}>
          <Icon name="x" size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}

const ORDERS: [OptionOrder, string][] = [['match', 'Best match'], ['light', 'Lightest'], ['protein', 'Most protein'], ['quick', 'Quickest']];

function ReplaceSheet({ arg }: { arg: SheetArg }) {
  const { planState, ctx, actions, viewPlan } = useRemy();
  const [why, setWhy] = useState<string | null>(null);
  const [food, setFood] = useState<string | null>(null);
  const [order, setOrder] = useState<OptionOrder>('match');
  const plan = viewPlan!;
  const { d, slot, reject } = arg;
  const day = plan[d];
  const current = day.meals[slot]?.r ? R[day.meals[slot]!.r!] : null;
  const opts = replacementOptions(plan, d, slot, ctx);
  const nums = estimatesOn(planState.nutrition, ctx.A);
  const reason = reject ? { why, food } : undefined;
  const title = `${reject ? 'Not this one' : current ? 'Replace' : 'Choose a meal'} · ${DAY_FULL[day.d]} ${SLOT_SHORT[slot].toLowerCase()}`;
  const meal = SLOT_SHORT[slot].toLowerCase();
  const pick = () => {
    const id = autoReplacement(plan, d, slot, ctx);
    if (id) actions.replace(d, slot, id, reason);
    else actions.toast('No other safe match for this slot');
  };

  return (
    <SheetFrame label={title}>
      <Mast
        kicker={current ? `Instead of ${current.short}` : DAY_FULL[day.d]}
        icon="swap"
        title={reject ? 'Not this one' : current ? `Another ${meal}` : `Choose a ${meal}`}
        sub={`${DAY_FULL[day.d]} · all fit your rules`}
      />
      {reject && current && (
        <section className="msec">
          <SecHead title="What’s wrong with it?" aside="optional" />
          <div className="chips">
            {REJECT_REASONS.map((x) => (
              <button type="button" key={x} className="chip" aria-pressed={why === x} onClick={() => { setWhy(why === x ? null : x); setFood(null); }}>
                {x}
              </button>
            ))}
          </div>
          {why === 'An ingredient I don’t like' && (
            <>
              <p className="hint gap-top">Which one? I’ll mark it Dislike, and you can change that in your profile.</p>
              <div className="chips gap-top">
                {Object.keys(current.foods).map((f) => (
                  <button type="button" key={f} className="chip" aria-pressed={food === f} onClick={() => setFood(food === f ? null : f)}>
                    {FOODS[f].e} {FOODS[f].n}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      )}
      <section className="msec">
        <SecHead
          title="Suggestions"
          aside={
            <button type="button" className="linkbtn tight" onClick={pick}>
              <Icon name="swap" size={15} /> Pick for me
            </button>
          }
        />
        {opts.allowed.length > 1 && (
          <div className="chips filter-chips" role="group" aria-label="Order">
            {ORDERS.filter(([o]) => nums || o !== 'light').map(([o, label]) => (
              <button type="button" key={o} className="chip" aria-pressed={order === o} onClick={() => setOrder(o)}>
                {label}
              </button>
            ))}
          </div>
        )}
        <div>
          {sortOptions(opts.allowed, order).map((r) => {
            const st = storage(r, d + 1);
            const fit = matches(r, ctx.A).slice(0, 3);
            return (
              <div className="dish" key={r.id}>
                <span className="dish-emoji" aria-hidden="true">{r.e}</span>
                <div className="dish-body">
                  <DishLine name={r.short} kcal={nums ? r.kcal : null} value={heatShort(r.reheat)} />
                  <p className="dish-desc">{describe(r)}</p>
                  {nums && <MacroLine n={r} />}
                  <span className="dish-fit">
                    {fit.length > 0 && <Icon name="spark" size={13} />}
                    {fit.length ? `Uses ${fit.join(', ')}` : 'Fits your rules'}
                  </span>
                  <div className="chips tight">
                    {!r.store && <span className="pill p-muted">Makes {r.serves}</span>}
                    {!r.store && <span className="pill p-muted">{handsOnMinutes(r)} min hands-on</span>}
                    {st.k !== 'fridge' && <StoragePill st={st} />}
                  </div>
                  {st.k === 'unsafe' ? (
                    <span className="hint">Not safe for day {d + 1}</span>
                  ) : (
                    <div className="dish-btns">
                      <button type="button" className="btn sm" onClick={() => actions.replace(d, slot, r.id, reason)}>
                        Choose
                      </button>
                      <button type="button" className="btn sm ghost" onClick={() => actions.openRecipe(r.id)}>
                        Recipe
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {opts.blocked.map((b) => (
            <div className="dish struck" key={b.r.id}>
              <span className="dish-emoji c-danger" aria-hidden="true">
                <Icon name="lock" size={22} />
              </span>
              <div className="dish-body">
                <DishLine name={b.r.short} />
                <p className="dish-desc c-danger">
                  Blocked: {b.reason}.{b.allergy ? ' Allergy rule.' : ''}
                </p>
              </div>
            </div>
          ))}
          {opts.allowed.length === 0 && opts.blocked.length === 0 && <div className="empty">Nothing else in the library fits this slot yet.</div>}
        </div>
        {opts.hidden.length > 0 && (
          <p className="hint gap-top">
            {opts.hidden.length} more hidden by your preferences: {opts.hidden.map((h) => `${h.r.short} (${h.reason.toLowerCase()})`).join('; ')}.
          </p>
        )}
      </section>
      <section className="msec">
        <AiIdea d={d} slot={slot} reason={reason} />
      </section>
    </SheetFrame>
  );
}

function MoveSheet({ arg }: { arg: SheetArg }) {
  const { actions, viewPlan } = useRemy();
  const plan = viewPlan!;
  const { d, slot } = arg;
  const r = R[plan[d].meals[slot]!.r!];
  return (
    <SheetFrame label={`Move ${r.short}`}>
      <Mast kicker={`Move ${r.short}`} icon="move" title="Swap days" sub={`Swap it with the ${SLOT_SHORT[slot].toLowerCase()} on another day.`} />
      <div>
        {plan.map((day, i) => {
          if (i === d) return null;
          const other = day.meals[slot];
          const why = moveBlocker(plan, d, i, slot);
          return (
            <div className={`dish${why ? ' struck' : ''}`} key={day.d}>
              <div className="dish-body">
                <div className="dish-line">
                  <span className="dish-name">{DAY_FULL[day.d]}</span>
                  <span className="leader" aria-hidden="true" />
                  <span className="hint">day {i + 1}</span>
                </div>
                <p className="dish-desc">{other?.out ? 'Eating out' : other?.skip ? 'No sweet planned' : other?.r ? `Now: ${R[other.r].short}` : 'Nothing planned'}</p>
                {why ? (
                  <p className="dish-desc c-danger">{why}</p>
                ) : (
                  <>
                    <div className="dish-meta">
                      <StoragePill st={storage(r, i + 1)} />
                    </div>
                    <button type="button" className="btn sm soft" onClick={() => actions.move(d, i, slot)}>
                      Swap with {day.d}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </SheetFrame>
  );
}

function SideSheet({ arg }: { arg: SheetArg }) {
  const { planState, ctx, actions, viewPlan } = useRemy();
  const plan = viewPlan!;
  const { d, slot } = arg;
  const m = plan[d].meals[slot]!;
  const r = R[m.r!];
  const nums = estimatesOn(planState.nutrition, ctx.A);
  const hidden = SIDE_IDS.map((id) => R[id]).filter((s) => s.for?.includes(slot) && !check(s, ctx.A).ok);
  const groups = (['protein', 'produce'] as const).map((kind) => ({ kind, list: sideOptions(ctx, d, slot, kind).filter((s) => s.id !== m.side) }));
  const title = `Add a side · ${DAY_FULL[plan[d].d]} ${SLOT_SHORT[slot].toLowerCase()}`;
  return (
    <SheetFrame label={title}>
      <Mast
        kicker={`With ${r.short}`}
        icon="plus"
        title="Add a side"
        sub={`${DAY_FULL[plan[d].d]} ${SLOT_SHORT[slot].toLowerCase()}. Only foods you accept, checked against your safety rules and storage days.`}
      />
      {m.side && (
        <div className="sideline gap-top-lg">
          <span aria-hidden="true">{R[m.side].e}</span>
          <span className="grow">Current side: {R[m.side].short}</span>
          <button type="button" className="btn sm ghost" onClick={() => actions.setSide(d, slot, null)}>
            Remove
          </button>
        </div>
      )}
      {groups.map(({ kind, list }) =>
        list.length ? (
          <section className="msec" key={kind}>
            <SecHead title={kind === 'protein' ? 'More protein' : 'Fruit and vegetables'} />
            <div>
              {list.map((s) => {
                const fit = matches(s, ctx.A);
                const gain = kind === 'protein' ? (nums ? `+${s.pro} g protein` : 'Adds protein') : '+1 serving of fruit or veg';
                return (
                  <div className="dish" key={s.id}>
                    <span className="dish-emoji" aria-hidden="true">{s.e}</span>
                    <div className="dish-body">
                      <DishLine name={s.short} kcal={nums ? s.kcal : null} />
                      <p className="dish-desc">{s.why[0] ?? (fit.length ? `You rated ${fit[0]}` : 'Fits your rules')}</p>
                      <span className="dish-fit">{gain}</span>
                      <div className="dish-meta">
                        <StoragePill st={storage(s, d + 1)} />
                      </div>
                      <button type="button" className="btn sm soft" onClick={() => actions.setSide(d, slot, s.id)}>
                        Add {s.short.toLowerCase()}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null,
      )}
      {groups.every((g) => !g.list.length) && <div className="empty">No side fits this meal and day with your current foods and rules.</div>}
      {hidden.length > 0 && (
        <p className="hint gap-top">
          {hidden.length} more hidden: {hidden.map((s) => { const c = check(s, ctx.A); return `${s.short} (${c.ok ? '' : c.reason.toLowerCase()})`; }).join('; ')}.
        </p>
      )}
    </SheetFrame>
  );
}

/** "⋯" on a meal: everything besides approving it. Each choice opens its own sheet. */
function MealSheet({ arg }: { arg: SheetArg }) {
  const { actions, viewPlan } = useRemy();
  const plan = viewPlan!;
  const { d, slot } = arg;
  const m = plan[d].meals[slot]!;
  const r = R[m.r!];
  const meal = SLOT_SHORT[slot].toLowerCase();
  const Opt = ({ icon, label, sub, danger, onClick }: { icon: IconName; label: string; sub?: string; danger?: boolean; onClick: () => void }) => (
    <button type="button" className={`opt${danger ? ' opt-danger' : ''}`} onClick={onClick}>
      <Icon name={icon} size={20} />
      <span className="grow">
        {label}
        {sub && <small>{sub}</small>}
      </span>
    </button>
  );
  return (
    <SheetFrame label={`${r.short}: more`}>
      <Mast kicker={`${DAY_FULL[plan[d].d]} ${meal}`} icon="toque" title={r.short} />
      <div className="opts gap-top-lg">
        <Opt icon="bookmark" label="Open the recipe" onClick={() => actions.openRecipe(r.id)} />
        <Opt icon="plus" label={m.side ? 'Change the side' : 'Add a side'} sub={m.side ? `Now: ${R[m.side].short}` : 'More protein, fruit or vegetables'} onClick={() => actions.openSheet('side', arg)} />
        <Opt icon="swap" label="Replace" sub={`Another ${meal} that fits your rules`} onClick={() => actions.openSheet('replace', arg)} />
        <Opt icon="move" label="Move to another day" sub="Swap it with the same meal on another day" onClick={() => actions.openSheet('move', arg)} />
        <Opt icon="x" label="Not this" sub="Tell Remy why, so it learns" danger onClick={() => actions.openSheet('replace', { ...arg, reject: true })} />
      </div>
    </SheetFrame>
  );
}

const VARIETIES: Variety[] = ['favorites', 'balanced', 'variety'];

/** Pick a weekday, or none. */
function DayChips({ label, value, onPick }: { label: string; value: Day | null; onPick: (d: Day | null) => void }) {
  return (
    <div className="day-chips">
      <p className="strong">{label}</p>
      <div className="chips tight" role="group" aria-label={label}>
        {DAYS.map((d) => (
          <button type="button" key={d} className="chip" aria-pressed={value === d} onClick={() => onPick(d)}>
            {d}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={value === null} onClick={() => onPick(null)}>
          None
        </button>
      </div>
    </div>
  );
}

/** The week's settings, moved off the day view: how much variety, a new menu, and goals. */
function MenuSettingsSheet() {
  const { planState, ctx, actions, viewPlan } = useRemy();
  const plan = viewPlan!;
  const sc = schedule(plan, ctx.A);
  const [, windowMax] = windowMinutes(ctx.A);
  const approvals = approvalCounts(plan);
  const goals = goalsOf(planState.nutrition);
  const avg = weekAverage(plan, ctx.hungry);
  const size = plan.flatMap((x) => Object.values(x.meals)).find((m) => m?.x)?.x ?? 1;
  const window = str(ctx.A.preptime) || 'your window';
  return (
    <SheetFrame label="Menu settings">
      <Mast kicker="This week" icon="sliders" title="Menu settings" sub={`${menuCountText(plan)} · ${duration(sc.total)} of prep · ${approvals.ok} of ${approvals.total} meals approved`} />
      <section className="msec">
        <SecHead title="Variety" />
        <div className="seg" role="group" aria-label="Variety">
          {VARIETIES.map((v) => (
            <button key={v} type="button" aria-pressed={planState.variety === v} onClick={() => actions.setVariety(v)}>
              {WEEKS[v].label}
            </button>
          ))}
        </div>
        <p className="hint gap-top">
          More variety means more dishes and a longer prep day.{' '}
          {sc.total > windowMax ? <span className="pill p-warn">Over {window}</span> : <span className="pill p-ok">Fits {window}</span>}
        </p>
      </section>
      <section className="msec">
        <SecHead title="Shopping days" />
        <p className="lead-note">Remy puts them on the month calendar, dates your grocery lists, and reminds you when to move the meat from the freezer to the fridge.</p>
        <DayChips
          label="Monthly shop: meat to freeze, and staples"
          value={planState.shopDays.month}
          onPick={(d) => {
            actions.setShopDays({ month: d });
            if (d && planState.shopping !== 'monthly') actions.setShopping('monthly');
          }}
        />
        <DayChips label="Weekly shop: fruit, vegetables, dairy and bread" value={planState.shopDays.fresh} onPick={(d) => actions.setShopDays({ fresh: d })} />
      </section>
      <section className="msec">
        <SecHead title="New menu" />
        <p className="lead-note">Swaps every meal you haven’t approved for another one that fits your rules. Tap again for another option.</p>
        <button type="button" className="btn soft wide" onClick={actions.regenerate}>
          <Icon name="swap" size={16} /> New menu
        </button>
      </section>
      {hasGoals(goals) && (
        <section className="msec">
          <SecHead title="Your goals" />
          <p className="lead-note">
            Fitted to {[goals.kcal && `${goals.kcal.toLocaleString('en-US')} kcal`, goals.pro && `${goals.pro} g protein`].filter(Boolean).join(' and ')}: about{' '}
            <b>{Math.round(avg.kcal).toLocaleString('en-US')} kcal</b> and <b>{Math.round(avg.pro)} g protein</b> a day
            {size !== 1 ? `, main-meal portions ${Math.round(size * 100)}%` : ''}.
          </p>
          <button type="button" className="btn ghost wide" onClick={actions.fitGoals}>
            Fit again
          </button>
        </section>
      )}
    </SheetFrame>
  );
}

export function PlanSheets() {
  const { ui, viewPlan } = useRemy();
  if (!viewPlan) return null;
  if (ui.sheet === 'menuSettings') return <MenuSettingsSheet />;
  if (!ui.sheetArg) return null;
  const m = viewPlan[ui.sheetArg.d]?.meals[ui.sheetArg.slot];
  if (ui.sheet === 'meal' && m?.r) return <MealSheet arg={ui.sheetArg} />;
  if (ui.sheet === 'replace') return <ReplaceSheet arg={ui.sheetArg} />;
  if (ui.sheet === 'move' && m?.r) return <MoveSheet arg={ui.sheetArg} />;
  if (ui.sheet === 'side' && m?.r) return <SideSheet arg={ui.sheetArg} />;
  return null;
}
