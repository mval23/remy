import type { ReactNode } from 'react';
import { firstOpen, formatAnswer, isAnswered, sectionStats, sequence } from '../interview/engine';
import { useRemy } from '../store';
import { Icon } from './Icon';

function SheetFrame({ children, label }: { children: ReactNode; label: string }) {
  const { actions } = useRemy();
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && actions.closeSheet()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="grab" />
        {children}
      </div>
    </div>
  );
}

function InterviewMap() {
  const { interview: s, actions } = useRemy();
  const seq = sequence(s.answers);
  const open = firstOpen(s);
  return (
    <SheetFrame label="Interview map">
      <h3>Interview map</h3>
      <p className="hint">Tap any answered question to change it.</p>
      {sectionStats(s).map((x) => (
        <section className="sec" key={x.sec.id}>
          <h2>
            <span className="grow">{x.sec.name}</span>
            <span className="mono">
              {x.done}/{x.total}
            </span>
          </h2>
          <div className="list">
            {seq
              .filter((q) => q.sec === x.sec.id)
              .map((q) => {
                const done = isAnswered(s, q.id);
                const can = done || open === q;
                return (
                  <button type="button" key={q.id} className="li li-btn" disabled={!can} onClick={() => actions.edit(q.id)}>
                    <span className={done ? 'c-basil' : 'c-muted'}>
                      <Icon name={done ? 'check' : 'chat'} size={17} />
                    </span>
                    <div className="grow">
                      <div className="t small">{q.say(s.answers)}</div>
                      <div className="s">{done ? formatAnswer(q, s.answers[q.id], !!s.skipped[q.id]) : 'Not answered yet'}</div>
                    </div>
                  </button>
                );
              })}
          </div>
        </section>
      ))}
    </SheetFrame>
  );
}

function Options() {
  const { actions } = useRemy();
  return (
    <SheetFrame label="Interview options">
      <h3>Interview options</h3>
      <div className="list gap-top">
        <button type="button" className="li li-btn" onClick={() => actions.openSheet('map')}>
          <Icon name="list" />
          <div className="grow">
            <div className="t">Interview map</div>
            <div className="s">See every question and change answers</div>
          </div>
        </button>
        <button type="button" className="li li-btn" onClick={actions.fillRest}>
          <Icon name="spark" />
          <div className="grow">
            <div className="t">Fill the rest with example answers</div>
            <div className="s">For demos: uses the sample picky-eater profile</div>
          </div>
        </button>
        <button type="button" className="li li-btn" onClick={actions.saveAndExit}>
          <Icon name="bookmark" />
          <div className="grow">
            <div className="t">Save and finish later</div>
            <div className="s">Your answers are already saved</div>
          </div>
        </button>
        <button type="button" className="li li-btn c-danger" onClick={() => actions.openSheet('confirmRestart')}>
          <Icon name="trash" />
          <div className="grow">
            <div className="t">Start over</div>
          </div>
        </button>
      </div>
    </SheetFrame>
  );
}

function ConfirmRestart() {
  const { actions } = useRemy();
  return (
    <SheetFrame label="Start over">
      <h3>Start the interview over?</h3>
      <p className="sheet-text">This permanently deletes your answers from this device. It can’t be undone.</p>
      <div className="row">
        <button type="button" className="btn ghost grow" onClick={actions.closeSheet}>
          Cancel
        </button>
        <button type="button" className="btn warn grow" onClick={() => void actions.restart()}>
          Delete and start over
        </button>
      </div>
    </SheetFrame>
  );
}

export function Sheets() {
  const { ui } = useRemy();
  if (ui.sheet === 'map') return <InterviewMap />;
  if (ui.sheet === 'options') return <Options />;
  if (ui.sheet === 'confirmRestart') return <ConfirmRestart />;
  return null;
}

export function Toast() {
  const { ui } = useRemy();
  return (
    <div aria-live="polite">
      {ui.toast && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          <span>{ui.toast}</span>
        </div>
      )}
    </div>
  );
}
