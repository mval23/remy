/**
 * The version of Remy's nutrition data (`ING[k].m` and `src` in ingredients.ts). Change it whenever ingredient values
 * change, for example after `node scripts/fdc-match.mjs apply` or new package labels. A saved plan records the
 * version it was planned with (`PlanState.nutritionData`), so Nutrition can say the numbers changed instead of
 * changing them silently.
 */
export const NUTRITION_DATA = '2026-10 FoodData Central + labels';
