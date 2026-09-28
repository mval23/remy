import { useState } from 'react';
import { BottomNav, Header } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { useInstall } from '../pwa';
import { useRemy } from '../store';
import { friendlyAuthError } from '../sync/authErrors';

function ago(t: number | null): string {
  if (!t) return '';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const STATUS: Record<string, string> = {
  syncing: 'Syncing…',
  synced: 'Synced',
  offline: 'Offline. Changes are saved here and sync when you’re back online.',
  error: 'Couldn’t sync right now. Your changes are safe on this device.',
};

const MIN_PASSWORD = 8;
const looksLikeEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e);

function PasswordField({ id, label, value, onChange, autoComplete, onEnter }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; onEnter: () => void }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <label className="hint" htmlFor={id}>{label}</label>
      <div className="row">
        <input
          id={id}
          className="field grow"
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        />
        <button type="button" className="btn sm ghost tall" aria-pressed={show} onClick={() => setShow(!show)}>
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </>
  );
}

/** Sign in, create an account, or reset a forgotten password. */
function SignIn() {
  const { sync, actions } = useRemy();
  const [mode, setMode] = useState<'signin' | 'create' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setProblem(null);
    setNotice(null);
    const e = email.trim();
    if (!looksLikeEmail(e)) return setProblem('That doesn’t look like an email address.');
    if (mode !== 'forgot' && password.length < (mode === 'create' ? MIN_PASSWORD : 1)) {
      return setProblem(mode === 'create' ? `Choose a password with at least ${MIN_PASSWORD} characters.` : 'Enter your password.');
    }
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setProblem(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    run(async () => {
      const e = email.trim();
      if (mode === 'signin') {
        await sync.signIn(e, password);
        actions.toast('Signed in. Syncing your data…');
      } else if (mode === 'create') {
        const session = await sync.createAccount(e, password);
        if (session) actions.toast('Account created. Syncing your data…');
        else {
          setMode('signin');
          setNotice(`Almost done: open the confirmation email sent to ${e} (check spam too), then sign in here with your password.`);
        }
      } else {
        await sync.sendPasswordReset(e);
        setNotice(`If ${e} has an account, a link to choose a new password is on its way. Open it, set the new password, then sign in here.`);
      }
    });

  const tabs: [typeof mode, string][] = [['signin', 'Sign in'], ['create', 'Create account']];

  return (
    <div className="panel stack">
      <p className="ink-2">Sign in on each device, and your profile, week, grocery list and check-offs stay the same everywhere.</p>
      {mode !== 'forgot' && (
        <div className="seg" role="group" aria-label="Account">
          {tabs.map(([m, label]) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setProblem(null); }}>
              {label}
            </button>
          ))}
        </div>
      )}
      {mode === 'forgot' && <p className="strong">Reset your password</p>}

      <label className="hint" htmlFor="sync-email">Email</label>
      <input
        id="sync-email"
        className="field"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void submit()}
      />
      {mode !== 'forgot' && (
        <PasswordField
          id="sync-password"
          label={mode === 'create' ? `Password (at least ${MIN_PASSWORD} characters)` : 'Password'}
          value={password}
          onChange={setPassword}
          autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
          onEnter={() => void submit()}
        />
      )}
      <button type="button" className="btn wide" disabled={busy} onClick={() => void submit()}>
        {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : mode === 'create' ? 'Create account' : 'Email me a reset link'}
      </button>

      {mode === 'signin' && (
        <button type="button" className="linkbtn self-start" onClick={() => { setMode('forgot'); setProblem(null); setNotice(null); }}>
          Forgot your password?
        </button>
      )}
      {mode === 'forgot' && (
        <button type="button" className="linkbtn self-start" onClick={() => { setMode('signin'); setProblem(null); }}>
          Back to sign in
        </button>
      )}
      {mode === 'create' && <p className="hint">A password manager can create and remember a strong password for you.</p>}

      {notice && (
        <div className="warnline">
          <Icon name="info" size={16} />
          <span>{notice}</span>
        </div>
      )}
      {problem && (
        <div className="badline">
          <Icon name="info" size={16} />
          <span>{problem}</span>
        </div>
      )}
      <p className="hint">When you sign in, the newest version of your data wins. A new device with nothing on it simply downloads your week.</p>
    </div>
  );
}

/** Shown after opening a password-reset link. */
function NewPassword() {
  const { sync, actions } = useRemy();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = async () => {
    if (password.length < MIN_PASSWORD) return setProblem(`Choose a password with at least ${MIN_PASSWORD} characters.`);
    setBusy(true);
    setProblem(null);
    try {
      await sync.setNewPassword(password);
      actions.toast('New password saved. You’re signed in.');
    } catch (err) {
      setProblem(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="panel stack">
      <p className="strong">Choose a new password</p>
      <PasswordField id="new-password" label={`New password (at least ${MIN_PASSWORD} characters)`} value={password} onChange={setPassword} autoComplete="new-password" onEnter={() => void save()} />
      <button type="button" className="btn wide" disabled={busy} onClick={() => void save()}>
        {busy ? 'Saving…' : 'Save new password'}
      </button>
      <button type="button" className="linkbtn self-start" onClick={sync.cancelRecovery}>
        Cancel
      </button>
      {problem && (
        <div className="badline">
          <Icon name="info" size={16} />
          <span>{problem}</span>
        </div>
      )}
      <p className="hint">If you use Remy as an installed app, sign in there with this new password afterwards.</p>
    </div>
  );
}

export function Account() {
  const { interview, sync, actions } = useRemy();
  const install = useInstall();
  const back = interview.confirmed ? 'summary' : 'welcome';

  return (
    <>
      <Header title="Sync & install" sub="Use Remy on your phone and computer" back={back} />
      <main className="body">
        <section className="sec">
          <h2>Sync between devices</h2>
          {!sync.configured ? (
            <div className="panel stack">
              <div className="row align-start">
                <Icon name="cloudOff" />
                <p className="ink-2">Sync isn’t set up for this copy of Remy yet. Everything is saved on this device, and the app works fully without it.</p>
              </div>
              <p className="hint">Setting it up takes a free Supabase account. The steps are in SETUP.md in the project.</p>
            </div>
          ) : sync.recovery ? (
            <NewPassword />
          ) : sync.signedIn ? (
            <div className="panel stack">
              <div className="row">
                <span className={sync.status === 'error' || sync.status === 'offline' ? 'c-citrus' : 'c-basil'}>
                  <Icon name={sync.status === 'offline' ? 'cloudOff' : 'cloud'} size={22} />
                </span>
                <div className="grow">
                  <div className="strong">{sync.email}</div>
                  <p className="hint">
                    {STATUS[sync.status] ?? ''}
                    {sync.status === 'synced' && sync.lastSynced ? ` ${ago(sync.lastSynced)}` : ''}
                  </p>
                </div>
              </div>
              <p className="hint">Changes sync automatically within a few seconds, and Remy checks for changes from your other devices every 30 seconds while it’s open.</p>
              <div className="row wrap">
                <button type="button" className="btn sm soft" disabled={sync.status === 'syncing'} onClick={() => void sync.syncNow()}>
                  <Icon name="cloud" size={16} /> Sync now
                </button>
                <button type="button" className="btn sm ghost" onClick={() => void sync.signOut().then(() => actions.toast('Signed out. This device keeps its copy.'))}>
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <SignIn />
          )}
        </section>

        <section className="sec">
          <h2>Install on this device</h2>
          <div className="panel stack">
            {install.installed ? (
              <div className="row">
                <span className="c-basil"><Icon name="check" size={22} /></span>
                <p className="strong">Remy is installed and opens like an app.</p>
              </div>
            ) : install.canPrompt ? (
              <>
                <p className="ink-2">Add Remy to your home screen or desktop. It opens in its own window and works offline.</p>
                <button type="button" className="btn wide" onClick={() => void install.install().then((ok) => ok && actions.toast('Remy installed'))}>
                  <Icon name="download" size={18} /> Install Remy
                </button>
              </>
            ) : install.apple ? (
              <ol className="rules">
                <li>Open Remy in <b>Safari</b>.</li>
                <li>Tap the <b>Share</b> button (the square with an arrow).</li>
                <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
              </ol>
            ) : (
              <ol className="rules">
                <li><b>Android (Chrome):</b> open the ⋮ menu and choose <b>Install app</b> or <b>Add to Home screen</b>.</li>
                <li><b>Computer (Chrome or Edge):</b> click the install icon at the right end of the address bar.</li>
                <li><b>iPhone or iPad:</b> in Safari, tap Share, then <b>Add to Home Screen</b>.</li>
              </ol>
            )}
          </div>
        </section>

        <section className="sec">
          <h2>Offline</h2>
          <div className="panel row align-start">
            <Icon name="phone" />
            <p className="ink-2">After the first visit, Remy works without internet, so your grocery list opens in the store even with no signal. Changes made offline stay on the device and sync when you’re back online.</p>
          </div>
        </section>
      </main>
      {interview.confirmed && <BottomNav />}
    </>
  );
}
