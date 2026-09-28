import { BottomNav, Header, StoragePill } from '../components/Chrome';
import { ChefNote, DishLine, LeadLink, MacroLine, Mast, SecHead } from '../components/Dish';
import { Icon } from '../components/Icon';
import { listText, str } from '../interview/helpers';
import { checkinDue, mealsToRate, noticeSuggestion } from '../learning/learning';
import { R } from '../planning/data/recipes';
import { costEstimate, groceryList } from '../planning/grocery';
import { buysMonthly } from '../planning/month';
import { balanceOn, dayNutrition, estimatesOn, mealNutrition } from '../planning/nutrition';
import { approvalCounts } from '../planning/planner';
import { dayIndexOn } from '../planning/calendar';
import { storage } from '../planning/rules';
import { duration, packingCounts, schedule } from '../planning/schedule';
import { DAY_FULL, DAYS, SLOT_SHORT, SLOTS, type Day } from '../planning/types';
import { thawFor, upcomingReminders } from '../reminders/reminders';
import { useRemy } from '../store';

export function Home() {
  const { planState, ctx, actions, sync } = useRemy();
  const plan = planState.plan;
  if (!plan) return null;
  const A = ctx.A;

  const today = DAYS[(new Date().getDay() + 6) % 7];
  // Which day of the planned week today is: below 0 when a new week is planned but not started yet.
  const idx = dayIndexOn(A, planState.weekStartedAt);
  const upcoming = idx < 0;
  const ti = Math.min(6, Math.max(0, idx));
  const day = plan[ti];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Frozen meals for tomorrow that should thaw overnight.
  const thaw = idx + 1 >= 1 && idx + 1 <= 6 ? thawFor(plan, idx + 1) : [];

  const sc = schedule(plan, A);
  const packs = packingCounts(plan, A);
  const items = groceryList(plan, A, planState.groceries);
  // Shopping monthly: staples are on the month's list, not this week's.
  const toBuy = items.filter((x) => !x.home && (planState.shopping !== 'monthly' || x.custom || !buysMonthly(x.k)));
  const checked = toBuy.filter((x) => planState.groceries.checked[x.k]).length;
  const cost = costEstimate(items, A);
  const approvals = approvalCounts(plan);
  const balancedDays = plan.filter((d) => dayNutrition(d, ctx.hungry).ok).length;
  const prepDayKey = (str(A.prepday) || 'Sun') as Day;
  const prepDay = DAY_FULL[prepDayKey];
  const isPrepDay = today === prepDayKey;
  const notice = noticeSuggestion(A, planState.noticed);
  const toRate = mealsToRate(plan);
  const ratedCount = toRate.filter((m) => planState.checkin.rated[m.id]).length;
  // The check-in matters most on the last day of the week, before the next prep day.
  const due = checkinDue(A, planState.weekStartedAt);
  const nums = estimatesOn(planState.nutrition, A);
  const nextReminder = upcomingReminders(plan, A, planState.weekStartedAt, planState.reminders)[0];

  const dn = dayNutrition(day, ctx.hungry);
  const title = isPrepDay ? 'Prep day' : upcoming ? `${DAY_FULL[day.d]}’s menu` : 'Today’s menu';
  const sub = isPrepDay ? `Cooking today · about ${duration(sc.total)}` : idx > 6 ? 'Time to plan next week' : upcoming ? `Prep day is ${prepDay}` : `Day ${ti + 1} after prep`;

  return (
    <>
      <Header
        title={greeting}
        sub="Here’s your day"
        right={
          <>
            <button type="button" className="iconbtn" aria-label="Sync and install" onClick={() => actions.go('account')}>
              <Icon name={sync.signedIn && sync.status !== 'offline' ? 'cloud' : 'cloudOff'} size={22} />
            </button>
          </>
        }
      />
      <main className="body wide">
        <div className="cols">
          <div>
            <Mast kicker={upcoming ? `Your new week starts ${DAY_FULL[day.d]}` : `Today · ${DAY_FULL[day.d]}`} title={title} sub={sub}>
              {isPrepDay && (
                <button type="button" className="btn wide" onClick={() => actions.go('prep')}>
                  <Icon name="clock" size={17} /> Open the prep timeline
                </button>
              )}
            </Mast>
            <div className="home-menu">
              {SLOTS.map((slot) => {
                const m = day.meals[slot];
                if (!m || m.skip) return null;
                if (m.out || !m.r)
                  return (
                    <div className="dish" key={slot}>
                      <span className="dish-emoji" aria-hidden="true">{m.out ? '🍽️' : '❔'}</span>
                      <div className="dish-body">
                        <span className="slot-label">{SLOT_SHORT[slot]}</span>
                        <DishLine name={m.out ? 'Eating out' : 'Needs a choice'} />
                      </div>
                    </div>
                  );
                const r = R[m.r];
                const mn = mealNutrition(m);
                return (
                  <div className="dish" key={slot}>
                    <span className="dish-emoji" aria-hidden="true">{r.e}</span>
                    <div className="dish-body">
                      <span className="slot-label">{SLOT_SHORT[slot]}</span>
                      <DishLine name={r.short} kcal={nums && mn ? mn.kcal : null} onOpen={() => actions.openRecipe(r.id)} />
                      {m.side && <p className="dish-desc">+ {R[m.side].short}</p>}
                      <div className="dish-meta">
                        <StoragePill st={storage(r, ti + 1)} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {nums && (
              <div className="bill">
                <DishLine name={upcoming ? `${DAY_FULL[day.d]}’s total` : 'Today’s total'} kcal={Math.round(dn.kcal / 10) * 10} />
                <MacroLine n={dn} />
                {dn.out && <p className="bill-note">The meal out isn’t counted.</p>}
              </div>
            )}
            {thaw.length > 0 && (
              <div className="warnline">
                <Icon name="snow" size={16} />
                <span>
                  <b>Tonight:</b> move {listText(thaw)} from the freezer to the fridge for tomorrow.
                </span>
              </div>
            )}
          </div>

          <div>
            {due && (
              <ChefNote kicker="End of the week" icon="heart">
                <p>Rate this week’s meals, then I’ll plan next week around what you liked. About 2 minutes.</p>
                <div className="row">
                  <button type="button" className="btn wide" onClick={() => actions.go('checkin')}>
                    {ratedCount ? `Continue check-in (${ratedCount} of ${toRate.length} rated)` : 'Start the check-in'}
                  </button>
                </div>
              </ChefNote>
            )}

            {notice && (
              <ChefNote kicker="Remy noticed">
                <p>{notice.text}</p>
                <div className="row wrap">
                  <button type="button" className="btn sm" onClick={() => actions.answerNotice('yes')}>
                    Try it once
                  </button>
                  <button type="button" className="btn sm ghost" onClick={() => actions.answerNotice('no')}>
                    No thanks
                  </button>
                  <button type="button" className="btn sm ghost" onClick={() => actions.answerNotice('stop')}>
                    Stop asking
                  </button>
                </div>
              </ChefNote>
            )}
            {planState.trial && !notice && (
              <div className="warnline">
                <Icon name="spark" size={16} />
                <span>
                  Next week includes {R[planState.trial].name.toLowerCase()} as a side, once. Delete it in Preferences if you change your mind.
                </span>
              </div>
            )}

            <section className="msec">
              <SecHead title="This week" />
              <LeadLink k={`Prep day · ${prepDay}`} v={duration(sc.total)} onClick={() => actions.go('prep')} />
              <LeadLink k="Groceries" v={checked ? `${checked} of ${toBuy.length} checked` : `${toBuy.length} to buy`} onClick={() => actions.go('grocery')} />
              <LeadLink k="Meal plan" v={`${approvals.ok} of ${approvals.total} approved`} onClick={() => actions.go('planner')} />
              <LeadLink
                k="Reminders"
                v={nextReminder ? new Date(nextReminder.at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : undefined}
                onClick={() => actions.go('reminders')}
              />
              {balanceOn(A) && <LeadLink k="Balance" v={`${balancedDays} of 7 days`} onClick={() => actions.go('nutrition')} />}
              {!due && <LeadLink k="Weekly check-in" v={ratedCount ? `${ratedCount} of ${toRate.length} rated` : 'rate as you go'} onClick={() => actions.go('checkin')} />}
              <p className="hint gap-top">
                {packs.containers + packs.bags + packs.foil} containers and bags on prep day{cost.show ? ` · groceries about $${cost.low}–${cost.high}` : ''}.
              </p>
            </section>
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
