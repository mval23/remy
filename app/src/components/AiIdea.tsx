import { useState } from 'react';
import { AiError, aiMessage, askForJson } from '../ai/client';
import { AI_PREFIX, MAX_REQUEST_CHARS, recipePrompt, recipeSchema, safeOnDay, SYSTEM_PROMPT, toRecipe } from '../ai/recipe';
import { ING } from '../planning/data/ingredients';
import { quantityText } from '../planning/grocery';
import { estimatesOn } from '../planning/nutrition';
import { storage } from '../planning/rules';
import { duration } from '../planning/schedule';
import type { Recipe, Slot } from '../planning/types';
import { useRemy, type RejectReason } from '../store';
import { StoragePill } from './Chrome';
import { Icon } from './Icon';

type State = { k: 'idle' } | { k: 'thinking' } | { k: 'idea'; r: Recipe } | { k: 'problem'; msg: string };

/** What the AI sends where, shown once before it's turned on. */
export function AiConsent() {
  const { actions } = useRemy();
  return (
    <div className="panel stack">
      <p className="ink-2">
        Remy can ask an AI for new recipe ideas built from your foods. It uses <b>Google Gemini’s free service</b>, so it costs nothing, but Google may use what’s sent to
        improve its products.
      </p>
      <p className="hint">
        Remy sends only your food ratings, preparations, tastes, equipment and allergy rules, plus what you type. Never your name, email, weight or health answers. Every idea is
        checked against your safety rules before you see it.
      </p>
      <button type="button" className="btn soft wide" onClick={() => actions.setAiConsent(true)}>
        <Icon name="spark" size={17} /> Turn on AI ideas
      </button>
    </div>
  );
}

/** Ask the AI for a new recipe for one slot, check it, and let the user keep it. */
export function AiIdea({ d, slot, reason }: { d: number; slot: Slot; reason?: RejectReason }) {
  const { planState, ctx, actions, sync } = useRemy();
  const [request, setRequest] = useState('');
  const [state, setState] = useState<State>({ k: 'idle' });

  if (!sync.configured) return null;
  if (!sync.signedIn)
    return (
      <p className="hint">
        <Icon name="spark" size={14} /> Want brand-new ideas from Remy’s AI? It’s free:{' '}
        <button type="button" className="linkbtn inline" onClick={() => actions.go('account')}>
          sign in
        </button>{' '}
        first.
      </p>
    );
  if (!planState.aiConsent) return <AiConsent />;

  const ask = async () => {
    setState({ k: 'thinking' });
    let last = 'Remy’s AI couldn’t come up with an idea that fits your rules. Try again, or ask for something different.';
    // One retry: a small model sometimes misses a rule, and the check throws that idea out.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await askForJson(SYSTEM_PROMPT, recipePrompt(ctx.A, slot, request), recipeSchema());
        const res = toRecipe(raw, ctx.A, slot, `${AI_PREFIX}${Date.now().toString(36)}`);
        if (res.ok) return setState({ k: 'idea', r: res.recipe });
        last = res.reason;
      } catch (e) {
        return setState({ k: 'problem', msg: e instanceof AiError ? e.message : aiMessage('failed') });
      }
    }
    setState({ k: 'problem', msg: last });
  };

  const r = state.k === 'idea' ? state.r : null;
  const handsOn = r ? r.tasks.filter((t) => t.l === 'hands').reduce((s, t) => s + t.m, 0) : 0;
  const total = r ? r.tasks.filter((t) => t.l !== 'chill').reduce((s, t) => s + t.m, 0) : 0;
  const safe = r ? safeOnDay(r, d + 1) : true;

  return (
    <div className="panel stack ai-panel">
      <label className="strong" htmlFor="ai-request">
        <Icon name="spark" size={16} /> Ask Remy for a new idea
      </label>
      <div className="row">
        <input
          id="ai-request"
          className="field grow"
          placeholder="Optional: “something crispy with chicken”"
          maxLength={MAX_REQUEST_CHARS}
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && state.k !== 'thinking' && void ask()}
        />
        <button type="button" className="btn sm" disabled={state.k === 'thinking'} onClick={() => void ask()}>
          {state.k === 'thinking' ? 'Thinking…' : r ? 'Another' : 'Ask'}
        </button>
      </div>
      {state.k === 'thinking' && <p className="hint" role="status">Remy is thinking. This usually takes 5–20 seconds.</p>}
      {state.k === 'problem' && (
        <div className="badline">
          <Icon name="info" size={16} />
          <span>{state.msg}</span>
        </div>
      )}
      {r && (
        <div className="ai-idea stack">
          <div className="row align-start">
            <span className="em-lg" aria-hidden="true">{r.e}</span>
            <div className="grow">
              <div className="strong">{r.name}</div>
              <div className="hint">
                {r.serves} portions · {duration(total)} on prep day ({duration(handsOn)} hands-on)
                {estimatesOn(planState.nutrition, ctx.A) && ` · ≈${r.kcal} kcal, ${r.pro} g protein`}
              </div>
              <div className="gap-top">
                <StoragePill st={storage(r, d + 1)} />
              </div>
            </div>
          </div>
          {r.why.length > 0 && (
            <ul className="rules">
              {r.why.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <details>
            <summary className="linkbtn">Ingredients and steps</summary>
            <ul className="rules gap-top">
              {r.ing.map(([k, q]) => (
                <li key={k}>
                  {quantityText(q, ING[k].u)} {ING[k].n.toLowerCase()}
                </li>
              ))}
            </ul>
            <ol className="rules gap-top">
              {r.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className="hint gap-top">{r.reheat}</p>
          </details>
          {safe ? (
            <button type="button" className="btn wide" onClick={() => actions.replace(d, slot, r.id, reason, r)}>
              <Icon name="check" size={17} /> Use this
            </button>
          ) : (
            <div className="warnline">
              <Icon name="info" size={16} />
              <span>
                This keeps {r.fridge} day{r.fridge > 1 ? 's' : ''} in the fridge and doesn’t freeze, so it isn’t safe for day {d + 1}. Try an earlier day, or ask again.
              </span>
            </div>
          )}
          <p className="hint">AI ideas are new and untested: amounts and nutrition are rough. Your safety rules were checked.</p>
        </div>
      )}
    </div>
  );
}
