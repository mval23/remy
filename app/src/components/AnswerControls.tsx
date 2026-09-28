import { useState } from 'react';
import { optionsOf } from '../interview/engine';
import { arr, asBudget, asPreparations, asRatings, has, ratedAs, str, toggleOption } from '../interview/helpers';
import { CURRENCIES, FOODS, LEVELS, WAYS } from '../interview/questions';
import type { AnswerValue, Answers, Level, Question } from '../interview/types';
import { Icon } from './Icon';

interface Props {
  q: Question;
  answers: Answers;
  draft: AnswerValue;
  setDraft: (v: AnswerValue) => void;
  /** Single-choice answers submit immediately. */
  pick: (v: string) => void;
  /** Enter in a number field submits. */
  submit: () => void;
}

export function AnswerControls({ q, answers, draft, setDraft, pick, submit }: Props) {
  switch (q.type) {
    case 'single':
      return <Single {...{ q, answers, draft, pick }} />;
    case 'multi':
    case 'tiles':
      return <Multi {...{ q, answers, draft, setDraft }} />;
    case 'chips':
      return <Chips {...{ q, draft, setDraft }} />;
    case 'rate':
      return <Rate {...{ q, answers, draft, setDraft }} />;
    case 'ways':
      return <Ways {...{ answers, draft, setDraft }} />;
    case 'budget':
      return <BudgetInput {...{ draft, setDraft, submit }} />;
    case 'number':
      return <NumberInput {...{ q, draft, setDraft, submit }} />;
  }
}

function TextAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (t: string) => void }) {
  const [text, setText] = useState('');
  const add = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText('');
  };
  return (
    <div className="row">
      <input
        className="field grow"
        placeholder={placeholder}
        aria-label={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        }}
      />
      <button type="button" className="btn sm soft" onClick={add}>
        Add
      </button>
    </div>
  );
}

function Single({ q, answers, draft, pick }: Pick<Props, 'q' | 'answers' | 'draft' | 'pick'>) {
  const opts = optionsOf(q, answers);
  const v = str(draft);
  return (
    <>
      {q.grid ? (
        <div className="chips">
          {opts.map((o) => (
            <button key={o.v} type="button" className="chip grid-chip" aria-pressed={v === o.v} onClick={() => pick(o.v)}>
              {o.v}
            </button>
          ))}
        </div>
      ) : (
        <div className="opts" role="radiogroup" aria-label={q.say(answers)}>
          {opts.map((o) => (
            <button key={o.v} type="button" className="opt" role="radio" aria-checked={v === o.v} onClick={() => pick(o.v)}>
              <span className="dot">{v === o.v && <Icon name="check" size={12} />}</span>
              <span>
                {o.v}
                {o.d && <small>{o.d}</small>}
              </span>
            </button>
          ))}
        </div>
      )}
      {q.other && <TextAdd placeholder="Or tell me in your own words" onAdd={pick} />}
    </>
  );
}

function Multi({ q, answers, draft, setDraft }: Pick<Props, 'q' | 'answers' | 'draft' | 'setDraft'>) {
  const opts = optionsOf(q, answers);
  const list = arr(draft);
  const extra = list.filter((x) => !opts.some((o) => o.v === x));
  const toggle = (v: string) => setDraft(toggleOption(list, v, q.none));
  return (
    <>
      {q.type === 'tiles' ? (
        <div className="tiles">
          {opts.map((o) => (
            <button key={o.v} type="button" className="tile" aria-pressed={list.includes(o.v)} onClick={() => toggle(o.v)}>
              <span className="em" aria-hidden="true">{o.e}</span>
              {o.v}
            </button>
          ))}
        </div>
      ) : (
        <div className="chips">
          {opts.map((o) => (
            <button key={o.v} type="button" className="chip" aria-pressed={list.includes(o.v)} onClick={() => toggle(o.v)}>
              {list.includes(o.v) && <Icon name="check" size={14} />}
              {o.v}
            </button>
          ))}
        </div>
      )}
      {extra.length > 0 && (
        <div className="chips">
          {extra.map((x) => (
            <button key={x} type="button" className="chip" aria-pressed="true" aria-label={`Remove ${x}`} onClick={() => toggle(x)}>
              {x}
              <Icon name="x" size={14} />
            </button>
          ))}
        </div>
      )}
      <p className="hint">Choose all that apply.</p>
      {q.other && <TextAdd placeholder="Something else? Type it here" onAdd={(t) => !list.includes(t) && toggle(t)} />}
    </>
  );
}

function Chips({ q, draft, setDraft }: Pick<Props, 'q' | 'draft' | 'setDraft'>) {
  const list = arr(draft);
  const suggestions = (q.suggest ?? []).filter((x) => !list.includes(x));
  const toggle = (v: string) => setDraft(toggleOption(list, v));
  return (
    <>
      {list.length > 0 && (
        <div className="chips">
          {list.map((x) => (
            <button key={x} type="button" className="chip" aria-pressed="true" aria-label={`Remove ${x}`} onClick={() => toggle(x)}>
              {x}
              <Icon name="x" size={14} />
            </button>
          ))}
        </div>
      )}
      <TextAdd placeholder={q.placeholder ?? (q.id === 'favorites' ? 'Type a meal, then Add' : 'Type a food, then Add')} onAdd={(t) => !list.includes(t) && toggle(t)} />
      {suggestions.length > 0 && (
        <>
          <p className="hint">Quick picks</p>
          <div className="chips">
            {suggestions.map((x) => (
              <button key={x} type="button" className="chip" aria-pressed="false" onClick={() => toggle(x)}>
                <Icon name="plus" size={14} />
                {x}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Rate({ q, answers, draft, setDraft }: Pick<Props, 'q' | 'answers' | 'draft' | 'setDraft'>) {
  const r = asRatings(draft);
  const never = arr(answers.never).map((x) => x.toLowerCase());
  const set = (food: string, lv: Level) => {
    const next = { ...r };
    if (next[food] === lv) delete next[food];
    else next[food] = lv;
    setDraft(next);
  };
  const foods = q.foods ?? [];
  return (
    <>
      <div className="panel rate-panel">
        {foods.map((f) => (
          <div className="rate-row" key={f}>
            <div className="fn">
              <span className="em" aria-hidden="true">{FOODS[f].e}</span>
              {FOODS[f].n}
              {never.includes(FOODS[f].n.toLowerCase()) && r[f] === 'never' && <span className="hint"> · from your never list</span>}
            </div>
            <div className="levels" role="group" aria-label={FOODS[f].n}>
              {LEVELS.map((l) => (
                <button key={l.id} type="button" className={`l-${l.id}`} aria-pressed={r[f] === l.id} onClick={() => set(f, l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="hint">
        Rated {Object.keys(r).length} of {foods.length}. Leave any you’ve never tried.
      </p>
    </>
  );
}

function Ways({ answers, draft, setDraft }: Pick<Props, 'answers' | 'draft' | 'setDraft'>) {
  const p = asPreparations(draft);
  const toggle = (food: string, way: string) => setDraft({ ...p, [food]: toggleOption(p[food] ?? [], way) });
  return (
    <>
      {ratedAs(answers, 'ways').map((f) => (
        <div className="panel" key={f}>
          <div className="row fn-title">
            <span aria-hidden="true">{FOODS[f].e}</span>
            {FOODS[f].n}
          </div>
          <div className="chips">
            {WAYS.map((w) => (
              <button key={w} type="button" className="chip" aria-pressed={has(p[f], w)} onClick={() => toggle(f, w)}>
                {has(p[f], w) && <Icon name="check" size={14} />}
                {w}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function BudgetInput({ draft, setDraft, submit }: Pick<Props, 'draft' | 'setDraft' | 'submit'>) {
  const b = asBudget(draft) ?? { amount: '', currency: 'USD' };
  return (
    <>
      <div className="row">
        <input
          className="field grow"
          type="number"
          inputMode="decimal"
          min={0}
          placeholder="Amount"
          aria-label="Weekly budget amount"
          value={b.amount}
          onChange={(e) => setDraft({ ...b, amount: e.target.value === '' ? '' : Number(e.target.value) })}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <select className="field currency" aria-label="Currency" value={b.currency} onChange={(e) => setDraft({ ...b, currency: e.target.value })}>
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <p className="hint">Per week, for groceries only.</p>
    </>
  );
}

function NumberInput({ q, draft, setDraft, submit }: Pick<Props, 'q' | 'draft' | 'setDraft' | 'submit'>) {
  return (
    <>
      <div className="row">
        <input
          className="field grow"
          type="number"
          inputMode="numeric"
          placeholder="e.g. 1800"
          aria-label="Calorie estimate"
          value={str(draft)}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <span className="hint">{q.unit}</span>
      </div>
      <p className="hint">This stays optional and is always shown as an estimate.</p>
    </>
  );
}
