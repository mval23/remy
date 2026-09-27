import { Icon } from '../components/Icon';
import { progress } from '../interview/engine';
import { useRemy } from '../store';

export function Welcome() {
  const { interview: s, actions } = useRemy();
  const pc = progress(s);
  const inProgress = s.started && !s.done;

  return (
    <>
      <main className="body">
        <div className="welcome">
          <div className="w-mark">
            <Icon name="toque" size={44} />
          </div>
          <div>
            <h1>Hi, I’m Remy.</h1>
            <p className="lead">
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
          <p className="hint">Remy gives general meal-planning and balance guidance. It isn’t medical advice or a replacement for a dietitian.</p>
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
