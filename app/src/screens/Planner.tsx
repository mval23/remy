import { BottomNav, Header, StoragePill } from '../components/Chrome';
import { describe, DishLine, Leader, MacroLine, Mast } from '../components/Dish';
import { Icon } from '../components/Icon';
import { MonthView } from '../components/MonthView';
import { weekStatus } from '../planning/ahead';
import { dayDate, rangeText, shortDate, weekDates } from '../planning/calendar';
import { str } from '../interview/helpers';
import { fraction } from '../planning/grocery';
import { R } from '../planning/data/recipes';
import { heatNote, heatShort } from '../planning/method';
import { balanceOn, dayNutrition, estimatesOn, mealNutrition, proteinTarget } from '../planning/nutrition';
import { approvalCounts, dayApproved, portions } from '../planning/planner';
import { storage } from '../planning/rules';
import { DAY_FULL, SLOT_SHORT, SLOTS, type Day, type Slot } from '../planning/types';
import { useRemy } from '../store';

/**
 * The week, one day at a time, set like the recipe menu page: each meal is a course with its heading and how to eat it,
 * the dish as name ........ kcal (or how long to heat it when estimates are off), and two labeled buttons: Approve and
 * Change (side, replace, move, not this). The day's total closes it like a bill.
 */
export function Planner() {
  const { planState, viewPlan, ui, ctx, actions } = useRemy();
  const plan = viewPlan;
  if (!plan || !planState.plan) return null;
  const A = ctx.A;
  const w = ui.week;
  const month = ui.planView === 'month';
  const wd = weekDates(A, planState.weekStartedAt, w, planState.shopDays, planState.shopping === 'monthly');
  const dateOf = (i: number) => {
    const x = new Date(wd.start);
    x.setDate(x.getDate() + i);
    return x;
  };
  const status = weekStatus(plan);
  const weeks = planState.ahead.length + 1;
  const d = Math.min(planState.day, 6);
  const day = plan[d];
  const pc = portions(plan);
  const balance = balanceOn(A);
  const nums = estimatesOn(planState.nutrition, A);
  const dn = dayNutrition(day, ctx.hungry);
  const prepDay = DAY_FULL[(str(A.prepday) || 'Sun') as Day];
  const allFridge = SLOTS.every((s) => {
    const m = day.meals[s];
    return !m?.r || storage(R[m.r], d + 1).k === 'fridge';
  });
  const dayCount = approvalCounts([day]);

  return (
    <>
      <Header
        title={month ? 'Your month' : 'Your week'}
        right={
          <button type="button" className="iconbtn" aria-label="Menu settings: variety and new menu" onClick={() => actions.openSheet('menuSettings')}>
            <Icon name="sliders" size={22} />
          </button>
        }
      />
      <main className="body wide">
        <div className="plan-switch">
          <div className="seg" role="group" aria-label="Show">
            <button type="button" aria-pressed={!month} onClick={() => actions.setPlanView('week')}>
              Week
            </button>
            <button type="button" aria-pressed={month} onClick={() => actions.setPlanView('month')}>
              Month
            </button>
          </div>
          {!month && weeks > 1 && (
            <div className="week-step">
              <button type="button" className="iconbtn" aria-label="Previous week" disabled={w === 0} onClick={() => actions.selectWeek(w - 1)}>
                <Icon name="left" size={20} />
              </button>
              <span className="week-label">
                <b>{w === 0 ? 'This week' : rangeText(wd.start, wd.end)}</b>
                <small>{w === 0 ? rangeText(wd.start, wd.end) : status === 'approved' ? '✓ Approved' : status === 'some' ? 'Partly approved' : 'Draft'}</small>
              </span>
              <button type="button" className="iconbtn" aria-label="Next week" disabled={w >= weeks - 1} onClick={() => actions.selectWeek(w + 1)}>
                <Icon name="right" size={20} />
              </button>
            </div>
          )}
        </div>
        {month ? (
          <MonthView />
        ) : (
          <>
        <div className="daytabs" role="group" aria-label="Day">
          {plan.map((x, i) => {
            const done = dayApproved(x);
            return (
              <button key={x.d} type="button" aria-pressed={i === d} aria-label={`${dayDate(dateOf(i))}${done ? ', approved' : ''}`} onClick={() => actions.selectDay(i)}>
                {x.d}
                <small className={done ? 'c-basil' : undefined}>
                  {balance && !dayNutrition(x, ctx.hungry).ok && <span className="dot-warn" aria-label="needs balance">● </span>}
                  {done ? '✓ ' : ''}
                  {shortDate(dateOf(i))}
                </small>
              </button>
            );
          })}
        </div>

        <Mast
          kicker={`${shortDate(dateOf(d))} · day ${d + 1} after prep`}
          title={DAY_FULL[day.d]}
          compact
          sub={allFridge ? `Everything from the fridge, made ${prepDay} ${shortDate(wd.prep)}.` : `Made ${prepDay} ${shortDate(wd.prep)}. From the fridge unless marked.`}
        >
          {balance && (
            <p className="mast-checks">
              {dn.proteinOk ? (
                <span><b>✓</b> Protein at every meal</span>
              ) : (
                <span className="c-citrus">Protein light: {dn.low.map((s) => SLOT_SHORT[s].toLowerCase()).join(', ')}</span>
              )}
              {dn.produceOk ? (
                <span><b>✓</b> Fruit &amp; veg {fraction(dn.prod)}</span>
              ) : (
                <span className="c-citrus">Fruit &amp; veg {fraction(dn.prod)} of 3</span>
              )}
              {dn.sweet && <span><b>✓</b> Sweet</span>}
            </p>
          )}
          {balance && !dn.ok && (
            <div className="mast-acts">
              <button type="button" className="btn sm soft" onClick={() => actions.balance([d])}>
                <Icon name="plus" size={15} /> Balance this day
              </button>
            </div>
          )}
        </Mast>
        {balance && dn.light && (
          <div className="badline gap-top-lg">
            <Icon name="info" size={16} />
            <span>This day looks light{nums ? ' (under about 1,200 kcal)' : ''}. Remy doesn’t plan days this low on its own. Add a snack or side.</span>
          </div>
        )}

        <div className="courses">{SLOTS.map(course)}</div>

        {nums ? (
          <div className="bill">
            <DishLine name={`${DAY_FULL[day.d]}’s total`} kcal={Math.round(dn.kcal / 10) * 10} />
            <MacroLine n={dn} />
            <p className="bill-note">
              Rough estimates added up from the ingredients{dn.out ? '; the meal out isn’t counted' : ''}.{' '}
              <button type="button" className="linkbtn tight inline" onClick={() => actions.go('nutrition')}>
                Details
              </button>
            </p>
          </div>
        ) : (
          <div className="bill">
            <DishLine name={DAY_FULL[day.d]} value={`${dayCount.ok} of ${dayCount.total} approved`} />
            <p className="bill-note">
              {dn.out ? 'The meal out isn’t counted. ' : ''}The dotted lines show how to eat each dish; calorie estimates are off.{' '}
              <button type="button" className="linkbtn tight inline" onClick={() => actions.go('nutrition')}>
                Nutrition balance
              </button>
            </p>
          </div>
        )}

        <div className="row gap-top-lg">
          <button type="button" className="btn soft grow" onClick={() => actions.approveDay(d)}>
            <Icon name="check" size={17} /> Approve {DAY_FULL[day.d]}
          </button>
          <button type="button" className="btn ghost grow" onClick={actions.approveAll}>
            Approve week
          </button>
        </div>
          </>
        )}
      </main>
      <BottomNav />
    </>
  );

  function course(slot: Slot) {
    const m = day.meals[slot];
    if (!m) return null;
    const head = (note?: string) => (
      <div className="course-head">
        <h3>{SLOT_SHORT[slot]}</h3>
        {note && <span className="course-note">{note}</span>}
      </div>
    );
    if (m.skip || m.out || !m.r)
      return (
        <section className="course" key={slot}>
          {head()}
          <div className="dish">
            <span className="dish-emoji" aria-hidden="true">{m.out ? '🍽️' : m.skip ? '🌙' : '❔'}</span>
            <div className="dish-body">
              <DishLine name={m.out ? 'Eating out' : m.skip ? 'No sweet today' : 'Nothing fits yet'} />
              <p className="dish-desc">
                {m.out ? `You said you usually eat out on ${DAY_FULL[day.d]}s.` : m.skip ? 'Based on how often you said you want one.' : 'No recipe in the library fits your rules for this slot yet.'}
              </p>
              <div className="dish-btns">
                <button type="button" className="btn sm soft" onClick={() => (m.skip || m.out ? actions.planAnyway(d, slot) : actions.openSheet('replace', { d, slot }))}>
                  <Icon name={m.skip || m.out ? 'plus' : 'swap'} size={15} /> {m.out ? 'Plan a meal anyway' : m.skip ? 'Add one anyway' : 'Choose a meal'}
                </button>
              </div>
            </div>
          </div>
        </section>
      );

    const r = R[m.r];
    const st = storage(r, d + 1);
    // Which portion of this dish this is, counting every meal it appears at (a dinner can also be a lunch).
    const nth = plan!.slice(0, d + 1).reduce((n, x, i) => n + SLOTS.filter((s2, si) => (i < d || si <= SLOTS.indexOf(slot)) && x.meals[s2]?.r === r.id).length, 0);
    const target = proteinTarget(slot, ctx.hungry);
    const pro = mealNutrition(m)?.pro ?? 0;
    // The dish on its own line; a side gets its own line and calories.
    const main = mealNutrition({ ...m, side: undefined });
    const side = m.side ? R[m.side] : null;
    // How to eat it goes next to the course heading, said once.
    const how = heatNote(st.k === 'freezer' && r.thaw ? r.thaw : r.reheat);
    return (
      <section className="course" key={slot}>
        {head(how)}
        <div className="dish">
          <span className="dish-emoji" aria-hidden="true">{r.e}</span>
          <div className="dish-body">
            <DishLine name={r.short} kcal={nums && main ? main.kcal : null} value={heatShort(r.reheat)} onOpen={() => actions.openRecipe(r.id)} />
            <p className="dish-desc">{describe(r)}</p>
            {nums && main && <MacroLine n={main} />}
            {side && (
              <div className="side-line">
                <span aria-hidden="true">{side.e}</span>
                <span className="n">+ {side.short}</span>
                {nums && (
                  <>
                    <Leader />
                    <span className="dish-kcal">{side.kcal} kcal</span>
                  </>
                )}
              </div>
            )}
            {(pc[r.id] > 1 || (m.x && m.x !== 1) || st.k !== 'fridge' || m.borrowed) && (
              <div className="chips tight">
                {m.borrowed && <span className="pill p-muted">From the {r.slot.toLowerCase()} menu</span>}
                {pc[r.id] > 1 && <span className="pill p-muted">{nth} of {pc[r.id]} this week</span>}
                {m.x && m.x !== 1 && <span className="pill p-muted">{Math.round(m.x * 100)}% portion</span>}
                {st.k !== 'fridge' && <StoragePill st={st} />}
              </div>
            )}
            {st.k === 'unsafe' && (
              <div className="badline">
                <Icon name="info" size={16} />
                <span>This would be day {d + 1} after prep, past its {r.fridge}-day fridge limit, and it doesn’t freeze well. Move it earlier or replace it.</span>
              </div>
            )}
            {balance && target > 0 && pro < target && (
              <div className="warnline tight">
                <Icon name="info" size={16} />
                <span className="grow">Light on protein{nums ? ` (${pro} g; aim for ${target}+)` : ''}.</span>
                <button type="button" className="linkbtn tight" onClick={() => actions.openSheet('side', { d, slot })}>
                  Add a side
                </button>
              </div>
            )}
            <div className="dish-btns">
              <button type="button" className={`btn sm${m.ok ? '' : ' soft'}`} aria-pressed={!!m.ok} onClick={() => actions.toggleApproved(d, slot)}>
                <Icon name="check" size={15} /> {m.ok ? 'Approved' : 'Approve'}
              </button>
              <button type="button" className="btn sm ghost" aria-label={`Change ${r.short}: side, replace, move or not this`} onClick={() => actions.openSheet('meal', { d, slot })}>
                <Icon name="swap" size={15} /> Change
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }
}
