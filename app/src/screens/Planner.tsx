import type { ReactNode } from 'react';
import { BottomNav, Header, StoragePill } from '../components/Chrome';
import { describe, DishLine, Leader, MacroLine, Mast } from '../components/Dish';
import { Icon } from '../components/Icon';
import { str } from '../interview/helpers';
import { fraction } from '../planning/grocery';
import { R } from '../planning/data/recipes';
import { WEEKS } from '../planning/data/weeks';
import { balanceOn, dayNutrition, estimatesOn, mealNutrition, proteinTarget } from '../planning/nutrition';
import { approvalCounts, portions } from '../planning/planner';
import { storage, windowMinutes } from '../planning/rules';
import { duration, schedule } from '../planning/schedule';
import { DAY_FULL, SLOT_SHORT, SLOTS, type Day, type Slot, type Variety } from '../planning/types';
import { goalsOf, hasGoals, weekAverage } from '../planning/goals';
import { useRemy } from '../store';

const VARIETIES: Variety[] = ['favorites', 'balanced', 'variety'];

/** The week, one day at a time, as a restaurant menu: each meal is a course, and the day's total closes it like a bill. */
export function Planner() {
  const { planState, ctx, actions } = useRemy();
  const plan = planState.plan;
  if (!plan) return null;
  const A = ctx.A;
  const d = Math.min(planState.day, 6);
  const day = plan[d];
  const pc = portions(plan);
  const sc = schedule(plan, A);
  const [, windowMax] = windowMinutes(A);
  const approvals = approvalCounts(plan);
  const recipeCount = Object.keys(pc).filter((id) => !R[id].store && !R[id].side).length;
  const balance = balanceOn(A);
  const nums = estimatesOn(planState.nutrition, A);
  const dn = dayNutrition(day, ctx.hungry);
  const goals = goalsOf(planState.nutrition);
  const avg = weekAverage(plan, ctx.hungry);
  const size = plan.flatMap((x) => Object.values(x.meals)).find((m) => m?.x)?.x ?? 1;

  return (
    <>
      <Header title="Your week" sub={`Prep on ${DAY_FULL[(str(A.prepday) || 'Sun') as Day]} · tap a dish for the recipe`} />
      <main className="body wide">
        <div className="daytabs" role="group" aria-label="Day">
          {plan.map((x, i) => (
            <button key={x.d} type="button" aria-pressed={i === d} onClick={() => actions.selectDay(i)}>
              {x.d}
              <small>
                {balance && !dayNutrition(x, ctx.hungry).ok && <span className="dot-warn" aria-label="needs balance">● </span>}
                day {i + 1}
              </small>
            </button>
          ))}
        </div>

        <Mast kicker="Remy’s kitchen" title={DAY_FULL[day.d]} sub={`Day ${d + 1} of your week`}>
          {balance && (
            <div className="chips tight">
              {dn.proteinOk ? (
                <span className="pill p-ok"><Icon name="check" size={12} /> Protein at every meal</span>
              ) : (
                <span className="pill p-warn">Protein light: {dn.low.map((s) => SLOT_SHORT[s].toLowerCase()).join(', ')}</span>
              )}
              <span className={`pill ${dn.produceOk ? 'p-ok' : 'p-warn'}`}>
                {dn.produceOk && <Icon name="check" size={12} />} Fruit &amp; veg: {fraction(dn.prod)}{dn.produceOk ? '' : ' of 3'}
              </span>
              {dn.sweet && <span className="pill p-sweet">Sweet planned</span>}
            </div>
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

        <div className="planner-top">
          <div className="seg" role="group" aria-label="Variety">
            {VARIETIES.map((v) => (
              <button key={v} type="button" aria-pressed={planState.variety === v} onClick={() => actions.setVariety(v)}>
                {WEEKS[v].label}
              </button>
            ))}
          </div>
          <div className="row">
            <p className="hint summary-line grow">
              {recipeCount} recipes · {duration(sc.total)} prep{' '}
              {sc.total > windowMax ? <span className="pill p-warn">over your window</span> : <span className="pill p-ok">fits</span>} · {approvals.ok}/{approvals.total} approved
            </p>
            <button type="button" className="btn sm soft" onClick={actions.regenerate}>
              <Icon name="swap" size={16} /> New menu
            </button>
          </div>
        </div>
        {hasGoals(goals) && (
          <p className="hint goals-line">
            <Icon name="spark" size={14} /> Fitted to your goals ({[goals.kcal && `${goals.kcal.toLocaleString('en-US')} kcal`, goals.pro && `${goals.pro} g protein`].filter(Boolean).join(', ')}): about{' '}
            {Math.round(avg.kcal).toLocaleString('en-US')} kcal and {Math.round(avg.pro)} g protein a day{size !== 1 ? `, main-meal portions ${Math.round(size * 100)}%` : ''}.{' '}
            <button type="button" className="linkbtn tight inline" onClick={actions.fitGoals}>
              Fit again
            </button>
          </p>
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
            <Icon name="check" size={17} /> Approve {day.d}
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
    const head = (aside?: ReactNode) => (
      <div className="course-head">
        <h3>{SLOT_SHORT[slot]}</h3>
        {aside && <span className="aside">{aside}</span>}
      </div>
    );
    if (m.skip || m.out)
      return (
        <section className="course" key={slot}>
          {head()}
          <div className="dish">
            <span className="dish-emoji" aria-hidden="true">{m.out ? '🍽️' : '🌙'}</span>
            <div className="dish-body">
              <DishLine name={m.out ? 'Eating out' : 'No sweet today'} />
              <p className="dish-desc">{m.out ? `You said you usually eat out on ${DAY_FULL[day.d]}s.` : 'Based on how often you said you want one.'}</p>
            </div>
            <div className="dish-acts single">
              <button type="button" onClick={() => actions.planAnyway(d, slot)}>
                <Icon name="plus" size={15} /> {m.out ? 'Plan a meal anyway' : 'Add one anyway'}
              </button>
            </div>
          </div>
        </section>
      );
    if (!m.r)
      return (
        <section className="course" key={slot}>
          {head()}
          <div className="dish">
            <div className="dish-body">
              <div className="badline">
                <Icon name="info" size={16} />
                <span>No recipe in the library fits your rules for this slot yet. Pick one or leave it open.</span>
              </div>
            </div>
            <div className="dish-acts single">
              <button type="button" onClick={() => actions.openSheet('replace', { d, slot })}>
                <Icon name="swap" size={15} /> Choose a meal
              </button>
            </div>
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
      <section className="course" key={slot}>
        {head(
          (slot === 'Evening sweet' || m.ok) && (
            <>
              {slot === 'Evening sweet' && <span className="pill p-sweet">sweet</span>}
              {m.ok && (
                <span className="stamp">
                  <Icon name="check" size={14} /> Approved
                </span>
              )}
            </>
          ),
        )}
        <div className="dish">
          <span className="dish-emoji" aria-hidden="true">{r.e}</span>
          <div className="dish-body">
            <DishLine name={r.short} kcal={nums && main ? main.kcal : null} onOpen={() => actions.openRecipe(r.id)} />
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
                {!nums && <span className="grow" />}
                <button type="button" className="iconbtn small" aria-label={`Remove ${side.short}`} onClick={() => actions.setSide(d, slot, null)}>
                  <Icon name="x" size={15} />
                </button>
              </div>
            )}
            <div className="dish-meta">
              <StoragePill st={st} />
              <span>
                {pc[r.id] > 1 && `${nth} of ${pc[r.id]} this week · `}
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
          <div className="dish-acts">
            <button type="button" className="yes" aria-pressed={!!m.ok} onClick={() => actions.toggleApproved(d, slot)}>
              <Icon name="check" size={16} /> {m.ok ? 'Approved' : 'Approve'}
            </button>
            <button type="button" onClick={() => actions.openSheet('side', { d, slot })}>
              <Icon name="plus" size={16} /> Side
            </button>
            <button type="button" onClick={() => actions.openSheet('replace', { d, slot })}>
              <Icon name="swap" size={16} /> Replace
            </button>
            <button type="button" onClick={() => actions.openSheet('move', { d, slot })}>
              <Icon name="move" size={16} /> Move
            </button>
            <button type="button" aria-label="Not this meal" onClick={() => actions.openSheet('replace', { d, slot, reject: true })}>
              <Icon name="x" size={16} /> Not this
            </button>
          </div>
        </div>
      </section>
    );
  }
}
