import { BottomNav, Header } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { useRemy } from '../store';

const REPO = 'https://github.com/mval23/remy';

/** A one-page privacy note in plain words. Keep it in step with what the app actually does. */
export function Privacy() {
  const { interview, planState, sync } = useRemy();
  const back = planState.plan ? 'prefs' : 'welcome';

  return (
    <>
      <Header title="Privacy" sub="What Remy keeps, where, and who can see it" back={back} />
      <main className="body">
        <div className="panel top-gap">
          <p className="strong">The short version</p>
          <ul className="rules gap-top">
            <li>No ads, no selling data, no tracking or analytics.</li>
            <li>Everything is saved on your device first. Nothing leaves it unless you sign in or turn on AI ideas.</li>
            <li>You can download all of it, or delete all of it, at any time.</li>
          </ul>
        </div>

        <section className="sec">
          <h2>On your device</h2>
          <div className="panel stack">
            <p className="ink-2">
              Your interview answers, your week, grocery list, check-ins, what Remy learned and any AI recipes you kept are saved in this browser’s storage on this device.
              Clearing the browser’s data for this site, or removing the installed app, deletes them. A backup file is the way to keep a copy.
            </p>
            <p className="hint">
              Weight, age group and health answers are optional. If you give them, they stay in your data and are never sent to the AI. Some health answers turn off
              weight-loss planning and leave out a few foods that need extra care.
            </p>
            <p className="hint">
              If you ask for a daily estimate, your age, height, weight and activity are kept only on this device: they aren’t synced to your account or sent to the AI.
              Backup files include them, and “Delete my details” on the estimate removes them.
            </p>
          </div>
        </section>

        <section className="sec">
          <h2>If you sign in</h2>
          <div className="panel stack">
            <p className="ink-2">
              A copy of the same data is kept in a Supabase database run by whoever hosts this copy of Remy, so your devices stay in step. Security rules let each account
              read and change only its own copy. Your password is handled by Supabase’s sign-in service and is never part of your Remy data.
            </p>
            <p className="hint">
              The person who manages that Supabase project can technically see the stored data, as with most apps. “Delete everything” removes your cloud copy too.
            </p>
          </div>
        </section>

        <section className="sec">
          <h2>If you turn on AI ideas</h2>
          <div className="panel stack">
            <p className="ink-2">
              When you ask for a recipe idea, Remy sends your food ratings, preparations, tastes, equipment, allergy and diet rules, and what you typed to Google’s Gemini
              AI through its free service. Google may use what’s sent on the free service to improve its products.
            </p>
            <p className="hint">Remy never sends your name, email, weight or health answers. AI ideas are off until you turn them on, and you can turn them off in Preferences.</p>
          </div>
        </section>

        <section className="sec">
          <h2>If you turn on reminders</h2>
          <div className="panel stack">
            <p className="ink-2">
              Your upcoming reminders (for example “Move the burritos to the fridge”) and your device’s notification address are saved with your account, so they can be sent
              while Remy is closed. Notifications travel through your phone or browser maker’s push service (Apple, Google or Mozilla), like any app’s notifications.
            </p>
            <p className="hint">Turning notifications off on a device removes its address. The calendar option keeps everything on your device.</p>
          </div>
        </section>

        <section className="sec">
          <h2>Other services the app uses</h2>
          <div className="panel stack">
            <p className="ink-2">
              The app’s files come from GitHub Pages, and its fonts from Google Fonts. Like any website, those services see your internet address when the page loads.
              Remy doesn’t add any tracking of its own.
            </p>
          </div>
        </section>

        <section className="sec">
          <h2>Your controls</h2>
          <div className="panel">
            <ul className="rules">
              <li><b>Download a backup</b> or <b>restore</b> one: Profile → Your data.</li>
              <li><b>Delete one learned item</b>, or all of them: Profile → Learned about you.</li>
              <li><b>Delete everything</b> on this device{sync.signedIn ? ' and your cloud copy' : ' (and your cloud copy, if you signed in)'}: Profile → Your data.</li>
              <li><b>Turn AI ideas off</b>: Profile → AI ideas.</li>
            </ul>
          </div>
        </section>

        <section className="sec">
          <h2>Health</h2>
          <div className="panel row align-start">
            <Icon name="info" size={18} />
            <p className="hint ink-2">Remy gives general meal-planning and balance guidance. It isn’t medical advice or a replacement for a doctor or registered dietitian.</p>
          </div>
        </section>

        <p className="hint gap-top">
          Questions or problems: open an issue on{' '}
          <a href={`${REPO}/issues`} target="_blank" rel="noreferrer">
            Remy’s GitHub page
          </a>
          . The app’s code is public, so anyone can check what it does.
        </p>
      </main>
      {interview.confirmed && planState.plan && <BottomNav />}
    </>
  );
}
