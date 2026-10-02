import { activeAnswers, firstOpen, formatAnswer, isAnswered, sectionStats, sequence } from '../interview/engine';
import { allRatings, listText } from '../interview/helpers';
import { FOODS, LEVELS } from '../interview/questions';
import { useRemy } from '../store';
import { EstimateSheet } from './EstimateSheet';
import { Icon } from './Icon';
import { PlanSheets, SheetFrame } from './PlanSheets';

function InterviewMap() {
  const { interview: s, actions } = useRemy();
  const seq = sequence(s.answers);
  const open = firstOpen(s);
  return (
    <SheetFrame label="Interview map">
      <h2 className="sheet-title">Interview map</h2>
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
      <h2 className="sheet-title">Interview options</h2>
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

/** Start over (from the interview) or delete everything (from Preferences): the same action. */
function ConfirmRestart() {
  const { ui, actions, sync } = useRemy();
  const fromPrefs = ui.screen === 'prefs';
  const where = sync.signedIn ? 'this device and your cloud copy' : 'this device';
  return (
    <SheetFrame label={fromPrefs ? 'Delete everything' : 'Start over'}>
      <h2 className="sheet-title">{fromPrefs ? 'Delete everything?' : 'Start the interview over?'}</h2>
      <p className="sheet-text">
        This permanently deletes your answers, meal plan, grocery list, check-ins and everything Remy learned from {where}. It can’t be undone. Backup files you downloaded aren’t
        affected.
      </p>
      <div className="row">
        <button type="button" className="btn ghost grow" onClick={actions.closeSheet}>
          Cancel
        </button>
        <button type="button" className="btn warn grow" onClick={() => void actions.restart()}>
          {fromPrefs ? 'Delete everything' : 'Delete and start over'}
        </button>
      </div>
    </SheetFrame>
  );
}

function ConfirmForget() {
  const { actions } = useRemy();
  return (
    <SheetFrame label="Delete learned preferences">
      <h2 className="sheet-title">Delete learned preferences?</h2>
      <p className="sheet-text">
        This removes everything Remy inferred or learned from check-ins and skipped meals, and undoes what it changed. Your interview answers, your week and your check-in history stay.
      </p>
      <div className="row">
        <button type="button" className="btn ghost grow" onClick={actions.closeSheet}>
          Cancel
        </button>
        <button type="button" className="btn warn grow" onClick={actions.forgetAll}>
          Delete learned
        </button>
      </div>
    </SheetFrame>
  );
}

function ConfirmImport() {
  const { ui, interview, actions } = useRemy();
  const b = ui.pendingImport;
  if (!b) return null;
  const when = b.exportedAt ? new Date(b.exportedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'an unknown date';
  const parts = [b.interview.started && 'your answers', b.plan.plan && 'a meal plan', b.plan.learned.length > 0 && 'what Remy learned'].filter((x): x is string => !!x);
  return (
    <SheetFrame label="Restore a backup">
      <h2 className="sheet-title">Restore this backup?</h2>
      <p className="sheet-text">
        Backup from {when}
        {parts.length ? `, with ${listText(parts)}` : ''}.
        {interview.started && ' It replaces what’s on this device now. If you’re signed in, your other devices get it too.'}
      </p>
      <div className="row">
        <button type="button" className="btn ghost grow" onClick={actions.closeSheet}>
          Cancel
        </button>
        <button type="button" className="btn grow" onClick={actions.confirmImport}>
          Restore
        </button>
      </div>
    </SheetFrame>
  );
}

/** Move one food to a different level. */
function FoodLevel() {
  const { ui, interview, actions } = useRemy();
  const f = ui.sheetFood;
  if (!f || !FOODS[f]) return null;
  const current = allRatings(activeAnswers(interview))[f];
  return (
    <SheetFrame label={`Change ${FOODS[f].n}`}>
      <h2 className="sheet-title">
        <span aria-hidden="true">{FOODS[f].e}</span> {FOODS[f].n}
      </h2>
      <p className="sheet-text">Remy updates the meals you haven’t approved yet. “Some ways” keeps the preparations you picked in the interview.</p>
      <div className="levels" role="group" aria-label={FOODS[f].n}>
        {LEVELS.map((l) => (
          <button key={l.id} type="button" className={`l-${l.id}`} aria-pressed={current === l.id} onClick={() => actions.setFoodLevel(f, l.id, l.name)}>
            {l.label}
          </button>
        ))}
      </div>
    </SheetFrame>
  );
}

export function Sheets() {
  const { ui } = useRemy();
  if (ui.sheet === 'map') return <InterviewMap />;
  if (ui.sheet === 'options') return <Options />;
  if (ui.sheet === 'confirmRestart') return <ConfirmRestart />;
  if (ui.sheet === 'confirmForget') return <ConfirmForget />;
  if (ui.sheet === 'confirmImport') return <ConfirmImport />;
  if (ui.sheet === 'food') return <FoodLevel />;
  if (ui.sheet === 'estimate') return <EstimateSheet />;
  return <PlanSheets />;
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
