import { BottomNav, Header, StoragePill } from '../components/Chrome';
import { describe, DishLine, Leader, MacroLine } from '../components/Dish';
import { Icon } from '../components/Icon';
import { str } from '../interview/helpers';
import { fraction } from '../planning/grocery';
import { R } from '../planning/data/recipes';
import { balanceOn, dayNutrition, estimatesOn, mealNutrition, proteinTarget } from '../planning/nutrition';
import { dayApproved, portions } from '../planning/planner';
import { storage } from '../planning/rules';
import { DAY_FULL, SLOT_SHORT, SLOTS, type Day, type Slot } from '../planning/types';
import { useRemy } from '../store';

/**
 * The week, one day at a time, as a restaurant menu. Each meal is one line: a tick to approve it, the dish, and "⋯" for
 * everything else (side, replace, move, not this). Variety and New menu live in the menu settings sheet.
 */
export function Planner() {
  const { planState, ctx, actions } = useRemy();
  const plan = planState.plan;
  if (!plan) return null;
  const A = ctx.A;
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

  return (
    <>
      <Header
        title="Your week"
        right={
          <button type="button" className="iconbtn" aria-label="Menu settings: variety and new menu" onClick={() => actions.openSheet('menuSettings')}>
            <Icon name="sliders" size={22} />
          </button>
        }
      />
      <main className="body wide">
        <div className="daytabs" role="group" aria-label="Day">
          {plan.map((x, i) => {
            const done = dayApproved(x);
            return (
              <button key={x.d} type="button" aria-pressed={i === d} aria-label={`${DAY_FULL[x.d]}${done ? ', approved' : ''}`} onClick={() => actions.selectDay(i)}>
                {x.d}
                <small className={done ? 'c-basil' : undefined}>
                  {balance && !dayNutrition(x, ctx.hungry).ok && <span className="dot-warn" aria-label="needs balance">● </span>}
                  {done ? '✓ done' : `day ${i + 1}`}
                </small>
              </button>
            );
          })}
        </div>

        <div className="day-status">
          <h2>{DAY_FULL[day.d]}</h2>
          {balance && (
            <div className="chips tight">
              {dn.proteinOk ? (
                <span className="pill p-ok"><Icon name="check" size={12} /> Protein</span>
              ) : (
                <span className="pill p-warn">Protein light: {dn.low.map((s) => SLOT_SHORT[s].toLowerCase()).join(', ')}</span>
              )}
              <span className={`pill ${dn.produceOk ? 'p-ok' : 'p-warn'}`}>
                {dn.produceOk && <Icon name="check" size={12} />} Fruit &amp; veg {fraction(dn.prod)}{dn.produceOk ? '' : ' of 3'}
              </span>
              {dn.sweet && <span className="pill p-sweet">Sweet</span>}
            </div>
          )}
        </div>
        <p className="day-note-line">
          <Icon name="fridge" size={14} /> Day {d + 1} after prep{allFridge ? `: everything is from the fridge, made ${prepDay}` : ` on ${prepDay}. From the fridge unless marked.`}
        </p>
        {balance && !dn.ok && (
          <button type="button" className="btn sm soft gap-top" onClick={() => actions.balance([d])}>
            <Icon name="plus" size={15} /> Balance this day
          </button>
        )}
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
          <p className="bill bill-note">
            {dn.out ? 'The meal out isn’t counted. ' : ''}Calorie estimates are off.{' '}
            <button type="button" className="linkbtn tight inline" onClick={() => actions.go('nutrition')}>
              Nutrition balance
            </button>
          </p>
        )}

        <div className="row gap-top-lg">
          <button type="button" className="btn soft grow" onClick={() => actions.approveDay(d)}>
            <Icon name="check" size={17} /> Approve {DAY_FULL[day.d]}
          </button>
          <button type="button" className="btn ghost grow" onClick={actions.approveAll}>
            Approve week
          </button>
        </div>
      </main>
      <BottomNav />
    </>
  );

  function course(slot: Slot) {
    const m = day.meals[slot];
    if (!m) return null;
    const label = <span className="slot-label">{SLOT_SHORT[slot]}</span>;
    if (m.skip || m.out || !m.r)
      return (
        <section className="course-line" key={slot} aria-label={SLOT_SHORT[slot]}>
          <span className="tick-space" aria-hidden="true" />
          <div className="course-main">
            {label}
            <DishLine name={m.out ? 'Eating out' : m.skip ? 'No sweet today' : 'Nothing fits yet'} />
            <p className="dish-meta">
              {m.out ? `You said you usually eat out on ${DAY_FULL[day.d]}s.` : m.skip ? 'Based on how often you said you want one.' : 'No recipe in the library fits your rules for this slot yet.'}
            </p>
            <button
              type="button"
              className="linkbtn tight"
              onClick={() => (m.skip || m.out ? actions.planAnyway(d, slot) : actions.openSheet('replace', { d, slot }))}
            >
              <Icon name={m.skip || m.out ? 'plus' : 'swap'} size={15} /> {m.out ? 'Plan a meal anyway' : m.skip ? 'Add one anyway' : 'Choose a meal'}
            </button>
          </div>
        </section>
      );

    const r = R[m.r];
    const st = storage(r, d + 1);
    const nth = plan!.slice(0, d + 1).filter((x) => x.meals[slot]?.r === r.id).length;
    const target = proteinTarget(slot, ctx.hungry);
    const pro = mealNutrition(m)?.pro ?? 0;
    // The dish on its own line; a side gets its own line and calories.
    const main = mealNutrition({ ...m, side: undefined });
    const side = m.side ? R[m.side] : null;
    return (
      <section className={`course-line${m.ok ? ' ok' : ''}`} key={slot} aria-label={SLOT_SHORT[slot]}>
        <button
          type="button"
          className="tick"
          aria-pressed={!!m.ok}
          aria-label={`${m.ok ? 'Approved' : 'Approve'} ${r.short}`}
          onClick={() => actions.toggleApproved(d, slot)}
        >
          <span>
            <Icon name="check" size={16} />
          </span>
        </button>
        <div className="course-main">
          <span className="slot-label">
            {SLOT_SHORT[slot]}
            {m.ok && <span className="c-basil"> · approved</span>}
          </span>
          <DishLine name={r.short} kcal={nums && main ? main.kcal : null} onOpen={() => actions.openRecipe(r.id)} />
          <p className="dish-desc clamp">{describe(r)}</p>
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
          <div className="dish-meta">
            {st.k !== 'fridge' && <StoragePill st={st} />}
            <span>
              {pc[r.id] > 1 && `${nth} of ${pc[r.id]} · `}
              {m.x && m.x !== 1 && `${Math.round(m.x * 100)}% portion · `}
              {st.k === 'freezer' && r.thaw ? r.thaw : r.reheat.split('.')[0]}
            </span>
          </div>
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
        </div>
        <button type="button" className="iconbtn more" aria-label={`More for ${r.short}: side, replace, move, not this`} onClick={() => actions.openSheet('meal', { d, slot })}>
          <Icon name="more" size={22} />
        </button>
      </section>
    );
  }
}
