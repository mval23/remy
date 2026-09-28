import { useRef } from 'react';
import { Icon } from '../components/Icon';
import { progress } from '../interview/engine';
import { useRemy } from '../store';

export function Welcome() {
  const { interview: s, actions, sync } = useRemy();
  const pc = progress(s);
  const inProgress = s.started && !s.done;
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <>
      <main className="body">
        <div className="welcome">
          <div className="w-mark">
            <Icon name="toque" size={44} />
          </div>
          <div>
            <h1>Hi, I’m Remy.</h1>
            <p className="intro">
              I’m your personal chef. I’ll learn what you actually enjoy eating, then plan one prep day that feeds your whole week.
            </p>
          </div>
          <ul className="w-steps">
            <li>
              <span className="sw sw-basil"><Icon name="chat" /></span>
              <div>
                <b>A short conversation</b>
                <p className="hint">About 10 minutes, mostly one-tap answers. Skip what you like; it saves as you go.</p>
              </div>
            </li>
            <li>
              <span className="sw sw-citrus"><Icon name="cal" /></span>
              <div>
                <b>A week of food you’ll want to eat</b>
                <p className="hint">Built from your favorites, not from a “healthy foods” list.</p>
              </div>
            </li>
            <li>
              <span className="sw sw-carrot"><Icon name="clock" /></span>
              <div>
                <b>One grocery run, one prep day</b>
                <p className="hint">A timed plan with fridge and freezer labels.</p>
              </div>
            </li>
            <li>
              <span className="sw sw-berry"><Icon name="heart" /></span>
              <div>
                <b>Sweets stay in</b>
                <p className="hint">Planned and portioned, every day if you like.</p>
              </div>
            </li>
          </ul>
          {inProgress && (
            <div className="panel row">
              <Icon name="bookmark" />
              <div className="grow">
                <b>Interview saved</b>
                <p className="hint">
                  {pc.done} of about {pc.total} questions answered
                </p>
              </div>
            </div>
          )}
          {!s.started && sync.configured && (
            <button type="button" className="linkbtn self-start" onClick={() => actions.go('account')}>
              <Icon name="cloud" size={18} /> Already use Remy on another device? Sign in to sync
            </button>
          )}
          {!s.started && (
            <>
              <button type="button" className="linkbtn self-start" onClick={() => fileInput.current?.click()}>
                <Icon name="upload" size={18} /> Have a backup file? Restore it
              </button>
              <input
                ref={fileInput}
                className="file-input"
                type="file"
                accept="application/json,.json"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void actions.importFile(f);
                }}
              />
            </>
          )}
          <p className="hint">Remy gives general meal-planning and balance guidance. It isn’t medical advice or a replacement for a dietitian. <button type="button" className="linkbtn inline" onClick={() => actions.go('privacy')}>Privacy</button></p>
        </div>
      </main>
      <footer className="foot stacked">
        {inProgress ? (
          <>
            <button type="button" className="btn wide" onClick={actions.start}>
              <Icon name="chat" /> Continue where you left off
            </button>
            <button type="button" className="btn ghost wide" onClick={() => actions.go('resume')}>
              See my progress
            </button>
          </>
        ) : s.confirmed ? (
          <>
            <button type="button" className="btn wide" onClick={() => actions.go('home')}>
              <Icon name="cal" /> Go to my week
            </button>
            <button type="button" className="btn ghost wide" onClick={() => actions.go('summary')}>
              Review my profile
            </button>
          </>
        ) : s.done ? (
          <>
            <button type="button" className="btn wide" onClick={() => actions.go('summary')}>
              <Icon name="list" /> Review my profile
            </button>
            <button type="button" className="btn ghost wide" onClick={() => actions.go('resume')}>
              Interview progress
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn wide" onClick={actions.start}>
              <Icon name="chat" /> Start the conversation
            </button>
            <button type="button" className="btn ghost wide" onClick={actions.useSample}>
              Explore with a sample profile
            </button>
          </>
        )}
      </footer>
    </>
  );
}
