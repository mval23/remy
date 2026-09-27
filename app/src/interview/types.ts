export type SectionId = 'safety' | 'goals' | 'taste' | 'picky' | 'sweets' | 'prep' | 'life';
export type Level = 'love' | 'like' | 'okay' | 'ways' | 'dislike' | 'never';
export type Ratings = Record<string, Level>;
export type Preparations = Record<string, string[]>;
export interface Budget {
  amount: number | '';
  currency: string;
}
export type AnswerValue = string | string[] | Ratings | Preparations | Budget;
export type Answers = Record<string, AnswerValue | undefined>;

export interface Option {
  v: string;
  /** Short description under the option. */
  d?: string;
  /** Emoji for tile-style options. */
  e?: string;
}

export type QuestionType = 'single' | 'multi' | 'tiles' | 'chips' | 'rate' | 'ways' | 'budget' | 'number';

export interface Question {
  id: string;
  sec: SectionId;
  type: QuestionType;
  say: (A: Answers) => string;
  /** “Why I ask” explanation. */
  why?: string;
  /** Cannot be skipped; Continue needs a valid answer. */
  required?: boolean;
  /** Shows a Skip button. */
  skip?: boolean;
  /** Allows a typed answer in addition to the options. */
  other?: boolean;
  /** Exclusive “none” option for multi-select. */
  none?: string;
  /** Lay single-choice options out as a compact row. */
  grid?: boolean;
  /** Branching: the question is asked only when this returns true. */
  when?: (A: Answers) => boolean;
  /** Label explaining which earlier answer triggered a follow-up. */
  because?: (A: Answers) => string;
  /** Remy’s short reaction after this question is answered. */
  ack?: (v: AnswerValue, A: Answers) => string | null;
  opts?: (string | Option)[];
  optsFn?: (A: Answers) => string[];
  suggest?: string[];
  foods?: string[];
  unit?: string;
  sample?: AnswerValue;
  /** Position in the full question list (set automatically). */
  i: number;
}

export interface InterviewState {
  answers: Answers;
  skipped: Record<string, true>;
  current: string | null;
  started: boolean;
  done: boolean;
  confirmed: boolean;
  updatedAt: number | null;
}

export const emptyInterview = (): InterviewState => ({
  answers: {},
  skipped: {},
  current: null,
  started: false,
  done: false,
  confirmed: false,
  updatedAt: null,
});
