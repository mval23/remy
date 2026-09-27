import { useState } from 'react';
import { BottomNav, Header } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { useInstall } from '../pwa';
import { useRemy } from '../store';

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

export function Account() {
  const { interview, sync, actions } = useRemy();
  const install = useInstall();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const send = async () => {
    const e = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setProblem('That doesn’t look like an email address.');
    setBusy(true);
    setProblem(null);
    try {
      await sync.sendCode(e);
      setSentTo(e);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setProblem(
        /fetch|network/i.test(msg)
          ? 'Couldn’t reach the sync service. Check your internet connection and try again.'
          : /rate|limit|seconds/i.test(msg)
            ? 'Too many sign-in emails just now. Wait a minute and try again.'
            : `Couldn’t send the email (${msg}).`,
      );
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!sentTo) return;
    setBusy(true);
    setProblem(null);
    try {
      await sync.verify(sentTo, code);
      setSentTo(null);
      setCode('');
      actions.toast('Signed in. Syncing your data…');
    } catch {
      setProblem('That code didn’t work. Check the latest email, or send a new code.');
    } finally {
      setBusy(false);
    }
  };

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
            <div className="panel stack">
              <p className="ink-2">Sign in with your email on each device, and your profile, week, grocery list and check-offs stay the same everywhere. There’s no password: I’ll email you a code.</p>
              {!sentTo ? (
                <>
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
                    onKeyDown={(e) => e.key === 'Enter' && void send()}
                  />
                  <button type="button" className="btn wide" disabled={busy} onClick={() => void send()}>
                    {busy ? 'Sending…' : 'Email me a sign-in code'}
                  </button>
                </>
              ) : (
                <>
                  <p className="strong">Check {sentTo} for a sign-in code.</p>
                  <label className="hint" htmlFor="sync-code">Code from the email</label>
                  <input
                    id="sync-code"
                    className="field mono"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    onKeyDown={(e) => e.key === 'Enter' && void verify()}
                  />
                  <button type="button" className="btn wide" disabled={busy || code.length < 6} onClick={() => void verify()}>
                    {busy ? 'Checking…' : 'Sign in'}
                  </button>
                  <p className="hint">The email also has a link. It signs you in only if you open it in this same browser; in an installed app, use the code.</p>
                  <button type="button" className="linkbtn" onClick={() => { setSentTo(null); setCode(''); }}>
                    Use a different email or send a new code
                  </button>
                </>
              )}
              {problem && (
                <div className="badline">
                  <Icon name="info" size={16} />
                  <span>{problem}</span>
                </div>
              )}
              <p className="hint">When you sign in, the newest version of your data wins. A new device with nothing on it simply downloads your week.</p>
            </div>
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
