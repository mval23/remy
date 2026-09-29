import { approvedCount, weekStatus } from '../planning/ahead';
import { dayDate, monthCalendar, monthsText, rangeText, weekDates, type DayMark } from '../planning/calendar';
import { approvalCounts } from '../planning/planner';
import { DAY_FULL, DAYS, type Day } from '../planning/types';
import { useRemy } from '../store';
import { ChefNote, LeadLink, Mast } from './Dish';
import { Icon } from './Icon';

const MARKS: Record<DayMark, [string, string]> = {
  month: ['🥩', 'Monthly shop'],
  fresh: ['🥬', 'Fresh food'],
  thaw: ['❄️', 'Thaw tonight'],
  prep: ['🍳', 'Prep day'],
  out: ['🍽️', 'Eating out'],
};
const ORDER: DayMark[] = ['month', 'fresh', 'thaw', 'prep', 'out'];

/** The month on a calendar: every planned week with its dates, shopping, thawing and prep days. Tap a day to open it. */
export function MonthView() {
  const { planState, ctx, actions } = useRemy();
  const plan = planState.plan;
  if (!plan) return null;
  const A = ctx.A;
  const weeks = [plan, ...planState.ahead];
  const monthly = planState.shopping === 'monthly';
  const shop = planState.shopDays;
  const outs = weeks.map((w) => w.map((d) => Object.values(d.meals).some((m) => m?.out)));
  const days = monthCalendar(A, planState.weekStartedAt, weeks.length, shop, monthly, outs);
  const dates = weeks.map((_, w) => weekDates(A, planState.weekStartedAt, w, shop, monthly));
  const first = dates[0];
  const last = dates[dates.length - 1];
  const used = ORDER.filter((m) => days.some((d) => d.marks.includes(m)));
  const noDays = !shop.fresh && !shop.month;

  return (
    <>
      <Mast kicker={`${weeks.length} prep days · ${rangeText(first.start, last.end)}`} icon="cal" title={monthsText(first.prep, last.end)} compact />

      <div className="cal" role="grid" aria-label="Planned weeks">
        {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as Day[]).map((d) => (
          <span className="cal-dow" key={d} aria-hidden="true">{d}</span>
        ))}
        {days.map((d) => {
          const label = `${dayDate(d.date)}${d.marks.length ? `: ${d.marks.map((m) => MARKS[m][1]).join(', ')}` : ''}${d.today ? ' (today)' : ''}`;
          const cls = `cal-day${d.w >= 0 ? ` wk${d.w % 2}` : ' off'}${d.today ? ' today' : ''}${d.marks.includes('prep') ? ' prep' : ''}`;
          const inner = (
            <>
              <span className="n">{d.date.getDate()}</span>
              <span className="m" aria-hidden="true">{d.marks.map((m) => MARKS[m][0]).join('')}</span>
            </>
          );
          return d.w >= 0 ? (
            <button type="button" key={d.date.getTime()} className={cls} aria-label={label} onClick={() => actions.openDay(d.w, d.i)}>
              {inner}
            </button>
          ) : (
            <span key={d.date.getTime()} className={cls} aria-label={label}>
              {inner}
            </span>
          );
        })}
      </div>
      {used.length > 0 && (
        <p className="cal-legend">
          {used.map((m) => (
            <span key={m}>
              {MARKS[m][0]} {MARKS[m][1].toLowerCase()}
            </span>
          ))}
        </p>
      )}

      {noDays && (
        <ChefNote kicker="Your shopping days" icon="cart">
          <p>Tell Remy when you shop, and the calendar shows your shopping days, when to thaw the meat, and what to buy each time.</p>
          <div className="row">
            <button type="button" className="btn sm" onClick={() => actions.openSheet('menuSettings')}>
              Set shopping days
            </button>
          </div>
        </ChefNote>
      )}

      <section className="msec">
        <div className="msec-head">
          <h3>The weeks</h3>
          <span className="aside">tap one to open it</span>
        </div>
        {weeks.map((w, i) => {
          const st = weekStatus(w);
          const c = approvalCounts(w);
          const v = i === 0 ? 'This week' : st === 'approved' ? '✓ Approved' : st === 'some' ? `${approvedCount(w)} of ${c.total} approved` : 'Draft';
          return (
            <LeadLink
              key={i}
              k={`${rangeText(dates[i].start, dates[i].end)} · prep ${DAY_FULL[DAYS[(dates[i].prep.getDay() + 6) % 7] as Day].slice(0, 3)} ${dates[i].prep.getDate()}`}
              v={v}
              onClick={() => actions.openDay(i, 0)}
            />
          );
        })}
        <p className="hint gap-top">
          <Icon name="info" size={14} /> Drafts follow what Remy learns at each check-in. Approve a week to keep it exactly as it is.
        </p>
      </section>
    </>
  );
}
