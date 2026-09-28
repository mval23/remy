import type { Variety } from '../types';

/**
 * Three hand-tuned week templates, one row per day after prep day,
 * columns in SLOTS order: breakfast, lunch, snack, dinner, sweet.
 * The rules engine swaps out anything the profile rules out. Four of seven dinners are light, Colombian-style
 * (closer to breakfast than to lunch); lunches lean on the healthy bowls.
 */
export const WEEKS: Record<Variety, { label: string; days: string[][] }> = {
  favorites: {
    label: 'Repeat favorites',
    days: [
      ['oats', 'bowl_quinoa', 'snackbox', 'spaghetti', 'brownies'],
      ['oats', 'bowl_quinoa', 'snackbox', 'arepapollo', 'brownies'],
      ['oats', 'bowl_quinoa', 'snackbox', 'tenders', 'brownies'],
      ['oats', 'burritos', 'snackbox', 'arepapollo', 'brownies'],
      ['pancakes', 'burritos', 'snackbox', 'spaghetti', 'brownies'],
      ['pancakes', 'burritos', 'popcorn', 'arepapollo', 'brownies'],
      ['pancakes', 'burritos', 'popcorn', 'arepapollo', 'brownies'],
    ],
  },
  balanced: {
    label: 'Balanced',
    days: [
      ['oats', 'bowl_quinoa', 'snackbox', 'spaghetti', 'brownies'],
      ['oats', 'bowl_quinoa', 'snackbox', 'arepapollo', 'bark'],
      ['oats', 'bowl_quinoa', 'snackbox', 'tenders', 'brownies'],
      ['pancakes', 'burritos', 'snackbox', 'calentado', 'bark'],
      ['pancakes', 'burritos', 'snackbox', 'spaghetti', 'brownies'],
      ['pancakes', 'burritos', 'popcorn', 'arepapollo', 'icecream'],
      ['pancakes', 'burritos', 'popcorn', 'calentado', 'brownies'],
    ],
  },
  variety: {
    label: 'More variety',
    days: [
      ['oats', 'bowl_quinoa', 'snackbox', 'spaghetti', 'brownies'],
      ['parfait', 'bowl_beef', 'mangobiche', 'arepapollo', 'mousse'],
      ['oats', 'bowl_quinoa', 'snackbox', 'meatballs', 'bark'],
      ['eggbites', 'burritos', 'snackbox', 'calentado', 'mousse'],
      ['pancakes', 'burritos', 'snackbox', 'arepachoclo', 'brownies'],
      ['eggbites', 'bowl_beef', 'popcorn', 'sandwichpollo', 'cookies'],
      ['tortitas', 'burritos', 'popcorn', 'meatballs', 'bark'],
    ],
  },
};

export const REJECT_REASONS = ['An ingredient I don’t like', 'The texture', 'Too much effort', 'Had it too often', 'Doesn’t reheat well', 'Not in the mood'];
