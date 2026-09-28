import { BottomNav, Header, RowButton, StoragePill } from '../components/Chrome';
import { Avatar, Icon } from '../components/Icon';
import { listText, str } from '../interview/helpers';
import { checkinDue, mealsToRate, noticeSuggestion } from '../learning/learning';
import { R } from '../planning/data/recipes';
import { costEstimate, groceryList } from '../planning/grocery';
import { balanceOn, dayNutrition } from '../planning/nutrition';
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
  const toBuy = items.filter((x) => !x.home);
  const checked = toBuy.filter((x) => planState.groceries.checked[x.k]).length;
  const cost = costEstimate(items, A);
  const approvals = approvalCounts(plan);
  const balancedDays = plan.filter((d) => dayNutrition(d, ctx.hungry).ok).length;
  const prepDayKey = (str(A.prepday) || 'Sun') as Day;
  const prepDay = DAY_FULL[prepDayKey];
  const isPrepDay = today === prepDayKey;
  const heading = isPrepDay ? 'Prep day today' : upcoming ? `Prep day is ${prepDay}` : idx > 6 ? 'Time to plan next week' : `Day ${ti + 1} after prep`;
  const notice = noticeSuggestion(A, planState.noticed);
  const toRate = mealsToRate(plan);
  const ratedCount = toRate.filter((m) => planState.checkin.rated[m.id]).length;
  // The check-in matters most on the last day of the week, before the next prep day.
  const due = checkinDue(A, planState.weekStartedAt);
  const nextReminder = upcomingReminders(plan, A, planState.weekStartedAt, planState.reminders)[0];

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
      <main className="body">
        <div className="hero">
          <p className="eyebrow">{upcoming ? `Your new week starts ${DAY_FULL[day.d]}` : `Today · ${DAY_FULL[day.d]}`}</p>
          <h2>{heading}</h2>
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

        {due && (
          <section className="sec">
            <h2>End of the week</h2>
            <div className="panel stack">
              <div className="row align-start">
                <span className="c-berry"><Icon name="heart" size={22} /></span>
                <div className="grow">
                  <b>Weekly check-in</b>
                  <p className="hint">Rate this week’s meals, then Remy plans next week around what you liked. About 2 minutes.</p>
                </div>
              </div>
              <button type="button" className="btn wide" onClick={() => actions.go('checkin')}>
                {ratedCount ? `Continue check-in (${ratedCount} of ${toRate.length} rated)` : 'Start the check-in'}
              </button>
            </div>
          </section>
        )}

        {notice && (
          <section className="sec">
            <h2>Remy noticed</h2>
            <div className="panel">
              <div className="msg">
                <Avatar />
                <div className="bubble">{notice.text}</div>
              </div>
              <div className="row wrap gap-top-lg">
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
            </div>
          </section>
        )}
        {planState.trial && !notice && (
          <div className="warnline">
            <Icon name="spark" size={16} />
            <span>
              Next week includes {R[planState.trial].name.toLowerCase()} as a side, once. Delete it in Preferences if you change your mind.
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
            <RowButton
              icon="bell"
              tone="c-citrus"
              title="Reminders"
              sub={nextReminder ? `Next: ${nextReminder.title.toLowerCase()}, ${new Date(nextReminder.at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : 'Thawing, check-in and prep day'}
              onClick={() => actions.go('reminders')}
            />
            {balanceOn(A) && (
              <RowButton icon="heart" tone="c-berry" title="Balance" sub={`${balancedDays} of 7 days have protein at every meal and 3+ fruit and veg`} onClick={() => actions.go('nutrition')} />
            )}
            {!due && (
              <RowButton
                icon="smile"
                tone="c-berry"
                title="Weekly check-in"
                sub={ratedCount ? `${ratedCount} of ${toRate.length} meals rated so far` : 'Rate meals as you eat them, or all at once at the end of the week'}
                onClick={() => actions.go('checkin')}
              />
            )}
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  );
}
