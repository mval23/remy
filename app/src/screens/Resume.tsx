import { Avatar, Icon } from '../components/Icon';
import { currentQuestion, progress, sectionStats } from '../interview/engine';
import { useRemy } from '../store';

function savedAgo(t: number | null): string {
  if (!t) return '';
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  return new Date(t).toLocaleString();
}

export function Resume() {
  const { interview: s, actions } = useRemy();
  const pc = progress(s);
  const q = currentQuestion(s);

  const header = (
    <header className="head">
      <button type="button" className="iconbtn" aria-label="Back to welcome" onClick={() => actions.go('welcome')}>
        <Icon name="left" size={22} />
      </button>
      <div className="ttl">
        <h1>Your interview</h1>
        <p>{!s.started ? 'Progress and resume' : s.done ? 'Complete' : 'Saved and ready to resume'}</p>
      </div>
    </header>
  );

  if (!s.started) {
    return (
      <>
        {header}
        <main className="body">
          <div className="empty">
            <Icon name="bookmark" size={36} />
            <h2>No interview in progress</h2>
            <p>Once you start, every answer is saved on this device right away.</p>
          </div>
          <div className="stack">
            <button type="button" className="btn wide" onClick={actions.start}>
              Start the interview
            </button>
            <button type="button" className="btn ghost wide" onClick={actions.loadHalfSample}>
              Load a half-finished example
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {header}
      <main className="body">
        <div className="msg top-gap">
          <Avatar />
          <div className="bubble">{s.done ? 'We finished the interview. You can still change any answer.' : 'Welcome back. Want to pick up where we stopped?'}</div>
        </div>
        <section className="sec">
          <div className="panel row">
            <div className="grow">
              <div className="stat">
                {pc.done} <span className="stat-sub">of ~{pc.total}</span>
              </div>
              <p className="hint">questions answered · saved {savedAgo(s.updatedAt)} on this device</p>
            </div>
            {s.done ? (
              <span className="pill p-ok">
                <Icon name="check" size={13} /> Complete
              </span>
            ) : (
              <span className="pill p-warn">In progress</span>
            )}
          </div>
        </section>
        <section className="sec">
          <h2>Sections</h2>
          <div className="list">
            {sectionStats(s).map((x) => (
              <div className="li" key={x.sec.id}>
                <div className="grow">
                  <div className="t">{x.sec.name}</div>
                  <div className="bar">
                    <div style={{ width: `${x.total ? Math.round((100 * x.done) / x.total) : 0}%` }} />
                  </div>
                </div>
                {x.done === x.total ? (
                  <span className="pill p-ok">Done</span>
                ) : x.done ? (
                  <span className="pill p-warn">
                    {x.done} of {x.total}
                  </span>
                ) : (
                  <span className="pill p-muted">Not started</span>
                )}
              </div>
            ))}
          </div>
        </section>
        {!s.done && q && (
          <section className="sec">
            <h2>Next up</h2>
            <div className="msg">
              <Avatar />
              <div className="bubble past">“{q.say(s.answers)}”</div>
            </div>
          </section>
        )}
        <section className="sec stack">
          {s.done ? (
            <button type="button" className="btn wide" onClick={() => actions.go('summary')}>
              View my profile
            </button>
          ) : (
            <button type="button" className="btn wide" onClick={actions.start}>
              Continue where I left off
            </button>
          )}
          <button type="button" className="btn ghost wide" onClick={() => actions.openSheet('map')}>
            Review or change answers
          </button>
          <button type="button" className="btn ghost wide" onClick={() => actions.openSheet('confirmRestart')}>
            Start over
          </button>
        </section>
      </main>
    </>
  );
}
