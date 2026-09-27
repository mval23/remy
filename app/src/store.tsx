import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  answerQuestion,
  fillWithSamples,
  firstOpen,
  prevBefore,
  skipQuestion,
} from './interview/engine';
import { Q, QBY } from './interview/questions';
import { emptyInterview, type AnswerValue, type InterviewState, type Question } from './interview/types';
import { deleteEverything, loadInterview, saveInterview } from './storage/db';

export type Screen = 'welcome' | 'interview' | 'resume' | 'summary';
export type Sheet = null | 'map' | 'options' | 'confirmRestart';

export interface UiState {
  screen: Screen;
  /** Where to return after editing a single answer. */
  editReturn: Screen | null;
  /** The question just answered, so Remy can react to it. */
  lastAnswered: string | null;
  drafts: Record<string, AnswerValue>;
  sheet: Sheet;
  toast: string | null;
}

const initialUi = (): UiState => ({ screen: 'welcome', editReturn: null, lastAnswered: null, drafts: {}, sheet: null, toast: null });

function useRemyState(initial: InterviewState) {
  const [interview, setInterview] = useState<InterviewState>(initial);
  const [ui, setUi] = useState<UiState>(initialUi);
  const toastTimer = useRef<number | undefined>(undefined);
  const first = useRef(true);

  // Save after every change (skip the initial load).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void saveInterview(interview);
  }, [interview]);

  const patchUi = (p: Partial<UiState>) => setUi((u) => ({ ...u, ...p }));
  const toast = (msg: string) => {
    patchUi({ toast: msg });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => patchUi({ toast: null }), 2800);
  };
  const dropDraft = (id: string) =>
    setUi((u) => {
      const drafts = { ...u.drafts };
      delete drafts[id];
      return { ...u, drafts };
    });

  const actions = {
    go: (screen: Screen) => patchUi({ screen, sheet: null }),
    openSheet: (sheet: Sheet) => patchUi({ sheet }),
    closeSheet: () => patchUi({ sheet: null }),
    toast,
    setDraft: (id: string, v: AnswerValue) => setUi((u) => ({ ...u, drafts: { ...u.drafts, [id]: v } })),

    start: () => {
      setInterview((s) => ({ ...s, started: true, current: s.current ?? firstOpen(s)?.id ?? Q[0].id }));
      patchUi({ screen: 'interview', lastAnswered: null, sheet: null });
    },
    submit: (q: Question, v: AnswerValue) => {
      const { state, next } = answerQuestion(interview, q, v, !!ui.editReturn);
      setInterview(state);
      dropDraft(q.id);
      if (next.kind === 'finished') {
        patchUi({ screen: 'summary', lastAnswered: q.id });
      } else if (next.kind === 'returnFromEdit') {
        patchUi({ screen: ui.editReturn ?? 'summary', editReturn: null, lastAnswered: null });
        toast('Answer updated');
      } else {
        patchUi({ lastAnswered: q.id });
      }
    },
    skip: (q: Question) => {
      const { state, next } = skipQuestion(interview, q, !!ui.editReturn);
      setInterview(state);
      dropDraft(q.id);
      if (next.kind === 'finished') patchUi({ screen: 'summary', lastAnswered: q.id });
      else if (next.kind === 'returnFromEdit') {
        patchUi({ screen: ui.editReturn ?? 'summary', editReturn: null, lastAnswered: null });
        toast('Answer updated');
      } else patchUi({ lastAnswered: q.id });
    },
    back: (q: Question) => {
      const prev = prevBefore(interview.answers, q);
      if (!prev) return patchUi({ screen: 'welcome' });
      setInterview((s) => ({ ...s, current: prev.id }));
      patchUi({ lastAnswered: null });
    },
    goToQuestion: (id: string) => {
      setInterview((s) => ({ ...s, current: id }));
      patchUi({ screen: 'interview', lastAnswered: null, sheet: null });
    },
    /** Jump into the interview to change one answer, then come back. */
    edit: (id: string) => {
      if (!QBY[id]) return;
      const from = ui.screen === 'interview' ? null : ui.screen;
      setInterview((s) => ({ ...s, current: id }));
      dropDraft(id);
      patchUi({ screen: 'interview', editReturn: from && interview.done ? from : null, lastAnswered: null, sheet: null });
    },
    cancelEdit: () => {
      setInterview((s) => ({ ...s, current: null }));
      patchUi({ screen: ui.editReturn ?? 'summary', editReturn: null });
    },
    saveAndExit: () => {
      void saveInterview(interview);
      patchUi({ screen: 'resume', sheet: null });
      toast('Progress saved');
    },
    useSample: () => {
      setInterview({ ...fillWithSamples(emptyInterview()), confirmed: false });
      patchUi({ screen: 'summary', drafts: {}, editReturn: null, sheet: null });
      toast('Sample profile loaded');
    },
    loadHalfSample: () => {
      setInterview(fillWithSamples(emptyInterview(), 'picky'));
      patchUi({ drafts: {}, sheet: null });
      toast('Loaded a half-finished interview');
    },
    fillRest: () => {
      setInterview((s) => fillWithSamples(s));
      patchUi({ screen: 'summary', sheet: null, editReturn: null });
      toast('Filled the rest with example answers');
    },
    confirm: () => {
      setInterview((s) => ({ ...s, confirmed: true, updatedAt: Date.now() }));
      toast('Profile confirmed and saved on this device');
    },
    restart: async () => {
      await deleteEverything();
      setInterview(emptyInterview());
      setUi({ ...initialUi(), toast: 'Interview cleared' });
    },
  };

  return { interview, ui, actions };
}

type Remy = ReturnType<typeof useRemyState>;
const Ctx = createContext<Remy | null>(null);

function Provider({ initial, children }: { initial: InterviewState; children: ReactNode }) {
  const value = useRemyState(initial);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Loads saved progress from the device, then renders the app. */
export function RemyProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [initial, setInitial] = useState<InterviewState | null>(null);
  useEffect(() => {
    void loadInterview().then(setInitial);
  }, []);
  if (!initial) return <>{fallback}</>;
  return <Provider initial={initial}>{children}</Provider>;
}

export function useRemy(): Remy {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRemy must be used inside RemyProvider');
  return v;
}
