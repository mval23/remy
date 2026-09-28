import { BottomNav, Header, StoragePill } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { MacroRow } from '../components/Macros';
import { str } from '../interview/helpers';
import { fraction } from '../planning/grocery';
import { R } from '../planning/data/recipes';
import { WEEKS } from '../planning/data/weeks';
import { balanceOn, dayNutrition, estimatesOn, kcalRange, mealNutrition, proteinTarget } from '../planning/nutrition';
import { approvalCounts, portions } from '../planning/planner';
import { storage, windowMinutes } from '../planning/rules';
import { duration, schedule } from '../planning/schedule';
import { DAY_FULL, SLOT_SHORT, SLOTS, type Day, type Slot, type Variety } from '../planning/types';
import { useRemy } from '../store';

const VARIETIES: Variety[] = ['favorites', 'balanced', 'variety'];

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

  return (
    <>
      <Header title="Your week" sub={`Prep on ${DAY_FULL[(str(A.prepday) || 'Sun') as Day]} · tap a meal for the recipe`} />
      <main className="body wide">
        <div className="planner-top">
          <div className="seg" role="group" aria-label="Variety">
            {VARIETIES.map((v) => (
              <button key={v} type="button" aria-pressed={planState.variety === v} onClick={() => actions.setVariety(v)}>
                {WEEKS[v].label}
              </button>
            ))}
          </div>
          <p className="hint summary-line">
            {recipeCount} recipes · {duration(sc.total)} prep{' '}
            {sc.total > windowMax ? <span className="pill p-warn">over your window</span> : <span className="pill p-ok">fits</span>} · {approvals.ok}/{approvals.total} approved
          </p>
        </div>

        <div className="days" role="group" aria-label="Day">
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

        {balance && (
          <div className="panel balance-strip">
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
            <div className="row wrap gap-top">
              <span className="hint grow">
                {nums ? <span className="mono">≈{kcalRange(dn.kcal)} kcal · {dn.pro} g protein · {dn.carb} g carbs · {dn.fat} g fat{dn.out ? ' · meal out not counted' : ''}</span> : dn.out ? 'The meal out isn’t counted.' : 'Estimates are off.'}
              </span>
              {!dn.ok && (
                <button type="button" className="btn sm soft" onClick={() => actions.balance([d])}>
                  <Icon name="plus" size={15} /> Balance this day
                </button>
              )}
              <button type="button" className="linkbtn tight" onClick={() => actions.go('nutrition')}>
                Details
              </button>
            </div>
            {dn.light && (
              <div className="badline gap-top">
                <Icon name="info" size={16} />
                <span>This day looks light{nums ? ' (under about 1,200 kcal)' : ''}. Remy doesn’t plan days this low on its own. Add a snack or side.</span>
              </div>
            )}
          </div>
        )}

        <div className="stack meals">
          {SLOTS.map((slot) => (
            mealCard(slot)
          ))}
        </div>

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

  function mealCard(slot: Slot) {
    const m = day.meals[slot];
    if (!m) return null;
    const label = SLOT_SHORT[slot];
    if (m.skip || m.out)
      return (
        <div className="meal out" key={slot}>
          <div className="slot">{label}</div>
          {m.out ? (
            <>
              <div className="name static">Eating out</div>
              <div className="hint">You said you usually eat out on {DAY_FULL[day.d]}s.</div>
            </>
          ) : (
            <div className="hint">No sweet planned today, based on how often you said you want one.</div>
          )}
          <div className="acts">
            <button type="button" onClick={() => actions.planAnyway(d, slot)}>
              <Icon name="plus" size={15} /> {m.out ? 'Plan a meal anyway' : 'Add one anyway'}
            </button>
          </div>
        </div>
      );
    if (!m.r)
      return (
        <div className="meal" key={slot}>
          <div className="slot">{label}</div>
          <div className="badline">
            <Icon name="info" size={16} />
            <span>No recipe in the library fits your rules for this slot yet. Pick one or leave it open.</span>
          </div>
          <div className="acts">
            <button type="button" onClick={() => actions.openSheet('replace', { d, slot })}>
              <Icon name="swap" size={15} /> Choose a meal
            </button>
          </div>
        </div>
      );

    const r = R[m.r];
    const st = storage(r, d + 1);
    const nth = plan!.slice(0, d + 1).filter((x) => x.meals[slot]?.r === r.id).length;
    const target = proteinTarget(slot, ctx.hungry);
    const mn = mealNutrition(m);
    const pro = mn?.pro ?? 0;
    const side = m.side ? R[m.side] : null;
    return (
      <div className={`meal${m.ok ? ' ok' : ''}`} key={slot}>
        <div className="slot">
          {label}
          {slot === 'Evening sweet' && <span className="pill p-sweet">sweet</span>}
          <span className="grow" />
          <StoragePill st={st} />
        </div>
        <button type="button" className="name" onClick={() => actions.openRecipe(r.id)}>
          <span className="em" aria-hidden="true">{r.e}</span>
          {r.short}
        </button>
        <div className="hint">
          {pc[r.id] > 1 && `${nth} of ${pc[r.id]} this week · `}
          {st.k === 'freezer' && r.thaw ? r.thaw : r.reheat.split('.')[0]}
        </div>
        {nums && mn && <MacroRow n={mn} note={m.side ? 'with the side' : undefined} />}
        {st.k === 'unsafe' && (
          <div className="badline">
            <Icon name="info" size={16} />
            <span>This would be day {d + 1} after prep, past its {r.fridge}-day fridge limit, and it doesn’t freeze well. Move it earlier or replace it.</span>
          </div>
        )}
        {side && (
          <div className="sideline">
            <span aria-hidden="true">{side.e}</span>
            <span className="grow">
              + {side.short} <span className="hint">· {storage(side, d + 1).l}</span>
            </span>
            <button type="button" className="iconbtn small" aria-label={`Remove ${side.short}`} onClick={() => actions.setSide(d, slot, null)}>
              <Icon name="x" size={15} />
            </button>
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
        <div className="acts toolbar">
          <button type="button" className="yes" aria-pressed={!!m.ok} onClick={() => actions.toggleApproved(d, slot)}>
            <Icon name="check" size={15} /> {m.ok ? 'Approved' : 'Approve'}
          </button>
          <button type="button" onClick={() => actions.openSheet('side', { d, slot })}>
            <Icon name="plus" size={15} /> Side
          </button>
          <button type="button" onClick={() => actions.openSheet('replace', { d, slot })}>
            <Icon name="swap" size={15} /> Replace
          </button>
          <button type="button" onClick={() => actions.openSheet('move', { d, slot })}>
            <Icon name="move" size={15} /> Move
          </button>
          <button type="button" aria-label="Not this meal" onClick={() => actions.openSheet('replace', { d, slot, reject: true })}>
            <Icon name="x" size={15} /> Not this
          </button>
        </div>
      </div>
    );
  }
}
