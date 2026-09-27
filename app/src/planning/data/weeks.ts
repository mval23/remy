import type { Variety } from '../types';

/**
 * Three hand-tuned week templates, one row per day after prep day,
 * columns in SLOTS order: breakfast, lunch, snack, dinner, sweet.
 * The rules engine swaps out anything the profile rules out.
 */
export const WEEKS: Record<Variety, { label: string; days: string[][] }> = {
  favorites: {
    label: 'Repeat favorites',
    days: [
      ['oats', 'teriyaki', 'snackbox', 'spaghetti', 'brownies'],
      ['oats', 'teriyaki', 'snackbox', 'spaghetti', 'brownies'],
      ['oats', 'teriyaki', 'snackbox', 'tenders', 'brownies'],
      ['oats', 'burritos', 'snackbox', 'spaghetti', 'brownies'],
      ['pancakes', 'burritos', 'snackbox', 'spaghetti', 'brownies'],
      ['pancakes', 'burritos', 'popcorn', 'tenders', 'brownies'],
      ['pancakes', 'burritos', 'popcorn', 'spaghetti', 'brownies'],
    ],
  },
  balanced: {
    label: 'Balanced',
    days: [
      ['oats', 'teriyaki', 'snackbox', 'spaghetti', 'brownies'],
      ['oats', 'teriyaki', 'snackbox', 'spaghetti', 'bark'],
      ['oats', 'teriyaki', 'snackbox', 'tenders', 'brownies'],
      ['pancakes', 'burritos', 'snackbox', 'tenders', 'bark'],
      ['pancakes', 'burritos', 'snackbox', 'spaghetti', 'brownies'],
      ['pancakes', 'burritos', 'popcorn', 'spaghetti', 'icecream'],
      ['pancakes', 'burritos', 'popcorn', 'quesadilla', 'brownies'],
    ],
  },
  variety: {
    label: 'More variety',
    days: [
      ['oats', 'teriyaki', 'snackbox', 'spaghetti', 'brownies'],
      ['parfait', 'bbqbowl', 'snackbox', 'meatballs', 'mousse'],
      ['oats', 'teriyaki', 'snackbox', 'tenders', 'bark'],
      ['eggbites', 'burritos', 'snackbox', 'meatballs', 'mousse'],
      ['pancakes', 'burritos', 'snackbox', 'spaghetti', 'brownies'],
      ['eggbites', 'bbqbowl', 'popcorn', 'spaghetti', 'cookies'],
      ['pancakes', 'burritos', 'popcorn', 'quesadilla', 'bark'],
    ],
  },
};

export const REJECT_REASONS = ['An ingredient I don’t like', 'The texture', 'Too much effort', 'Had it too often', 'Doesn’t reheat well', 'Not in the mood'];
