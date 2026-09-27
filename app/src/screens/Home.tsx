import { BottomNav, Header, RowButton, StoragePill } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { listText, str } from '../interview/helpers';
import { R } from '../planning/data/recipes';
import { costEstimate, groceryList } from '../planning/grocery';
import { balanceOn, dayNutrition } from '../planning/nutrition';
import { approvalCounts } from '../planning/planner';
import { storage, weekDays } from '../planning/rules';
import { duration, packingCounts, schedule } from '../planning/schedule';
import { DAY_FULL, DAYS, SLOT_SHORT, SLOTS, type Day } from '../planning/types';
import { useRemy } from '../store';

export function Home() {
  const { planState, ctx, actions } = useRemy();
  const plan = planState.plan;
  if (!plan) return null;
  const A = ctx.A;

  const today = DAYS[(new Date().getDay() + 6) % 7];
  const ti = Math.max(0, weekDays(A).indexOf(today));
  const day = plan[ti];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Frozen meals for tomorrow that should thaw overnight.
  const tomorrow = plan[ti + 1];
  const thaw: string[] = [];
  if (tomorrow)
    for (const slot of SLOTS) {
      const m = tomorrow.meals[slot];
      if (!m?.r) continue;
      const r = R[m.r];
      if (storage(r, ti + 2).k === 'freezer' && r.thaw?.includes('night before')) thaw.push(r.short.toLowerCase());
    }

  const sc = schedule(plan, A);
  const packs = packingCounts(plan, A);
  const items = groceryList(plan, A, planState.groceries);
  const toBuy = items.filter((x) => !x.home);
  const checked = toBuy.filter((x) => planState.groceries.checked[x.k]).length;
  const cost = costEstimate(items, A);
  const approvals = approvalCounts(plan);
  const balancedDays = plan.filter((d) => dayNutrition(d, ctx.hungry).ok).length;
  const prepDayKey = (str(A.prepday) || 'Sun') as Day;
  const prepDay = DAY_FULL[prepDayKey];
  // The last day of the week is also the next prep day; today's meals are still this week's.
  const isPrepDay = today === prepDayKey;

  return (
    <>
      <Header
        title={greeting}
        sub="Here’s your day"
        right={
          <button type="button" className="iconbtn" aria-label="Your profile" onClick={() => actions.go('summary')}>
            <Icon name="user" size={22} />
          </button>
        }
      />
      <main className="body">
        <div className="hero">
          <p className="eyebrow">Today · {DAY_FULL[day.d]}</p>
          <h2>{isPrepDay ? 'Prep day today' : `Day ${ti + 1} after prep`}</h2>
          {isPrepDay && (
            <button type="button" className="btn sm hero-btn" onClick={() => actions.go('prep')}>
              <Icon name="clock" size={16} /> Open the prep timeline
            </button>
          )}
        </div>
        <div className="list hero-list">
          {SLOTS.map((slot) => {
            const m = day.meals[slot];
            if (!m || m.skip) return null;
            if (m.out || !m.r)
              return (
                <div className="li" key={slot}>
                  <div className="grow">
                    <div className="s">{SLOT_SHORT[slot]}</div>
                    <div className="t">{m.out ? 'Eating out' : 'Needs a choice'}</div>
                  </div>
                </div>
              );
            const r = R[m.r];
            return (
              <button type="button" className="li li-btn" key={slot} onClick={() => actions.openRecipe(r.id)}>
                <span className="em-lg" aria-hidden="true">{r.e}</span>
                <div className="grow">
                  <div className="s">{SLOT_SHORT[slot]}</div>
                  <div className="t">
                    {r.short}
                    {m.side && <span className="hint"> + {R[m.side].short.toLowerCase()}</span>}
                  </div>
                </div>
                <StoragePill st={storage(r, ti + 1)} />
              </button>
            );
          })}
        </div>
        {thaw.length > 0 && (
          <div className="warnline">
            <Icon name="snow" size={16} />
            <span>
              <b>Tonight:</b> move {listText(thaw)} from the freezer to the fridge for tomorrow.
            </span>
          </div>
        )}

        <section className="sec">
          <h2>This week</h2>
          <div className="list">
            <RowButton icon="clock" tone="c-carrot" title={`Prep day · ${prepDay}`} sub={`${duration(sc.total)} planned · ${packs.containers + packs.bags + packs.foil} containers and bags`} onClick={() => actions.go('prep')} />
            <RowButton
              icon="cart"
              tone="c-basil"
              title="Groceries"
              sub={`${toBuy.length} to buy · ${checked} checked off${cost.show ? ` · about $${cost.low}–${cost.high}` : ''}`}
              onClick={() => actions.go('grocery')}
            />
            <RowButton icon="cal" tone="c-blue" title="Meal plan" sub={`${approvals.ok} of ${approvals.total} meals approved`} onClick={() => actions.go('planner')} />
            {balanceOn(A) && (
              <RowButton icon="heart" tone="c-berry" title="Balance" sub={`${balancedDays} of 7 days have protein at every meal and 3+ fruit and veg`} onClick={() => actions.go('nutrition')} />
            )}
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  );
}
