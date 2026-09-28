import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnswerControls } from '../components/AnswerControls';
import { Avatar, Icon } from '../components/Icon';
import { currentQuestion, formatAnswer, initialDraft, isValid, prevBefore, progress, sectionStats, sequence } from '../interview/engine';
import { SECTIONS } from '../interview/questions';
import type { AnswerValue } from '../interview/types';
import { useRemy } from '../store';

const REDUCED_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Interview() {
  const { interview: s, ui, actions } = useRemy();
  const q = currentQuestion(s);
  const bodyRef = useRef<HTMLDivElement>(null);
  const curRef = useRef<HTMLDivElement>(null);
  const [typing, setTyping] = useState(false);

  // A short “Remy is typing” pause after each answer.
  useEffect(() => {
    if (!q || !ui.lastAnswered || REDUCED_MOTION) return;
    setTyping(true);
    const t = window.setTimeout(() => setTyping(false), 380);
    return () => window.clearTimeout(t);
  }, [q?.id, ui.lastAnswered]);

  // Keep the current question in view.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const cur = curRef.current;
    if (body) body.scrollTop = cur ? Math.max(0, cur.offsetTop - body.offsetTop - 70) : body.scrollHeight;
  }, [q?.id, typing]);

  // Nothing left to ask.
  useEffect(() => {
    if (!q) actions.go('summary');
  }, [q]);
  if (!q) return null;

  const A = s.answers;
  const seq = sequence(A);
  const pc = progress(s);
  const stats = sectionStats(s);
  const secIndex = SECTIONS.findIndex((x) => x.id === q.sec);
  const sec = SECTIONS[secIndex];
  const pos = seq.indexOf(q) + 1;
  const minutesLeft = Math.max(1, Math.round((pc.total - pc.done) * 0.2));
  const inSection = seq.filter((x) => x.sec === q.sec);
  const isFirstInSection = inSection[0] === q;

  const draft: AnswerValue = ui.drafts[q.id] ?? initialDraft(q, s);
  const setDraft = (v: AnswerValue) => actions.setDraft(q.id, v);
  const ok = isValid(q, draft);
  const pick = (v: string) => {
    setDraft(v);
    window.setTimeout(() => actions.submit(q, v), REDUCED_MOTION ? 0 : 200);
  };
  const next = () => {
    if (!isValid(q, draft)) return;
    if (q.type === 'number' && !draft) return actions.skip(q);
    actions.submit(q, draft);
  };

  // Remy reacts to the answer just given, and introduces each new section.
  const prev = prevBefore(A, q);
  let ack = '';
  if (prev && ui.lastAnswered === prev.id && prev.ack && A[prev.id] !== undefined) {
    try {
      ack = prev.ack(A[prev.id] as AnswerValue, A) ?? '';
    } catch {
      ack = '';
    }
  }
  if (isFirstInSection) ack = (ack ? ack + ' ' : '') + sec.intro;
  let because = '';
  try {
    because = q.because ? q.because(A) : '';
  } catch {
    because = '';
  }

  return (
    <>
      <header className="head">
        <button type="button" className="iconbtn" aria-label="Previous question" onClick={() => actions.back(q)}>
          <Icon name="left" size={22} />
        </button>
        <div className="ttl">
          <h1>{sec.name}</h1>
          <p>
            {pos} of ~{seq.length} · about {minutesLeft} min left
          </p>
        </div>
        <button type="button" className="iconbtn" aria-label="Interview options" onClick={() => actions.openSheet('options')}>
          <Icon name="more" size={22} />
        </button>
        <button type="button" className="btn sm ghost" onClick={actions.saveAndExit}>
          <Icon name="bookmark" size={16} /> Save
        </button>
      </header>

      <button
        type="button"
        className="prog"
        aria-label={`Interview progress: ${pc.done} of ${pc.total} answered. Open the interview map.`}
        onClick={() => actions.openSheet('map')}
      >
        {stats.map((x, i) => (
          <span key={x.sec.id} className={i === secIndex ? 'cur' : ''} title={x.sec.name}>
            <i style={{ width: `${x.total ? Math.round((100 * x.done) / x.total) : 0}%` }} />
          </span>
        ))}
      </button>
      {ui.editReturn ? (
        <section className="editbar" aria-label="Editing an answer">
          <Icon name="edit" size={16} />
          <span className="grow">Editing one answer. Changes save automatically.</span>
          <button type="button" className="linkbtn tight" onClick={actions.cancelEdit}>
            Cancel
          </button>
        </section>
      ) : (
        s.done && (
          <section className="editbar" aria-label="Reviewing answers">
            <Icon name="check" size={16} />
            <span className="grow">Interview complete. You’re reviewing answers.</span>
            <button type="button" className="linkbtn tight" onClick={() => actions.go('summary')}>
              Profile
            </button>
          </section>
        )
      )}

      <main className="body" ref={bodyRef}>
        <div className="thread">
          {stats.slice(0, secIndex).map((x) =>
            x.total ? (
              <div className="divider" key={x.sec.id}>
                {x.sec.name} · {x.done} of {x.total} answered
              </div>
            ) : null,
          )}
          {!isFirstInSection && (
            <div className="msg">
              <Avatar />
              <div className="bubble past">{sec.intro}</div>
            </div>
          )}
          {inSection
            .filter((x) => x.i < q.i)
            .map((x) => (
              <div className="exchange" key={x.id}>
                <div className="msg">
                  <Avatar />
                  <div className="bubble past">{x.say(A)}</div>
                </div>
                <button
                  type="button"
                  className={`me${s.skipped[x.id] ? ' skipped' : ''}`}
                  aria-label={`Change your answer to: ${x.say(A)}`}
                  onClick={() => actions.goToQuestion(x.id)}
                >
                  <span>{formatAnswer(x, A[x.id], !!s.skipped[x.id])}</span>
                  <span className="chg">Change</span>
                </button>
              </div>
            ))}
          {because && (
            <span className="because enter">
              <Icon name="spark" size={14} />
              {because}
            </span>
          )}
          {typing ? (
            <div className="msg">
              <Avatar />
              <div className="bubble">
                <span className="typing" aria-label="Remy is typing">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="msg enter" ref={curRef}>
                <Avatar />
                <div className="bubble q" aria-live="polite">
                  {ack && <span className="ack">{ack}</span>}
                  {q.say(A)}
                </div>
              </div>
              {q.why && (
                <details className="why enter">
                  <summary>
                    <Icon name="info" size={15} /> Why I ask
                  </summary>
                  <p>{q.why}</p>
                </details>
              )}
              <div className="answer enter">
                <AnswerControls q={q} answers={A} draft={draft} setDraft={setDraft} pick={pick} submit={next} />
              </div>
              {q.sample !== undefined && q.sample !== '' && (
                <button
                  type="button"
                  className="linkbtn self-start"
                  onClick={() => (q.type === 'single' ? pick(q.sample as string) : setDraft(q.sample as AnswerValue))}
                >
                  <Icon name="spark" size={16} /> Use example answer
                </button>
              )}
            </>
          )}
        </div>
      </main>

      {!typing && (
        <footer className="foot">
          {q.skip ? (
            <button type="button" className="btn ghost" onClick={() => actions.skip(q)}>
              <Icon name="skip" size={16} /> Skip
            </button>
          ) : (
            q.sec === 'safety' && (
              <span className="hint row">
                <Icon name="lock" size={15} /> Needed for safety
              </span>
            )
          )}
          <span className="grow" />
          {(q.type !== 'single' || A[q.id] !== undefined) && (
            <button type="button" className="btn" disabled={!ok} onClick={next}>
              Continue <Icon name="right" size={18} />
            </button>
          )}
        </footer>
      )}
    </>
  );
}
