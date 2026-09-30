import type { Variety } from '../types';

/**
 * Three hand-tuned week templates, one row per day after prep day,
 * columns in SLOTS order: breakfast, lunch, snack, dinner, sweet.
 * The rules engine swaps out anything the profile rules out. Four of seven dinners are light, Colombian-style
 * (closer to breakfast than to lunch); lunches lean on the healthy bowls; about half the snacks are just fruit.
 */
export const WEEKS: Record<Variety, { label: string; days: string[][] }> = {
  favorites: {
    label: 'Repeat favorites',
    days: [
      ['oats', 'bowl_quinoa', 'snackbox', 'spaghetti', 'brownies'],
      ['oats', 'bowl_quinoa', 'fruit_blueberries', 'arepapollo', 'brownies'],
      ['oats', 'bowl_quinoa', 'snackbox', 'tenders', 'brownies'],
      ['oats', 'burritos', 'fruit_blueberries', 'arepapollo', 'brownies'],
      ['pancakes', 'burritos', 'snackbox', 'spaghetti', 'brownies'],
      ['pancakes', 'burritos', 'fruit_blueberries', 'arepapollo', 'brownies'],
      ['pancakes', 'burritos', 'popcorn', 'arepapollo', 'brownies'],
    ],
  },
  balanced: {
    label: 'Balanced',
    days: [
      ['oats', 'bowl_quinoa', 'snackbox', 'spaghetti', 'brownies'],
      ['oats', 'bowl_quinoa', 'fruit_strawberries', 'arepapollo', 'bark'],
      ['oats', 'bowl_quinoa', 'snackbox', 'tenders', 'brownies'],
      ['pancakes', 'burritos', 'fruit_mango', 'calentado', 'bark'],
      ['pancakes', 'burritos', 'snackbox', 'spaghetti', 'brownies'],
      ['pancakes', 'burritos', 'fruit_blueberries', 'arepapollo', 'icecream'],
      ['pancakes', 'burritos', 'popcorn', 'calentado', 'brownies'],
    ],
  },
  variety: {
    label: 'More variety',
    days: [
      ['oats', 'bowl_quinoa', 'fruit_cup', 'spaghetti', 'brownies'],
      ['parfait', 'bowl_beef', 'mangobiche', 'arepapollo', 'mousse'],
      ['oats', 'bowl_quinoa', 'snackbox', 'meatballs', 'bark'],
      ['eggbites', 'burritos', 'fruit_strawberries', 'calentado', 'mousse'],
      ['pancakes', 'burritos', 'snackbox', 'arepachoclo', 'brownies'],
      ['eggbites', 'bowl_beef', 'fruit_pineapple', 'sandwichpollo', 'cookies'],
      ['tortitas', 'burritos', 'popcorn', 'meatballs', 'bark'],
    ],
  },
};

export const REJECT_REASONS = ['An ingredient I don’t like', 'The texture', 'Too much effort', 'Had it too often', 'Doesn’t reheat well', 'Not in the mood'];
