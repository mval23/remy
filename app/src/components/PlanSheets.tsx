import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { FOODS } from '../interview/questions';
import { R, SIDE_IDS } from '../planning/data/recipes';
import { REJECT_REASONS } from '../planning/data/weeks';
import { estimatesOn, sideOptions } from '../planning/nutrition';
import { autoReplacement, moveBlocker, replacementOptions } from '../planning/planner';
import { check, matches, storage } from '../planning/rules';
import { DAY_FULL, SLOT_SHORT } from '../planning/types';
import { useRemy, type SheetArg } from '../store';
import { AiIdea } from './AiIdea';
import { StoragePill } from './Chrome';
import { Icon } from './Icon';

const FOCUSABLE = 'button:not(:disabled), [href], input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/** A bottom sheet: takes keyboard focus while open, keeps Tab inside, closes on Escape, and gives focus back when it closes. */
export function SheetFrame({ children, label }: { children: ReactNode; label: string }) {
  const { actions } = useRemy();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => opener?.focus?.();
  }, []);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      actions.closeSheet();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const all = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!all.length) return;
    const first = all[0];
    const last = all[all.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && actions.closeSheet()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref} onKeyDown={onKeyDown}>
        <div className="grab" />
        <button type="button" className="iconbtn sheet-close" aria-label="Close" onClick={actions.closeSheet}>
          <Icon name="x" size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}

function ReplaceSheet({ arg }: { arg: SheetArg }) {
  const { planState, ctx, actions } = useRemy();
  const [why, setWhy] = useState<string | null>(null);
  const [food, setFood] = useState<string | null>(null);
  const plan = planState.plan!;
  const { d, slot, reject } = arg;
  const day = plan[d];
  const current = day.meals[slot]?.r ? R[day.meals[slot]!.r!] : null;
  const opts = replacementOptions(plan, d, slot, ctx);
  const reason = reject ? { why, food } : undefined;
  const title = `${reject ? 'Not this one' : current ? 'Replace' : 'Choose a meal'} · ${DAY_FULL[day.d]} ${SLOT_SHORT[slot].toLowerCase()}`;
  const pick = () => {
    const id = autoReplacement(plan, d, slot, ctx);
    if (id) actions.replace(d, slot, id, reason);
    else actions.toast('No other safe match for this slot');
  };

  return (
    <SheetFrame label={title}>
      <h2 className="sheet-title">{title}</h2>
      {current && <p className="hint">Currently: {current.short}</p>}
      {reject && current && (
        <section className="sec">
          <h2>What’s wrong with it? (optional)</h2>
          <div className="chips">
            {REJECT_REASONS.map((x) => (
              <button type="button" key={x} className="chip" aria-pressed={why === x} onClick={() => { setWhy(why === x ? null : x); setFood(null); }}>
                {x}
              </button>
            ))}
          </div>
          {why === 'An ingredient I don’t like' && (
            <>
              <p className="hint gap-top">Which one? I’ll mark it Dislike, and you can change that in your profile.</p>
              <div className="chips gap-top">
                {Object.keys(current.foods).map((f) => (
                  <button type="button" key={f} className="chip" aria-pressed={food === f} onClick={() => setFood(food === f ? null : f)}>
                    {FOODS[f].e} {FOODS[f].n}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      )}
      <section className="sec">
        <AiIdea d={d} slot={slot} reason={reason} />
      </section>
      <section className="sec">
        <h2>
          <span className="grow">Suggestions</span>
          <button type="button" className="linkbtn tight" onClick={pick}>
            <Icon name="swap" size={15} /> Pick for me
          </button>
        </h2>
        <div className="list">
          {opts.allowed.map((r) => {
            const st = storage(r, d + 1);
            const fit = matches(r, ctx.A).slice(0, 3);
            return (
              <div className="li" key={r.id}>
                <span className="em-lg" aria-hidden="true">{r.e}</span>
                <div className="grow">
                  <div className="t">{r.short}</div>
                  <div className="s">{fit.length ? `Uses ${fit.join(', ')}` : 'Fits your rules'}</div>
                  <div className="gap-top"><StoragePill st={st} /></div>
                </div>
                {st.k === 'unsafe' ? (
                  <span className="hint">Not safe for day {d + 1}</span>
                ) : (
                  <button type="button" className="btn sm" onClick={() => actions.replace(d, slot, r.id, reason)}>
                    Use
                  </button>
                )}
              </div>
            );
          })}
          {opts.blocked.map((b) => (
            <div className="li blocked" key={b.r.id}>
              <span className="c-danger"><Icon name="lock" size={20} /></span>
              <div className="grow">
                <div className="t strike">{b.r.short}</div>
                <div className="s c-danger">Blocked: {b.reason}.{b.allergy ? ' Allergy rule.' : ''}</div>
              </div>
            </div>
          ))}
          {opts.allowed.length === 0 && opts.blocked.length === 0 && <div className="empty">Nothing else in the library fits this slot yet.</div>}
        </div>
        {opts.hidden.length > 0 && (
          <p className="hint gap-top">
            {opts.hidden.length} more hidden by your preferences: {opts.hidden.map((h) => `${h.r.short} (${h.reason.toLowerCase()})`).join('; ')}.
          </p>
        )}
      </section>
    </SheetFrame>
  );
}

function MoveSheet({ arg }: { arg: SheetArg }) {
  const { planState, actions } = useRemy();
  const plan = planState.plan!;
  const { d, slot } = arg;
  const r = R[plan[d].meals[slot]!.r!];
  return (
    <SheetFrame label={`Move ${r.short}`}>
      <h2 className="sheet-title">Move {r.short}</h2>
      <p className="hint">Swap it with the {SLOT_SHORT[slot].toLowerCase()} on another day.</p>
      <div className="list gap-top-lg">
        {plan.map((day, i) => {
          if (i === d) return null;
          const other = day.meals[slot];
          const why = moveBlocker(plan, d, i, slot);
          return (
            <div className="li" key={day.d}>
              <div className="grow">
                <div className="t">
                  {DAY_FULL[day.d]} <span className="hint">day {i + 1}</span>
                </div>
                <div className="s">{other?.out ? 'Eating out' : other?.skip ? 'No sweet planned' : other?.r ? `Now: ${R[other.r].short}` : 'Nothing planned'}</div>
                {why ? <div className="s c-danger">{why}</div> : <div className="gap-top"><StoragePill st={storage(r, i + 1)} /></div>}
              </div>
              {!why && (
                <button type="button" className="btn sm" onClick={() => actions.move(d, i, slot)}>
                  Swap
                </button>
              )}
            </div>
          );
        })}
      </div>
    </SheetFrame>
  );
}

function SideSheet({ arg }: { arg: SheetArg }) {
  const { planState, ctx, actions } = useRemy();
  const plan = planState.plan!;
  const { d, slot } = arg;
  const m = plan[d].meals[slot]!;
  const r = R[m.r!];
  const nums = estimatesOn(planState.nutrition, ctx.A);
  const hidden = SIDE_IDS.map((id) => R[id]).filter((s) => s.for?.includes(slot) && !check(s, ctx.A).ok);
  const groups = (['protein', 'produce'] as const).map((kind) => ({ kind, list: sideOptions(ctx, d, slot, kind).filter((s) => s.id !== m.side) }));
  const title = `Add a side · ${DAY_FULL[plan[d].d]} ${SLOT_SHORT[slot].toLowerCase()}`;
  return (
    <SheetFrame label={title}>
      <h2 className="sheet-title">{title}</h2>
      <p className="hint">With {r.short}. Only foods you accept, checked against your safety rules and storage days.</p>
      {m.side && (
        <div className="sideline gap-top-lg">
          <span aria-hidden="true">{R[m.side].e}</span>
          <span className="grow">Current side: {R[m.side].short}</span>
          <button type="button" className="btn sm ghost" onClick={() => actions.setSide(d, slot, null)}>
            Remove
          </button>
        </div>
      )}
      {groups.map(({ kind, list }) =>
        list.length ? (
          <section className="sec" key={kind}>
            <h2>{kind === 'protein' ? 'More protein' : 'Fruit and vegetables'}</h2>
            <div className="list">
              {list.map((s) => {
                const fit = matches(s, ctx.A);
                const gain = kind === 'protein' ? (nums ? `+${s.pro} g protein, about ${s.kcal} kcal` : 'Adds protein') : `+1 serving of fruit or veg${nums ? `, about ${s.kcal} kcal` : ''}`;
                return (
                  <div className="li" key={s.id}>
                    <span className="em-lg" aria-hidden="true">{s.e}</span>
                    <div className="grow">
                      <div className="t">{s.short}</div>
                      <div className="s">{s.why[0] ?? (fit.length ? `You rated ${fit[0]}` : 'Fits your rules')} · {gain}</div>
                      <div className="gap-top"><StoragePill st={storage(s, d + 1)} /></div>
                    </div>
                    <button type="button" className="btn sm" onClick={() => actions.setSide(d, slot, s.id)}>
                      Add
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null,
      )}
      {groups.every((g) => !g.list.length) && <div className="empty">No side fits this meal and day with your current foods and rules.</div>}
      {hidden.length > 0 && (
        <p className="hint gap-top">
          {hidden.length} more hidden: {hidden.map((s) => { const c = check(s, ctx.A); return `${s.short} (${c.ok ? '' : c.reason.toLowerCase()})`; }).join('; ')}.
        </p>
      )}
    </SheetFrame>
  );
}

export function PlanSheets() {
  const { ui, planState } = useRemy();
  if (!ui.sheetArg || !planState.plan) return null;
  const m = planState.plan[ui.sheetArg.d]?.meals[ui.sheetArg.slot];
  if (ui.sheet === 'replace') return <ReplaceSheet arg={ui.sheetArg} />;
  if (ui.sheet === 'move' && m?.r) return <MoveSheet arg={ui.sheetArg} />;
  if (ui.sheet === 'side' && m?.r) return <SideSheet arg={ui.sheetArg} />;
  return null;
}
