import type { Recipe, Slot, Task } from '../types';

type RecipeInput = Omit<Recipe, 'id'>;

/*
 * Tasks shared by several recipes (same \`key\`): one pot of rice or one tray of taco chicken covers them all,
 * and the amounts in the instructions add up every recipe that uses them this week.
 */
const RICE_TASK: Task = {
  t: 'Cook the rice', l: 'stove', m: 20, key: 'rice', gear: ['medium pot with a lid', 'sieve'],
  how: [
    'Rinse {rice} in a sieve until the water runs almost clear.',
    'Put it in the pot with {rice*1.5:ml} of cold water and a pinch of salt, and bring to a boil.',
    'Cover, turn the heat to low and cook 12 minutes. Take it off the heat and leave it covered 5 more minutes.',
    'Fluff with a fork and spread on a tray to cool, so it’s in the fridge within an hour.',
  ],
};
const TACO_PREP: Task = {
  t: 'Season chicken with mild taco spices', l: 'hands', m: 5, key: 'tacoprep', gear: ['sheet pan', 'baking paper'],
  how: ['Line a sheet pan with baking paper.', 'Toss {thighs} with {taco} and {oil} until evenly coated.', 'Spread in one layer with space between the pieces.'],
};
const TACO_ROAST: Task = {
  t: 'Roast taco chicken', l: 'oven', m: 22, temp: 220, key: 'tacochicken',
  how: ['Roast at 220°C for 20–22 minutes, until the thickest piece reaches 74°C inside, with no pink in the middle.', 'Rest 5 minutes, then shred with two forks.'],
};

/**
 * Curated recipe library. Nutrition values (kcal, pro, prod) are rough per-portion
 * estimates; a later phase should source them from USDA FoodData Central.
 */
const MEALS: Record<string, RecipeInput> = {
  /* ---------- breakfast ---------- */
  oats: {
    name: 'Chocolate overnight oats', short: 'Chocolate oats', slot: 'Breakfast', e: '🥣', serves: 4, fridge: 4, freezer: 0, cold: true,
    foods: { oats: 1, yogurt: 'Sweetened or flavored', bananas: 1 }, sweet: ['Chocolate'],
    ing: [['oats', 180], ['milk', 480], ['yogurt', 250], ['cocoa', 15], ['honey', 3], ['bananas', 2]],
    why: ['Sweet breakfast, which is what you said you prefer', 'Chocolate, the sweet you find most satisfying', 'Greek yogurt only in its sweetened form, the way you like it'],
    steps: ['Mash the bananas in a large bowl.', 'Stir in oats, milk, yogurt, cocoa and honey until no dry oats remain.', 'Divide between 4 jars, lid and refrigerate.'],
    reheat: 'Eat cold, straight from the fridge. If you want it warm, microwave 60–90 seconds and stir.',
    tasks: [{ t: 'Stir together chocolate overnight-oat jars', l: 'hands', m: 8, end: true, gear: ['mixing bowl', 'jars'], how: ['Mash {bananas} in a large bowl with a fork until smooth.', 'Stir in {oats}, {milk}, {yogurt}, {cocoa} and {honey} until no dry oats or cocoa lumps remain.', 'Divide evenly between {portions} jars, close and refrigerate. Ready after 4 hours; they keep 4 days.'] }],
    subs: [['milk', 'any milk you like'], ['bananas', '2 tbsp maple syrup, if bananas get old']],
    kcal: 360, pro: 16, prod: 0.5, plate: 'One jar is one portion.',
  },
  pancakes: {
    name: 'Sheet-pan banana pancakes', short: 'Sheet-pan pancakes', slot: 'Breakfast', e: '🥞', serves: 8, fridge: 3, freezer: 2,
    foods: { bananas: 1, eggs: 'Baked into something' }, sweet: ['Chocolate'],
    ing: [['flour', 250], ['eggs', 2], ['milk', 360], ['bananas', 2], ['bakingpowder', 3], ['sugar', 50], ['chips', 55], ['butter', 30]],
    why: ['Pancakes are on your favorites list', 'Freezes well, so Thursday–Sunday breakfasts stay fresh', 'Bakes on one pan instead of flipping at the stove'],
    steps: ['Heat oven to 220°C. Line a sheet pan with parchment and brush with melted butter.', 'Whisk flour, sugar and baking powder. Add eggs, milk and mashed banana; stir until just combined.', 'Pour onto the pan, scatter chocolate chips, bake 13–15 minutes until golden.', 'Cool, cut into 16 squares, and bag in pairs.'],
    reheat: 'From frozen: toaster on low for 2 cycles, or microwave 45–60 seconds.', thaw: 'No thawing needed.',
    tasks: [
      { t: 'Mix sheet-pan pancake batter', l: 'hands', m: 10, gear: ['sheet pan', 'baking paper', 'mixing bowl', 'whisk'], how: ['Melt {butter}. Line the sheet pan with baking paper and brush it with a spoonful of the butter (one pan per batch).', 'In the bowl, whisk {flour}, {sugar} and {bakingpowder}.', 'Mash {bananas}, then whisk in {eggs}, {milk} and the rest of the butter.', 'Pour the wet mix into the dry and stir until just combined; a few lumps are fine.'] },
      { t: 'Bake sheet-pan pancakes', l: 'oven', m: 15, temp: 220, how: ['Pour the batter onto the pan, spread it to the edges and scatter {chips} over the top.', 'Bake at 220°C for 13–15 minutes, until golden and a toothpick comes out clean.'] },
      { t: 'Cut pancakes into squares; bag in pairs', l: 'hands', m: 8, end: true, gear: ['freezer bag'], how: ['Cool 10 minutes, then cut into {portions*2} squares.', 'Bag them in pairs. The next 3 days go in the fridge; freeze the rest.'] },
    ],
    subs: [['chocolate chips', 'berries', 'berries']],
    kcal: 340, pro: 9, prod: 0.25, plate: 'Two squares are one portion.',
  },
  eggbites: {
    name: 'Cheesy egg & potato bites', short: 'Egg & potato bites', slot: 'Breakfast', e: '🧁', serves: 6, fridge: 4, freezer: 2,
    foods: { eggs: 'Baked into something', potatoes: 1, cheese: 1 },
    ing: [['eggs', 8], ['potatoes', 450], ['cheddar', 110], ['milk', 60]],
    why: ['Eggs baked into something, one of the ways you said works', 'Cheese and potatoes, both rated Love'],
    steps: ['Heat oven to 190°C and grease a 12-hole muffin tin.', 'Grate potato, squeeze dry, and divide between the holes with the cheese.', 'Whisk eggs with milk and pour over. Bake 20–22 minutes.'],
    reheat: 'Microwave 45–60 seconds until hot in the center.', thaw: 'Move to the fridge the night before, or microwave from frozen for 90 seconds.',
    tasks: [{ t: 'Grate potato and whisk eggs for egg bites', l: 'hands', m: 10 }, { t: 'Bake egg & potato bites', l: 'oven', m: 22, temp: 190 }, { t: 'Cool and box egg bites', l: 'hands', m: 4, end: true }],
    kcal: 290, pro: 17, prod: 0, plate: 'Two bites are one portion.',
  },
  parfait: {
    name: 'Berry yogurt parfait jars', short: 'Berry parfaits', slot: 'Breakfast', e: '🍓', serves: 3, fridge: 3, freezer: 0, cold: true,
    foods: { yogurt: 'Sweetened or flavored', berries: 1 },
    ing: [['yogurt', 370], ['berries', 210], ['honey', 2]],
    why: ['Berries are a Love for you', 'Vanilla yogurt, the sweetened kind you’ll eat'],
    steps: ['Layer yogurt, berries and a drizzle of honey in 3 jars.', 'Keep the crunchy topping separate so it stays crisp.'],
    reheat: 'Eat cold.', tasks: [{ t: 'Layer 3 berry parfait jars', l: 'hands', m: 6, end: true }],
    kcal: 250, pro: 15, prod: 1, plate: 'One jar is one portion.',
  },

  /* ---------- lunch ---------- */
  teriyaki: {
    name: 'Teriyaki chicken rice bowls', short: 'Teriyaki bowl', slot: 'Lunch', e: '🍱', serves: 3, fridge: 4, freezer: 0,
    foods: { chicken: 1, rice: 1, broccoli: 'Roasted until crispy', carrots: 1 }, sauces: ['Teriyaki'],
    ing: [['thighs', 570], ['rice', 190], ['broccoli', 2], ['carrots', 3], ['teriyaki', 120], ['oil', 1]],
    why: ['Chicken and rice, both rated Love', 'Teriyaki is on your sauce list', 'Broccoli roasted until crispy, the one way you said works'],
    note: 'Not frozen: the broccoli softens after freezing, and you said mushy is a no.',
    steps: ['Toss chicken with half the teriyaki sauce.', 'Cut broccoli into small florets and carrots into coins; toss with oil and salt.', 'Roast chicken and vegetables on 2 pans at 220°C for 22–25 minutes, until the broccoli edges are crisp and chicken reaches 74°C.', 'Slice chicken, brush with the remaining sauce, and portion with rice into 3 containers.'],
    reheat: 'Microwave 2–3 minutes, stirring halfway, until steaming (74°C). Sprinkle a teaspoon of water over the rice first.',
    tasks: [
      RICE_TASK,
      { t: 'Marinate the chicken in teriyaki', l: 'hands', m: 6, gear: ['mixing bowl'], how: ['Cut {thighs} into large bite-size pieces.', 'Toss with {teriyaki*0.5} in a bowl. Keep the other {teriyaki*0.5:q} for glazing.'] },
      { t: 'Cut broccoli and carrots for roasting', l: 'hands', m: 10, gear: ['2 sheet pans', 'baking paper'], how: ['Line 2 sheet pans with baking paper.', 'Cut {broccoli} into small florets; small ones get crisper edges.', 'Peel {carrots} and slice into 1 cm coins.', 'Toss the vegetables with {oil} and a pinch of salt on one pan, in a single layer.'] },
      { t: 'Roast teriyaki chicken + crispy broccoli & carrots (2 pans)', l: 'oven', m: 25, temp: 220, pans: 2, how: ['Spread the chicken on the second pan.', 'Roast both pans at 220°C for 22–25 minutes, swapping shelves halfway, until the broccoli edges are dark and crisp and the chicken reaches 74°C inside.'] },
      { t: 'Glaze and portion teriyaki bowls', l: 'hands', m: 8, end: true, gear: ['containers'], how: ['Brush the chicken with the rest of the sauce.', 'Divide between {portions} containers: half chicken and vegetables, a quarter rice (about {rice*3:g} cooked rice in total).', 'Cool with the lids off for 20 minutes, then close and refrigerate.'] },
    ],
    subs: [['chicken thighs', 'turkey', 'turkey'], ['broccoli', 'green beans', 'greenbeans'], ['jasmine rice', 'pasta', 'pasta']],
    kcal: 540, pro: 38, prod: 1.5, plate: 'In each container: half chicken and crispy vegetables, a quarter rice (about 140 g cooked).',
  },
  burritos: {
    name: 'Freezer chicken & cheese burritos', short: 'Chicken burritos', slot: 'Lunch', e: '🌯', serves: 4, fridge: 3, freezer: 3,
    foods: { chicken: 1, rice: 1, cheese: 1, corn: 1 }, sauces: ['Mild salsa'],
    ing: [['tortillas', 4], ['thighs', 570], ['rice', 140], ['cheddar', 170], ['salsa', 190], ['taco', 2], ['corn', 150], ['oil', 1]],
    why: ['A take-anywhere version of your favorite chicken burrito bowl', 'Freezes well, so Thursday–Sunday lunches stay safe', 'Mild salsa matches your spice level'],
    steps: ['Season chicken with taco seasoning and roast at 220°C for 20–22 minutes.', 'Shred chicken and mix with rice, corn and salsa.', 'Fill each tortilla with filling and cheese, roll tightly, wrap in foil, freeze flat.'],
    reheat: 'From frozen: remove foil, wrap in a damp paper towel, microwave 2 minutes, flip, then 1–2 minutes more until 74°C in the center.', thaw: 'Optional: move to the fridge the night before for a 90-second reheat.',
    tasks: [
      RICE_TASK,
      TACO_PREP,
      TACO_ROAST,
      { t: 'Fill and wrap the burritos', l: 'hands', m: 15, end: true, gear: ['mixing bowl', 'foil'], how: ['In a large bowl, mix {thighs*0.75:g} of the shredded chicken with {rice*3:g} cooked rice, {corn} (thawed) and {salsa}.', 'Warm {tortillas} in the microwave for 20 seconds so they fold without cracking.', 'Divide the filling between them, top each with some of {cheddar}, fold in the sides and roll up tightly.', 'Wrap each in foil and freeze flat. Keep tomorrow’s burrito in the fridge.'] },
    ],
    subs: [['chicken thighs', 'ground beef', 'beef'], ['corn', 'leave it out']],
    kcal: 560, pro: 32, prod: 0.5, plate: 'One burrito is one portion. A fruit or corn side covers produce.',
  },
  bbqbowl: {
    name: 'BBQ chicken & cheesy rice bowls', short: 'BBQ chicken bowl', slot: 'Lunch', e: '🍗', serves: 3, fridge: 4, freezer: 3,
    foods: { chicken: 1, rice: 1, cheese: 1, corn: 1 }, sauces: ['BBQ'],
    ing: [['thighs', 570], ['rice', 190], ['bbq', 120], ['cheddar', 85], ['corn', 150]],
    why: ['BBQ is one of your sauces, and you like smoky flavors', 'Chicken, rice and cheese: all rated Love'],
    steps: ['Roast chicken at 220°C for 22 minutes, then toss in BBQ sauce.', 'Stir cheese into hot rice. Portion with chicken and corn.'],
    reheat: 'Microwave 2–3 minutes until 74°C.', thaw: 'Move to the fridge the night before.',
    tasks: [RICE_TASK, { t: 'Roast chicken for BBQ bowls', l: 'oven', m: 22, temp: 220 }, { t: 'Toss chicken in BBQ sauce and portion 3 bowls', l: 'hands', m: 8, end: true }],
    kcal: 560, pro: 36, prod: 0.5, plate: 'In each container: chicken and corn on one side, about 140 g cheesy rice on the other.',
  },
  beefbroc: {
    name: 'Beef & broccoli stir-fry', short: 'Beef & broccoli', slot: 'Lunch', e: '🥡', serves: 3, fridge: 4, freezer: 2,
    foods: { beef: 1, broccoli: 'Steamed', rice: 1 },
    ing: [['flank', 450], ['broccoli', 2], ['oyster', 3], ['soy', 2], ['rice', 190], ['garlic', 2]],
    why: ['Beef and rice are on your list'],
    steps: ['Slice beef thinly against the grain.', 'Sear beef in a hot pan, remove, then steam-fry broccoli with garlic.', 'Return the beef, add oyster and soy sauce, toss 1 minute, and portion with rice.'],
    reheat: 'Microwave 2–3 minutes until 74°C.', thaw: 'Move to the fridge the night before.',
    tasks: [RICE_TASK, { t: 'Slice beef and cut broccoli', l: 'hands', m: 10 }, { t: 'Stir-fry beef and broccoli', l: 'stove', m: 15 }, { t: 'Portion 3 stir-fry bowls', l: 'hands', m: 6, end: true }],
    kcal: 520, pro: 34, prod: 1.5, plate: 'In each container: half beef and broccoli, a quarter rice.',
  },

  /* ---------- dinner ---------- */
  spaghetti: {
    name: 'Hidden-veggie spaghetti with meat sauce', short: 'Spaghetti & meat sauce', slot: 'Dinner', e: '🍝', serves: 4, fridge: 4, freezer: 3,
    foods: { beef: 1, pasta: 1, spinach: 'Blended into a sauce', carrots: 1, onions: 'Blended into a sauce', tomatoes: 'Blended into a sauce', cheese: 1 }, sauces: ['Marinara'],
    ing: [['beef', 570], ['marinara', 1], ['spinach', 60], ['carrots', 1], ['onion', 0.5], ['spaghetti', 450], ['parmesan', 45]],
    why: ['Spaghetti with meat sauce is on your favorites list', 'Spinach, carrot and onion are blended smooth. You said hidden is fine', 'Marinara is one of your sauces'],
    note: 'Sauce and pasta are stored separately so the pasta doesn’t go mushy.',
    steps: ['Blend marinara with spinach, carrot and onion until completely smooth.', 'Brown the beef, drain, add the blended sauce and simmer 25 minutes.', 'Cook spaghetti 1 minute less than the package says, drain, toss with a little oil.', 'Portion sauce and pasta into separate containers.'],
    reheat: 'Microwave sauce 2 minutes, stir, add pasta and heat 1 more minute until steaming (74°C). Top with parmesan.', thaw: 'Move frozen sauce to the fridge the night before. Never thaw on the counter.',
    tasks: [
      { t: 'Blend the hidden-veggie sauce', l: 'hands', m: 6, gear: ['blender'], how: ['Peel and roughly chop {carrots} and {onion}.', 'Blend with {marinara} and {spinach} until completely smooth, with no green flecks.'] },
      { t: 'Brown the beef and add the sauce', l: 'hands', m: 10, gear: ['large deep pan'], how: ['Brown {beef} over medium-high heat, breaking it up, 6–8 minutes.', 'Spoon off most of the fat, pour in the blended sauce and bring to a simmer.'] },
      { t: 'Simmer meat sauce', l: 'stove', m: 25, how: ['Simmer uncovered on low for 25 minutes, stirring now and then, until thick. Season with salt and pepper.'] },
      { t: 'Boil spaghetti (1 minute under)', l: 'stove', m: 12, gear: ['large pot', 'colander'], how: ['Boil {spaghetti} in plenty of salted water for 1 minute less than the packet says.', 'Drain, toss with a spoonful of oil so it doesn’t stick, and spread out to cool.'] },
      { t: 'Portion sauce and pasta', l: 'hands', m: 6, end: true, gear: ['containers'], how: ['Divide the pasta between {portions} containers, and the sauce between {portions} more (about 250 ml each).', 'Refrigerate what you’ll eat in the next 4 days; freeze the rest of the sauce.', 'Keep {parmesan} for serving.'] },
    ],
    subs: [['ground beef', 'ground turkey', 'turkey'], ['spaghetti', 'any pasta shape']],
    kcal: 590, pro: 33, prod: 1, plate: 'About 150 g cooked pasta with 250 ml sauce. The vegetables are already in the sauce.',
  },
  tenders: {
    name: 'Crispy parmesan chicken tenders & potato wedges', short: 'Crispy tenders & wedges', slot: 'Dinner', e: '🍟', serves: 2, fridge: 1, freezer: 3,
    foods: { chicken: 1, potatoes: 1, cheese: 1, eggs: 'Baked into something' }, sauces: ['Honey mustard', 'Ranch'],
    ing: [['tenders', 450], ['panko', 60], ['parmesan', 45], ['eggs', 1], ['potatoes', 570], ['oil', 2], ['honeymustard', 60]],
    why: ['Chicken tenders are on your favorites list', 'Air-fried fresh, because you said crispy food reheats badly', 'Honey mustard for dipping, one of your sauces'],
    note: 'Tenders are breaded and frozen raw, then air-fried fresh in 14 minutes. Wedges keep 4 days in the fridge and re-crisp in the air fryer.',
    steps: ['Dip tenders in beaten egg, then in panko mixed with parmesan.', 'Freeze in a single layer on a lined tray for 1 hour, then bag.', 'Cut potatoes into wedges, toss with oil and salt, roast at 220°C for 30 minutes.'],
    reheat: 'Air fryer at 200°C: tenders from frozen 12–14 minutes, flipping once, until 74°C inside. Add wedges for the last 5 minutes.', thaw: 'No thawing: cook tenders straight from frozen.',
    tasks: [
      { t: 'Bread the chicken tenders', l: 'hands', m: 16, gear: ['3 shallow bowls', 'tray', 'baking paper'], how: ['Line a tray with baking paper. Beat {eggs} in one shallow bowl; mix {panko} and {parmesan} in another.', 'Pat {tenders} dry, dip each in the egg, let the extra drip off, then press into the crumbs on both sides.', 'Lay them on the tray without touching.'] },
      { t: 'Flash-freeze tenders on a lined tray', l: 'chill', m: 60, how: ['Freeze uncovered for 1 hour, until firm.'] },
      { t: 'Cut and season potato wedges', l: 'hands', m: 8, gear: ['sheet pan', 'baking paper'], how: ['Cut {potatoes} into wedges about 2 cm thick; no need to peel.', 'Toss with {oil} and a good pinch of salt, and spread on a lined sheet pan, cut side down.'] },
      { t: 'Roast potato wedges', l: 'oven', m: 30, temp: 220, how: ['Roast at 220°C for 30 minutes, turning once, until golden and crisp at the edges.'] },
      { t: 'Bag frozen tenders; box wedges', l: 'hands', m: 4, end: true, gear: ['freezer bag', 'containers'], how: ['Move the frozen tenders to a freezer bag and label it.', 'Cool the wedges, then box them for the fridge (up to 4 days). Keep {honeymustard} for dipping.'] },
    ],
    subs: [['panko', 'crushed crackers'], ['honey mustard', 'ranch or BBQ']],
    kcal: 650, pro: 50, prod: 0, plate: 'About 4 tenders and a handful of wedges. A vegetable side rounds it out.',
  },
  quesadilla: {
    name: 'Cheesy chicken quesadillas', short: 'Chicken quesadillas', slot: 'Dinner', e: '🫓', serves: 2, fridge: 3, freezer: 3,
    foods: { chicken: 1, cheese: 1 }, sauces: ['Mild salsa'],
    ing: [['thighs', 340], ['tortillas', 2], ['cheddar', 110], ['salsa', 65], ['taco', 1], ['oil', 1]],
    why: ['Reuses the taco chicken, so it doesn’t feel like leftovers', 'Cheesy and mild, two things you picked'],
    note: 'Cook-fresh night: 8 minutes in a pan or air fryer.',
    steps: ['Fill a tortilla with taco chicken and cheese, fold.', 'Cook in a dry pan 2–3 minutes per side, or air-fry 6 minutes at 190°C.'],
    reheat: 'On the night: fill a tortilla with half the thawed taco chicken and some cheese, fold, and cook in a dry pan 2–3 minutes per side (or air-fry 6 minutes at 190°C) until the cheese melts. Serve with salsa.', thaw: 'Move the bag of taco chicken to the fridge the night before.',
    tasks: [
      TACO_PREP,
      TACO_ROAST,
      { t: 'Bag taco chicken for quesadillas; freeze', l: 'hands', m: 3, end: true, gear: ['freezer bag'], how: ['Put {thighs*0.75:g} of the shredded chicken in a freezer bag, press it flat and freeze.', 'Keep {tortillas}, {cheddar} and {salsa} for the night you make them.'] },
    ],
    kcal: 540, pro: 34, prod: 0, plate: 'One large quesadilla, cut into 4, with salsa.',
  },
  meatballs: {
    name: 'Turkey meatballs in marinara', short: 'Turkey meatballs', slot: 'Dinner', e: '🧆', serves: 4, fridge: 4, freezer: 3,
    foods: { turkey: 1, pasta: 1, tomatoes: 'Blended into a sauce', cheese: 1, eggs: 'Baked into something' }, sauces: ['Marinara'],
    ing: [['turkey', 570], ['marinara', 1], ['parmesan', 30], ['eggs', 1], ['panko', 30], ['spaghetti', 230]],
    why: ['Marinara is one of your sauces', 'Turkey is rated Okay; parmesan and sauce make it familiar'],
    steps: ['Mix turkey, egg, panko and parmesan; roll 16 meatballs.', 'Bake at 200°C for 18 minutes, then simmer in marinara 10 minutes.'],
    reheat: 'Microwave 2–3 minutes until 74°C.', thaw: 'Move to the fridge the night before.',
    tasks: [{ t: 'Roll 16 turkey meatballs', l: 'hands', m: 15 }, { t: 'Bake meatballs', l: 'oven', m: 18, temp: 200 }, { t: 'Simmer meatballs in marinara', l: 'stove', m: 10 }, { t: 'Portion meatballs', l: 'hands', m: 5, end: true }],
    kcal: 520, pro: 36, prod: 0.5, plate: '4 meatballs with about 180 g pasta and sauce.',
  },
  shrimp: {
    name: 'Garlic butter shrimp & rice', short: 'Garlic shrimp', slot: 'Dinner', e: '🍤', serves: 3, fridge: 3, freezer: 0,
    foods: { rice: 1 },
    ing: [['shrimp', 450], ['butter', 40], ['garlic', 3], ['rice', 190]],
    why: ['Mild, buttery and quick'],
    note: 'Shrimp turns rubbery when frozen after cooking, so this stays in the fridge and is eaten early in the week.',
    steps: ['Melt butter with sliced garlic over medium heat.', 'Add shrimp and cook 2 minutes per side until pink and opaque.', 'Portion over rice.'],
    reheat: 'Microwave 90 seconds, just until hot (74°C). Longer makes shrimp tough.',
    tasks: [RICE_TASK, { t: 'Cook garlic butter shrimp', l: 'stove', m: 10 }, { t: 'Portion 3 shrimp bowls', l: 'hands', m: 5, end: true }],
    kcal: 480, pro: 30, prod: 0, plate: 'About 140 g shrimp with 140 g cooked rice.',
  },
  salmon: {
    name: 'Honey-soy glazed salmon', short: 'Honey-soy salmon', slot: 'Dinner', e: '🐟', serves: 3, fridge: 3, freezer: 2,
    foods: { salmon: 1, rice: 1 },
    ing: [['salmon', 450], ['soy', 3], ['honey', 2], ['rice', 190]],
    why: ['Sweet-savory glaze'],
    steps: ['Whisk soy sauce and honey.', 'Brush over salmon and roast at 220°C for 12–14 minutes, until it flakes.', 'Portion with rice.'],
    reheat: 'Microwave at half power 2 minutes, or eat cold over rice.', thaw: 'Move to the fridge the night before.',
    tasks: [RICE_TASK, { t: 'Glaze salmon', l: 'hands', m: 5 }, { t: 'Roast salmon', l: 'oven', m: 14, temp: 220 }, { t: 'Portion 3 salmon bowls', l: 'hands', m: 5, end: true }],
    kcal: 510, pro: 34, prod: 0, plate: 'One fillet with about 140 g cooked rice.',
  },
  chili: {
    name: 'Mild beef & bean chili', short: 'Beef & bean chili', slot: 'Dinner', e: '🍲', serves: 4, fridge: 4, freezer: 3,
    foods: { beef: 1, beans: 1, tomatoes: 1, onions: 'Finely chopped, cooked soft' },
    ing: [['beef', 450], ['beanscan', 2], ['marinara', 1], ['onion', 1]],
    why: ['Mild and hearty; freezes well'],
    steps: ['Soften finely chopped onion, then brown the beef.', 'Add beans and sauce, simmer 30 minutes.', 'Cool and portion into 4 containers.'],
    reheat: 'Microwave 2–3 minutes, stirring halfway, until 74°C.', thaw: 'Move to the fridge the night before.',
    tasks: [{ t: 'Chop onion and brown beef', l: 'hands', m: 10 }, { t: 'Simmer chili', l: 'stove', m: 35 }, { t: 'Portion chili', l: 'hands', m: 5, end: true }],
    kcal: 500, pro: 32, prod: 1.5, plate: 'About 350 g.',
  },

  /* ---------- snacks ---------- */
  snackbox: {
    name: 'Cheese, crackers & grapes snack boxes', short: 'Snack boxes', slot: 'Afternoon snack', e: '🧀', serves: 5, fridge: 5, freezer: 0, cold: true,
    foods: { cheese: 1, grapes: 1 },
    ing: [['cheeseblock', 230], ['crackers', 1], ['grapes', 680]],
    why: ['Crunchy, cheesy and sweet, all three of your snack picks', 'No cooking, so it adds 10 minutes of packing, not cooking'],
    steps: ['Cube the cheese and wash the grapes.', 'Pack cheese and grapes in 5 small containers; keep crackers in a separate bag so they stay crunchy.'],
    reheat: 'Eat cold.', tasks: [{ t: 'Pack 5 snack boxes: cheese cubes and grapes', l: 'hands', m: 10, end: true }],
    kcal: 230, pro: 9, prod: 1, plate: 'One box.',
  },
  popcorn: {
    name: 'Kettle-style popcorn', short: 'Kettle popcorn', slot: 'Afternoon snack', e: '🍿', serves: 2, fridge: 7, freezer: 0, room: true,
    foods: {}, ing: [['popcorn', 100], ['sugar', 25], ['oil', 1]],
    why: ['Crunchy and a little sweet', 'Keeps a week in an airtight bag at room temperature'],
    steps: ['Heat oil in a large lidded pot, add kernels and sugar, shake constantly until popping slows.', 'Spread to cool, salt lightly, and bag in 2 portions.'],
    reheat: 'Eat at room temperature.', tasks: [{ t: 'Pop kettle corn and bag 2 portions', l: 'stove', m: 8 }],
    kcal: 160, pro: 3, prod: 0, plate: 'One bag, about 25 g.',
  },
  pretzels: {
    name: 'Chocolate-dipped pretzels', short: 'Chocolate pretzels', slot: 'Afternoon snack', e: '🥨', serves: 5, fridge: 7, freezer: 0, room: true,
    foods: {}, sweet: ['Chocolate'], ing: [['pretzels', 1], ['chips', 85]],
    why: ['Crunchy plus chocolate'], steps: ['Melt chips in 20-second bursts, dip pretzels, set on parchment.'], reheat: 'Room temperature.',
    tasks: [{ t: 'Dip pretzels in chocolate', l: 'hands', m: 10 }],
    kcal: 180, pro: 3, prod: 0, plate: 'About 10 pretzels.',
  },

  /* ---------- sweets ---------- */
  brownies: {
    name: 'Fudgy one-bowl brownies', short: 'Brownie square', slot: 'Evening sweet', e: '🍫', serves: 12, fridge: 5, freezer: 3,
    foods: { eggs: 'Baked into something' }, sweet: ['Brownies', 'Chocolate'],
    ing: [['butter', 110], ['sugar', 200], ['cocoa', 40], ['eggs', 2], ['flour', 65], ['chips', 85], ['vanilla', 1]],
    why: ['Brownies are one of your favorite desserts', 'A real dessert in a moderate portion: 12 small squares, one per serving', 'Pre-portioned, as you asked, so there’s nothing to decide at night'],
    steps: ['Heat oven to 180°C. Melt butter, stir in sugar and cocoa.', 'Beat in eggs and vanilla, fold in flour and chips.', 'Bake in a lined 20 cm square pan for 22–25 minutes. Cool fully, cut 12 squares.'],
    reheat: 'Eat as is, or 10 seconds in the microwave.', thaw: 'Frozen squares thaw on the counter in about 20 minutes.',
    tasks: [
      { t: 'Mix one-bowl brownie batter', l: 'hands', m: 12, gear: ['20 cm square baking pan', 'baking paper', 'microwave-safe bowl'], how: ['Line the pan with baking paper (one pan per batch).', 'Melt {butter} in the bowl; stir in {sugar} and {cocoa} until glossy.', 'Beat in {eggs} one at a time, then {vanilla}.', 'Fold in {flour} until no dry streaks remain, then {chips}.'] },
      { t: 'Bake brownies', l: 'oven', m: 25, temp: 180, how: ['Spread the batter in the pan and bake at 180°C for 22–25 minutes, until the top is set and a toothpick comes out with a few moist crumbs.'] },
      { t: 'Cut brownie squares; wrap extras for the freezer', l: 'hands', m: 6, end: true, gear: ['freezer bag'], how: ['Cool completely in the pan, at least 1 hour; cold brownies cut cleanly.', 'Cut into {portions} squares. Keep 5 days’ worth in a box and freeze the rest.'] },
    ],
    subs: [['chocolate chips', 'leave them out for a lighter square']],
    kcal: 190, pro: 3, prod: 0, plate: 'One small square.',
  },
  bark: {
    name: 'Chocolate-berry frozen yogurt bark', short: 'Froyo bark', slot: 'Evening sweet', e: '🍧', serves: 6, fridge: 0, freezer: 2,
    foods: { yogurt: 'Sweetened or flavored', berries: 1 }, sweet: ['Chocolate', 'Ice cream'],
    ing: [['yogurt', 490], ['honey', 2], ['cocoa', 5], ['berries', 140], ['chips', 45]],
    why: ['A lighter, cold and creamy option', 'Berries (Love) and chocolate'],
    steps: ['Stir honey and cocoa into yogurt, spread on a lined tray.', 'Scatter berries and chips, freeze at least 2 hours, then break into 6 pieces.'],
    reheat: 'Eat straight from the freezer. Let it sit 2 minutes if it’s too hard.',
    tasks: [{ t: 'Spread chocolate-berry yogurt bark on a tray', l: 'hands', m: 6 }, { t: 'Freeze bark (break into pieces tomorrow)', l: 'chill', m: 120 }],
    kcal: 130, pro: 7, prod: 0.5, plate: 'One piece.',
  },
  icecream: {
    name: 'Mini ice cream bar', short: 'Mini ice cream bar', slot: 'Evening sweet', e: '🍦', serves: 6, fridge: 0, freezer: 2, store: true,
    foods: {}, sweet: ['Ice cream'], ing: [['icecream', 1]],
    why: ['Store-bought treats count too. This one is already portioned', 'Ice cream is on your sweets list'],
    steps: ['Buy, freeze, enjoy.'], reheat: 'Straight from the freezer.', tasks: [],
    kcal: 150, pro: 2, prod: 0, plate: 'One bar.',
  },
  mousse: {
    name: 'Chocolate Greek-yogurt mousse cups', short: 'Chocolate mousse cup', slot: 'Evening sweet', e: '🍮', serves: 4, fridge: 4, freezer: 0, cold: true,
    foods: { yogurt: 'Sweetened or flavored' }, sweet: ['Chocolate', 'Pudding'],
    ing: [['yogurt', 490], ['cocoa', 20], ['honey', 3], ['chips', 45]],
    why: ['Chocolatey, creamy and cold', 'Sweetened yogurt, the form you like'],
    steps: ['Whisk yogurt, cocoa and honey until silky. Spoon into 4 small glasses and top with chips.'], reheat: 'Eat cold.',
    tasks: [{ t: 'Whisk and portion 4 mousse cups', l: 'hands', m: 7, end: true }],
    kcal: 170, pro: 10, prod: 0, plate: 'One cup.',
  },
  cookies: {
    name: 'Freezer chocolate-chip cookie dough', short: 'Fresh-baked cookie', slot: 'Evening sweet', e: '🍪', serves: 12, fridge: 0, freezer: 3,
    foods: { eggs: 'Baked into something' }, sweet: ['Cookies', 'Chocolate'],
    ing: [['butter', 110], ['sugar', 150], ['eggs', 1], ['flour', 190], ['chips', 170], ['vanilla', 1]],
    why: ['Cookies are one of your favorite sweets', 'Bake 1–2 at a time in the air fryer, so there’s no whole batch sitting around'],
    steps: ['Mix dough, scoop 12 balls onto a tray and freeze.'], reheat: 'Air fryer 160°C for 8–9 minutes from frozen.',
    tasks: [{ t: 'Mix cookie dough and scoop 12 balls', l: 'hands', m: 14 }, { t: 'Freeze dough balls', l: 'chill', m: 60 }],
    kcal: 170, pro: 2, prod: 0, plate: 'One cookie.',
  },
  /* ---------- more choices, so weeks can rotate ---------- */
  bfburritos: {
    name: 'Freezer breakfast burritos', short: 'Breakfast burritos', slot: 'Breakfast', e: '🌯', serves: 6, fridge: 3, freezer: 3,
    foods: { eggs: 'Scrambled', potatoes: 1, cheese: 1 }, sauces: ['Mild salsa'],
    ing: [['eggs', 10], ['potatoes', 450], ['cheddar', 170], ['tortillas', 6], ['salsa', 130], ['oil', 1]],
    why: ['Scrambled eggs, potatoes and cheese, wrapped to go', 'Freezes well, so late-week breakfasts stay safe'],
    steps: ['Dice potatoes small, toss with oil and salt, roast at 220°C for 25 minutes until crisp.', 'Scramble the eggs softly; they finish cooking when reheated.', 'Fill each tortilla with eggs, potatoes, cheese and a spoon of salsa. Roll tightly, wrap in foil and freeze flat.'],
    reheat: 'From frozen: remove foil, wrap in a damp paper towel, microwave 1½ minutes, flip, then 1 minute more until 74°C in the center.', thaw: 'Optional: move to the fridge the night before for a 60-second reheat.',
    tasks: [{ t: 'Dice potatoes for breakfast burritos', l: 'hands', m: 8 }, { t: 'Roast breakfast potatoes', l: 'oven', m: 25, temp: 220 }, { t: 'Scramble 10 eggs', l: 'stove', m: 10 }, { t: 'Roll and wrap 6 breakfast burritos', l: 'hands', m: 12, end: true }],
    subs: [['salsa', 'leave it out']],
    kcal: 380, pro: 19, prod: 0.25, plate: 'One burrito is one portion.',
  },
  muffins: {
    name: 'Banana chocolate-chip muffins', short: 'Banana muffins', slot: 'Breakfast', e: '🧁', serves: 12, fridge: 4, freezer: 3,
    foods: { bananas: 1, eggs: 'Baked into something' }, sweet: ['Chocolate'],
    ing: [['bananas', 3], ['flour', 220], ['eggs', 2], ['sugar', 100], ['butter', 85], ['bakingpowder', 2], ['milk', 120], ['chips', 85], ['vanilla', 1]],
    why: ['A sweet breakfast you can grab on the way out', 'Uses up ripe bananas'],
    steps: ['Heat oven to 180°C and line a 12-hole muffin tin.', 'Mash bananas; whisk in melted butter, eggs, milk, sugar and vanilla.', 'Stir in flour and baking powder until just combined, fold in chips, and bake 20–22 minutes.'],
    reheat: 'Eat at room temperature, or microwave 15 seconds.', thaw: 'Frozen muffins thaw on the counter in about 30 minutes, or microwave 30 seconds.',
    tasks: [{ t: 'Mix banana muffin batter', l: 'hands', m: 12 }, { t: 'Bake banana muffins', l: 'oven', m: 22, temp: 180 }, { t: 'Cool and bag muffins; freeze half', l: 'hands', m: 5, end: true }],
    subs: [['chocolate chips', 'berries', 'berries']],
    kcal: 230, pro: 5, prod: 0.25, plate: 'One muffin. Add a yogurt cup or eggs for protein.',
  },
  pboats: {
    name: 'Peanut butter banana overnight oats', short: 'PB banana oats', slot: 'Breakfast', e: '🥜', serves: 4, fridge: 4, freezer: 0, cold: true,
    foods: { oats: 1, yogurt: 'Sweetened or flavored', bananas: 1 },
    ing: [['oats', 180], ['milk', 480], ['yogurt', 250], ['pb', 65], ['bananas', 2], ['honey', 2]],
    why: ['Sweet and filling, ready in the fridge', 'Peanut butter and yogurt add protein'],
    steps: ['Mash the bananas in a large bowl.', 'Stir in oats, milk, yogurt, peanut butter and honey.', 'Divide between 4 jars, lid and refrigerate.'],
    reheat: 'Eat cold, or microwave 60–90 seconds and stir.',
    tasks: [{ t: 'Stir together 4 PB banana oat jars', l: 'hands', m: 8, end: true }],
    kcal: 400, pro: 17, prod: 0.5, plate: 'One jar is one portion.',
  },
  tacobowl: {
    name: 'Turkey taco rice bowls', short: 'Turkey taco bowl', slot: 'Lunch', e: '🌮', serves: 4, fridge: 4, freezer: 3,
    foods: { turkey: 1, rice: 1, corn: 1, cheese: 1 }, sauces: ['Mild salsa'],
    ing: [['turkey', 570], ['rice', 190], ['taco', 2], ['corn', 150], ['cheddar', 85], ['salsa', 130]],
    why: ['Mild taco flavor with rice and cheese', 'Freezes well for the end of the week'],
    steps: ['Brown the turkey, add taco seasoning and a splash of water, simmer 3 minutes.', 'Warm the corn.', 'Portion rice, turkey and corn into 4 containers; add cheese and salsa on top.'],
    reheat: 'Microwave 2–3 minutes until 74°C.', thaw: 'Move to the fridge the night before.',
    tasks: [RICE_TASK, { t: 'Brown taco turkey', l: 'stove', m: 12 }, { t: 'Portion 4 turkey taco bowls', l: 'hands', m: 8, end: true }],
    subs: [['ground turkey', 'ground beef', 'beef']],
    kcal: 520, pro: 35, prod: 0.75, plate: 'In each container: turkey and corn over about 140 g cooked rice.',
  },
  chickenpasta: {
    name: 'Cheesy chicken & broccoli pasta bake', short: 'Chicken pasta bake', slot: 'Lunch', e: '🧀', serves: 4, fridge: 4, freezer: 2,
    foods: { chicken: 1, pasta: 1, broccoli: 'With cheese', cheese: 1 },
    ing: [['tenders', 570], ['pasta', 340], ['broccoli', 1], ['cheddar', 170], ['milk', 360], ['butter', 30], ['flour', 15], ['parmesan', 25]],
    why: ['Chicken and pasta in a mild cheese sauce', 'Broccoli is chopped small and baked with cheese'],
    steps: ['Boil pasta 2 minutes under the package time; add chopped broccoli for the last minute. Drain.', 'Melt butter, whisk in flour, then milk; simmer until thick and stir in cheddar.', 'Stir in pasta, broccoli and bite-size chicken, top with parmesan, and bake at 190°C for 20 minutes until the chicken reaches 74°C.'],
    reheat: 'Microwave 2–3 minutes with a splash of milk until steaming (74°C).', thaw: 'Move to the fridge the night before.',
    tasks: [{ t: 'Cut chicken and chop broccoli small', l: 'hands', m: 10 }, { t: 'Boil pasta (2 minutes under) with broccoli', l: 'stove', m: 12 }, { t: 'Make cheese sauce', l: 'stove', m: 10 }, { t: 'Bake chicken pasta', l: 'oven', m: 20, temp: 190 }, { t: 'Portion 4 pasta bakes', l: 'hands', m: 5, end: true }],
    subs: [['broccoli', 'corn', 'corn']],
    kcal: 610, pro: 42, prod: 0.75, plate: 'About 350 g.',
  },
  hmchicken: {
    name: 'Honey-mustard chicken & crispy potatoes', short: 'Honey-mustard chicken', slot: 'Lunch', e: '🍯', serves: 3, fridge: 4, freezer: 0,
    foods: { chicken: 1, potatoes: 1, carrots: 1 }, sauces: ['Honey mustard'],
    ing: [['thighs', 570], ['potatoes', 680], ['carrots', 3], ['honeymustard', 80], ['oil', 2]],
    why: ['Sheet-pan chicken with crispy potatoes', 'Sweet-savory honey mustard'],
    note: 'Not frozen: crispy potatoes go soft after freezing. Re-crisp them in the air fryer.',
    steps: ['Cut potatoes into cubes and carrots into coins; toss with oil and salt.', 'Toss chicken with half the honey mustard.', 'Roast everything on 2 pans at 220°C for 28–30 minutes, until the potatoes are crisp and the chicken reaches 74°C. Brush with the rest of the sauce.'],
    reheat: 'Air fryer 190°C for 6 minutes to re-crisp, or microwave 2 minutes until 74°C.',
    tasks: [{ t: 'Cut potatoes and carrots; sauce the chicken', l: 'hands', m: 12 }, { t: 'Roast honey-mustard chicken and potatoes', l: 'oven', m: 30, temp: 220, pans: 2 }, { t: 'Portion 3 honey-mustard containers', l: 'hands', m: 5, end: true }],
    subs: [['carrots', 'green beans', 'greenbeans']],
    kcal: 560, pro: 36, prod: 1, plate: 'In each container: chicken, a fist of potatoes, and carrots.',
  },
  friedrice: {
    name: 'Chicken fried rice', short: 'Chicken fried rice', slot: 'Lunch', e: '🍳', serves: 4, fridge: 4, freezer: 2,
    foods: { chicken: 1, rice: 1, eggs: 'Scrambled', carrots: 'Finely chopped, cooked soft', corn: 1 },
    ing: [['thighs', 450], ['rice', 190], ['eggs', 2], ['carrots', 2], ['corn', 75], ['soy', 3], ['oil', 2], ['garlic', 2]],
    why: ['Chicken and rice with a mild soy flavor', 'Carrots are chopped small and cooked soft'],
    steps: ['Cook the rice and spread it out to cool (day-old texture fries best).', 'Stir-fry diced chicken until cooked through, then the carrots, corn and garlic.', 'Push aside, scramble the eggs, then add the rice and soy sauce and fry 3 minutes.'],
    reheat: 'Microwave 2 minutes, stirring halfway, until 74°C.', thaw: 'Move to the fridge the night before.',
    tasks: [RICE_TASK, { t: 'Dice chicken and carrots', l: 'hands', m: 10 }, { t: 'Stir-fry chicken fried rice', l: 'stove', m: 15 }, { t: 'Portion 4 fried rice containers', l: 'hands', m: 5, end: true }],
    kcal: 520, pro: 32, prod: 1, plate: 'About 350 g.',
  },
  macncheese: {
    name: 'Baked mac & cheese with hidden carrots', short: 'Mac & cheese', slot: 'Dinner', e: '🧀', serves: 5, fridge: 4, freezer: 2,
    foods: { pasta: 1, cheese: 1, carrots: 'Blended into a sauce' },
    ing: [['pasta', 450], ['cheddar', 230], ['milk', 600], ['butter', 40], ['flour', 30], ['carrots', 2], ['panko', 15]],
    why: ['Comfort food with a crunchy top', 'Carrots are cooked soft and blended into the cheese sauce, so you won’t find them'],
    steps: ['Simmer sliced carrots in the milk until very soft, then blend smooth.', 'Melt butter, whisk in flour, add the carrot milk and simmer until thick; stir in cheddar.', 'Mix with pasta cooked 2 minutes under, top with panko, and bake at 190°C for 20 minutes.'],
    reheat: 'Microwave 2 minutes with a splash of milk, stirring halfway, until steaming.', thaw: 'Move to the fridge the night before.',
    tasks: [{ t: 'Simmer carrots in milk and blend', l: 'stove', m: 15 }, { t: 'Boil pasta (2 minutes under)', l: 'stove', m: 10 }, { t: 'Make mac & cheese sauce and assemble', l: 'hands', m: 10 }, { t: 'Bake mac & cheese', l: 'oven', m: 20, temp: 190 }, { t: 'Portion mac & cheese', l: 'hands', m: 5, end: true }],
    kcal: 560, pro: 22, prod: 0.5, plate: 'About 350 g. Add a protein side, like string cheese or eggs, to round it out.',
  },
  burgerpasta: {
    name: 'Cheeseburger pasta skillet', short: 'Cheeseburger pasta', slot: 'Dinner', e: '🍔', serves: 4, fridge: 4, freezer: 2,
    foods: { beef: 1, pasta: 1, cheese: 1, onions: 'Finely chopped, cooked soft' },
    ing: [['beef', 450], ['pasta', 340], ['cheddar', 110], ['milk', 240], ['onion', 0.5], ['spices', 1]],
    why: ['Tastes like a cheeseburger, in a bowl', 'Onion is chopped fine and cooked soft'],
    steps: ['Brown the beef with finely chopped onion; drain.', 'Add pasta, milk and 500 ml water; simmer covered 12 minutes, stirring, until the pasta is tender.', 'Stir in cheddar until melted.'],
    reheat: 'Microwave 2–3 minutes with a splash of water until 74°C.', thaw: 'Move to the fridge the night before.',
    tasks: [{ t: 'Chop onion and brown beef', l: 'hands', m: 10 }, { t: 'Simmer cheeseburger pasta', l: 'stove', m: 15 }, { t: 'Portion cheeseburger pasta', l: 'hands', m: 5, end: true }],
    subs: [['ground beef', 'ground turkey', 'turkey']],
    kcal: 600, pro: 36, prod: 0.25, plate: 'About 350 g. A vegetable side covers produce.',
  },
  meatloaves: {
    name: 'Mini BBQ meatloaves & mashed potatoes', short: 'Mini meatloaves', slot: 'Dinner', e: '🥔', serves: 4, fridge: 4, freezer: 3,
    foods: { beef: 1, eggs: 'Baked into something', onions: 'Finely chopped, cooked soft', potatoes: 'Mashed' }, sauces: ['BBQ'],
    ing: [['beef', 570], ['panko', 30], ['eggs', 1], ['bbq', 120], ['onion', 0.25], ['potatoes', 910], ['milk', 120], ['butter', 40]],
    why: ['Comfort food with a sweet BBQ glaze', 'Baked in a muffin tin, so every portion is the same size'],
    steps: ['Mix beef, panko, egg and grated onion; press into 8 muffin cups and brush with BBQ sauce.', 'Bake at 200°C for 20 minutes, to 71°C inside.', 'Boil potatoes 15 minutes and mash with milk and butter.'],
    reheat: 'Microwave 2–3 minutes until 74°C.', thaw: 'Move to the fridge the night before.',
    tasks: [{ t: 'Mix and shape 8 mini meatloaves', l: 'hands', m: 12 }, { t: 'Bake mini meatloaves', l: 'oven', m: 20, temp: 200 }, { t: 'Boil potatoes for mash', l: 'stove', m: 18 }, { t: 'Mash potatoes and portion with meatloaves', l: 'hands', m: 8, end: true }],
    kcal: 580, pro: 34, prod: 0.25, plate: 'Two mini meatloaves with about 150 g mash.',
  },
  beanquesadilla: {
    name: 'Black bean & corn quesadillas', short: 'Bean & corn quesadillas', slot: 'Dinner', e: '🫘', serves: 4, fridge: 4, freezer: 2,
    foods: { beans: 1, corn: 1, cheese: 1 }, sauces: ['Mild salsa'],
    ing: [['beanscan', 1], ['corn', 150], ['cheddar', 170], ['tortillas', 4], ['salsa', 130], ['taco', 1]],
    why: ['A meat-free dinner that’s still cheesy and filling', 'Cooked fresh on the night, so it stays crisp'],
    note: 'Assembled on prep day; cook-fresh night: 6 minutes in the air fryer or a dry pan.',
    steps: ['Mash half the beans; stir in the rest with corn and taco seasoning.', 'Spread on half of each tortilla, add cheese, fold, and stack with parchment between them.', 'On the night: air-fry at 190°C for 6 minutes, or cook in a dry pan 2–3 minutes per side.'],
    reheat: 'Cooked fresh on the night, until the cheese melts and the filling is hot.', thaw: 'If frozen, move to the fridge the night before.',
    tasks: [{ t: 'Mash beans and assemble 4 quesadillas', l: 'hands', m: 12, end: true }],
    kcal: 520, pro: 22, prod: 1, plate: 'One quesadilla, cut in 4, with salsa.',
  },
  energybites: {
    name: 'No-bake chocolate oat bites', short: 'Chocolate oat bites', slot: 'Afternoon snack', e: '🍫', serves: 8, fridge: 7, freezer: 3,
    foods: { oats: 1 }, sweet: ['Chocolate'],
    ing: [['oats', 140], ['pb', 130], ['honey', 4], ['chips', 55], ['vanilla', 1]],
    why: ['Sweet, chewy and no oven needed', 'Peanut butter makes them more filling than a cookie'],
    steps: ['Stir oats, peanut butter, honey, vanilla and chips together.', 'Chill 30 minutes, then roll 16 bites.'],
    reheat: 'Eat cold from the fridge.', thaw: 'Frozen bites soften in 10 minutes.',
    tasks: [{ t: 'Mix chocolate oat bites', l: 'hands', m: 6 }, { t: 'Chill oat bite mixture', l: 'chill', m: 30 }, { t: 'Roll 16 oat bites', l: 'hands', m: 8, end: true }],
    kcal: 200, pro: 6, prod: 0, plate: 'Two bites.',
  },
  applepb: {
    name: 'Apple slices with peanut butter', short: 'Apple & peanut butter', slot: 'Afternoon snack', e: '🍏', serves: 4, fridge: 7, freezer: 0, room: true,
    foods: { apples: 1 },
    ing: [['apples', 4], ['pb', 130]],
    why: ['Crunchy, sweet and a fruit serving', 'Takes a minute to slice, so it never goes brown'],
    steps: ['Portion 2 tbsp (30 g) peanut butter into 4 small lidded cups.', 'Slice an apple when you eat it.'],
    reheat: 'Eat fresh.',
    tasks: [{ t: 'Portion 4 peanut butter cups', l: 'hands', m: 4, end: true }],
    kcal: 190, pro: 5, prod: 1, plate: 'One apple with 2 tbsp (30 g) peanut butter.',
  },
  pizzabites: {
    name: 'Tortilla pizza bites', short: 'Pizza bites', slot: 'Afternoon snack', e: '🍕', serves: 4, fridge: 4, freezer: 2,
    foods: { tomatoes: 'Blended into a sauce', cheese: 1 }, sauces: ['Marinara'],
    ing: [['tortillas', 3], ['marinara', 0.5], ['cheddar', 110]],
    why: ['Pizza flavor in a small, crispy snack', 'Marinara is smooth, with no tomato chunks'],
    steps: ['Cut tortillas into wedges, spread thinly with marinara and top with cheese.', 'Bake at 200°C for 8 minutes until crisp and bubbling. Cool and box.'],
    reheat: 'Air fryer 190°C for 3 minutes to re-crisp, or eat at room temperature.', thaw: 'Re-crisp straight from frozen: 5 minutes in the air fryer.',
    tasks: [{ t: 'Top tortilla wedges for pizza bites', l: 'hands', m: 8 }, { t: 'Bake pizza bites', l: 'oven', m: 8, temp: 200 }],
    kcal: 220, pro: 10, prod: 0.25, plate: 'Six wedges.',
  },
  cheesecake: {
    name: 'No-bake berry cheesecake cups', short: 'Cheesecake cup', slot: 'Evening sweet', e: '🍰', serves: 6, fridge: 4, freezer: 0, cold: true,
    foods: { cheese: 1, yogurt: 'Sweetened or flavored', berries: 1 }, sweet: ['Cheesecake', 'Fruit desserts'],
    ing: [['creamcheese', 230], ['yogurt', 250], ['sugar', 50], ['vanilla', 1], ['graham', 1], ['butter', 30], ['berries', 140]],
    why: ['Creamy cheesecake in a small, ready portion', 'Greek yogurt makes it lighter and adds protein'],
    steps: ['Crush graham crackers, mix with melted butter, and press into 6 small cups.', 'Beat cream cheese, yogurt, sugar and vanilla until smooth; spoon over the crusts.', 'Top with thawed berries and chill.'],
    reheat: 'Eat cold.',
    tasks: [{ t: 'Press graham crusts into 6 cups', l: 'hands', m: 6 }, { t: 'Beat cheesecake filling and fill cups', l: 'hands', m: 8, end: true }],
    kcal: 210, pro: 6, prod: 0.25, plate: 'One cup.',
  },
  bananabites: {
    name: 'Frozen chocolate banana bites', short: 'Choc banana bites', slot: 'Evening sweet', e: '🍌', serves: 6, fridge: 0, freezer: 2,
    foods: { bananas: 1 }, sweet: ['Chocolate', 'Fruit desserts'],
    ing: [['bananas', 3], ['chips', 85]],
    why: ['Tastes like chocolate ice cream bites', 'Mostly fruit, and already portioned'],
    steps: ['Slice bananas into coins and dip halfway in melted chocolate.', 'Freeze on a lined tray for 1 hour, then bag in 6 portions.'],
    reheat: 'Straight from the freezer; let them sit 2 minutes.',
    tasks: [{ t: 'Dip banana coins in chocolate', l: 'hands', m: 10 }, { t: 'Freeze banana bites', l: 'chill', m: 60 }],
    kcal: 120, pro: 1, prod: 0.5, plate: 'About 8 coins.',
  },
};

/** Sides are added to a meal to balance it. Slot 'Side' keeps them out of meal replacement. */
type SideInput = Omit<RecipeInput, 'slot' | 'serves' | 'fridge' | 'freezer' | 'steps' | 'reheat' | 'tasks' | 'plate'> &
  Partial<Pick<RecipeInput, 'fridge' | 'tasks'>> & { for: Slot[] };

const SIDES: Record<string, SideInput> = {
  side_yogurt: { name: 'Vanilla Greek yogurt cup', short: 'Greek yogurt cup', e: '🥛', kind: 'protein', best: ['Breakfast', 'Afternoon snack'], for: ['Breakfast', 'Afternoon snack'], foods: { yogurt: 'Sweetened or flavored' }, ing: [['yogurtcups', 1]], kcal: 140, pro: 15, prod: 0, st: { k: 'fridge', l: 'Store-bought · fridge' }, why: ['Sweetened, the way you like yogurt'] },
  side_eggs: { name: 'Two scrambled eggs', short: 'Scrambled eggs', e: '🍳', kind: 'protein', best: ['Breakfast'], for: ['Breakfast'], foods: { eggs: 'Scrambled' }, ing: [['eggs', 2]], kcal: 180, pro: 12, prod: 0, st: { k: 'fridge', l: 'Cook fresh · 3 min' }, why: ['Scrambled, one of the ways you eat eggs'] },
  side_cheese: { name: 'String cheese', short: 'String cheese', e: '🧀', kind: 'protein', best: ['Lunch', 'Afternoon snack'], for: ['Breakfast', 'Lunch', 'Afternoon snack'], foods: { cheese: 1 }, ing: [['stringcheese', 1]], kcal: 80, pro: 7, prod: 0, st: { k: 'fridge', l: 'Store-bought · fridge' }, why: [] },
  side_berries: { name: 'Bowl of berries', short: 'Berries', e: '🍓', kind: 'produce', for: ['Breakfast', 'Lunch', 'Afternoon snack'], foods: { berries: 1 }, ing: [['berries', 140]], kcal: 70, pro: 1, prod: 1, st: { k: 'freezer', l: 'Frozen bag · thaw in the fridge overnight' }, why: [] },
  side_apple: { name: 'Apple slices', short: 'Apple slices', e: '🍎', kind: 'produce', for: ['Lunch', 'Afternoon snack'], foods: { apples: 1 }, ing: [['apples', 1]], kcal: 95, pro: 0, prod: 1, st: { k: 'room', l: 'Slice fresh' }, why: [] },
  side_corn: { name: 'Buttered corn', short: 'Buttered corn', e: '🌽', kind: 'produce', veg: true, for: ['Lunch', 'Dinner'], foods: { corn: 1 }, ing: [['corn', 110], ['butter', 15]], kcal: 120, pro: 3, prod: 1, st: { k: 'freezer', l: 'Frozen · microwave 3 min' }, why: [] },
  side_greenbeans: { name: 'Air-fried green beans', short: 'Air-fried green beans', e: '🫛', kind: 'produce', veg: true, for: ['Lunch', 'Dinner'], foods: { greenbeans: 'Air-fried' }, ing: [['greenbeans', 120], ['oil', 0.33]], kcal: 60, pro: 2, prod: 1, st: { k: 'freezer', l: 'Frozen · air-fry 8 min, crispy' }, why: [] },
  side_broc: {
    name: 'Crispy parmesan broccoli', short: 'Crispy broccoli', e: '🥦', kind: 'produce', veg: true, for: ['Lunch', 'Dinner'], foods: { broccoli: 'Roasted until crispy', cheese: 1 },
    ing: [['broccoli', 0.5], ['parmesan', 6], ['oil', 0.5]], kcal: 110, pro: 5, prod: 1, fridge: 4,
    tasks: [{ t: 'Cut extra broccoli for sides', l: 'hands', m: 5 }, { t: 'Roast crispy broccoli for sides', l: 'oven', m: 20, temp: 220, pans: 1 }],
    why: ['Roasted until crispy, the way broccoli works for you'],
  },
  side_carrots: {
    name: 'Honey-roasted carrots', short: 'Roasted carrots', e: '🥕', kind: 'produce', veg: true, for: ['Lunch', 'Dinner'], foods: { carrots: 1 },
    ing: [['carrots', 2], ['honey', 1], ['oil', 0.5]], kcal: 90, pro: 1, prod: 1, fridge: 4,
    tasks: [{ t: 'Cut carrots for roasting', l: 'hands', m: 5 }, { t: 'Roast honey carrots for sides', l: 'oven', m: 25, temp: 220, pans: 1 }],
    why: [],
  },
  // Offered only as a one-time try (“Remy noticed”) when zucchini is rated Dislike; otherwise a normal side.
  side_zucchini: {
    name: 'Crispy parmesan zucchini fries', short: 'Zucchini fries', e: '🥒', kind: 'produce', veg: true, for: ['Lunch', 'Dinner'], foods: { zucchini: 'Air-fried', cheese: 1, eggs: 'Baked into something' },
    ing: [['zucchini', 1], ['panko', 15], ['parmesan', 6], ['eggs', 0.5], ['oil', 0.33]], kcal: 150, pro: 7, prod: 1, fridge: 3,
    tasks: [{ t: 'Cut zucchini into sticks and coat in egg, panko and parmesan', l: 'hands', m: 10 }],
    why: ['Air-fried until crispy, with parmesan'],
  },
};

export const R: Record<string, Recipe> = {};
for (const [id, r] of Object.entries(MEALS)) R[id] = { id, ...r };
for (const [id, s] of Object.entries(SIDES)) {
  R[id] = { id, slot: 'Side', side: true, serves: 1, fridge: 0, freezer: 0, steps: [], reheat: '', tasks: [], plate: '', ...s };
}

export const SIDE_IDS = Object.keys(SIDES);
export const MEAL_IDS = Object.keys(MEALS);

/**
 * Recipes created by the AI live in the user's saved data, not in this file.
 * Register them so every lookup (R, MEAL_IDS) finds them; ids not in `saved` are removed.
 */
export function registerAiRecipes(saved: Record<string, Recipe>): void {
  for (const id of Object.keys(R)) if (id.startsWith('ai_') && !saved[id]) delete R[id];
  for (let i = MEAL_IDS.length - 1; i >= 0; i--) if (MEAL_IDS[i].startsWith('ai_') && !saved[MEAL_IDS[i]]) MEAL_IDS.splice(i, 1);
  for (const [id, r] of Object.entries(saved)) {
    R[id] = r;
    if (!MEAL_IDS.includes(id)) MEAL_IDS.push(id);
  }
}
