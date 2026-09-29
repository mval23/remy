import { useEffect, useState } from 'react';
import { BottomNav, Header } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { dayDate } from '../planning/calendar';
import { toIcs } from '../reminders/ics';
import { disablePush, enablePush, pushState, sendTest, type PushState } from '../reminders/push';
import { upcomingReminders, type ReminderSettings } from '../reminders/reminders';
import { useRemy } from '../store';

const KINDS: [keyof Pick<ReminderSettings, 'prep' | 'thaw' | 'checkin' | 'shop'>, string, string][] = [
  ['prep', 'Prep day', 'The morning you cook, with how long it’ll take'],
  ['shop', 'Shopping days', 'The morning of your monthly shop and your weekly fresh-food shop'],
  ['thaw', 'Thaw tonight', 'The evening frozen meals, or the meat for prep day, need the fridge'],
  ['checkin', 'Weekly check-in', 'The day before prep day, so next week’s grocery list is ready to shop'],
];

/** "Wed 30 Sep, 9:00 AM": the same date style as the rest of the app. */
const when = (ms: number) => `${dayDate(new Date(ms))}, ${new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

/** Choose reminders, get them as phone notifications, or add them to a calendar. */
export function Reminders() {
  const { planState, ctx, actions, sync } = useRemy();
  const s = planState.reminders;
  const [push, setPush] = useState<PushState | 'checking' | 'working'>('checking');
  useEffect(() => {
    void pushState().then(setPush);
  }, []);
  if (!planState.plan) return null;
  const list = upcomingReminders(planState.plan, ctx.A, planState.weekStartedAt, s, new Date(), { ahead: planState.ahead, shopDays: planState.shopDays, monthly: planState.shopping === 'monthly' });

  const turnOn = async () => {
    setPush('working');
    try {
      const st = await enablePush();
      setPush(st);
      if (st === 'on') {
        actions.setReminders({ push: true });
        actions.toast('Notifications on for this device');
      }
    } catch {
      setPush(await pushState());
      actions.toast('Couldn’t turn on notifications. Check your connection and try again.');
    }
  };
  const turnOff = async () => {
    setPush('working');
    await disablePush().catch(() => {});
    setPush(await pushState());
    actions.toast('Notifications off for this device');
  };
  const test = async () => {
    try {
      await sendTest();
      actions.toast('Test sent. It should arrive in a few seconds.');
    } catch {
      actions.toast('The test didn’t send. Reminders may not be set up yet (SETUP.md step 10).');
    }
  };
  const calendar = () => {
    const url = window.location.origin + import.meta.env.BASE_URL;
    const blob = new Blob([toIcs(list, url)], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'remy-reminders.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    actions.toast('Calendar file saved. Open it to add the reminders.');
  };

  return (
    <>
      <Header title="Reminders" sub="Shopping, thawing, check-in and prep day" back="prefs" />
      <main className="body">
        <section className="sec">
          <h2>What to remind you about</h2>
          <div className="list">
            {KINDS.map(([k, title, sub]) => (
              <label className="li li-check" key={k}>
                <input type="checkbox" checked={s[k] !== false} onChange={(e) => actions.setReminders({ [k]: e.target.checked })} />
                <div className="grow">
                  <div className="t">{title}</div>
                  <div className="s">{sub}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="row gap-top-lg">
            <label className="grow">
              <span className="hint">Morning reminders</span>
              <input className="field" type="time" value={s.morning} onChange={(e) => e.target.value && actions.setReminders({ morning: e.target.value })} />
            </label>
            <label className="grow">
              <span className="hint">Evening reminders</span>
              <input className="field" type="time" value={s.evening} onChange={(e) => e.target.value && actions.setReminders({ evening: e.target.value })} />
            </label>
          </div>
        </section>

        <section className="sec">
          <h2>Coming up</h2>
          <div className="list">
            {list.length === 0 && <div className="empty">Nothing left to remind you about this week. After your check-in, next week’s reminders appear here.</div>}
            {list.map((r) => (
              <div className="li" key={r.tag}>
                <span className="c-basil"><Icon name={r.kind === 'thaw' || r.kind === 'meat' ? 'snow' : r.kind === 'prep' ? 'clock' : r.kind === 'shop' ? 'cart' : 'heart'} size={18} /></span>
                <div className="grow">
                  <div className="t">{r.title}</div>
                  <div className="s">
                    {when(r.at)} · {r.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="sec">
          <h2>Phone notifications</h2>
          <div className="panel stack">
            {push === 'checking' || push === 'working' ? (
              <p className="hint">One moment…</p>
            ) : push === 'not-set-up' ? (
              <p className="hint ink-2">Notifications aren’t set up for this copy of Remy yet (SETUP.md step 10). The calendar option below works without them.</p>
            ) : !sync.signedIn ? (
              <>
                <p className="hint ink-2">Notifications come from your account, so sign in first. It’s free.</p>
                <button type="button" className="btn soft wide" onClick={() => actions.go('account')}>
                  <Icon name="cloud" size={17} /> Sign in
                </button>
              </>
            ) : push === 'install-first' ? (
              <p className="hint ink-2">
                On iPhone and iPad, only installed apps can show notifications. In Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>. Open Remy from your home screen
                and come back here.
              </p>
            ) : push === 'unsupported' ? (
              <p className="hint ink-2">This browser can’t show Remy’s notifications. Try the installed app, or use the calendar option below.</p>
            ) : push === 'blocked' ? (
              <p className="hint ink-2">Notifications are blocked for Remy. Allow them in your browser’s or phone’s settings for this site, then come back.</p>
            ) : push === 'on' ? (
              <>
                <div className="row">
                  <span className="c-basil"><Icon name="check" size={20} /></span>
                  <p className="strong grow">On for this device</p>
                </div>
                {!s.push && <p className="hint">Reminders are paused for your account. Turn them back on to get them.</p>}
                <div className="row wrap">
                  {s.push ? (
                    <button type="button" className="btn sm soft" onClick={() => void test()}>
                      Send a test
                    </button>
                  ) : (
                    <button type="button" className="btn sm soft" onClick={() => actions.setReminders({ push: true })}>
                      Resume reminders
                    </button>
                  )}
                  <button type="button" className="btn sm ghost" onClick={() => void turnOff()}>
                    Turn off on this device
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="hint ink-2">Get these reminders as notifications on this device, even when Remy is closed. Turn them on on each device you want them on.</p>
                <button type="button" className="btn wide" onClick={() => void turnOn()}>
                  <Icon name="spark" size={17} /> Turn on notifications
                </button>
              </>
            )}
          </div>
        </section>

        <section className="sec">
          <h2>Or add them to your calendar</h2>
          <div className="panel stack">
            <p className="hint ink-2">Saves this week’s reminders as calendar events with alarms. Works on any phone, no sign-in needed. Do it again after each check-in.</p>
            <button type="button" className="btn ghost wide" disabled={!list.length} onClick={calendar}>
              <Icon name="cal" size={17} /> Add this week to my calendar
            </button>
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  );
}
