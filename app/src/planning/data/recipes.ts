import type { Recipe, Slot } from '../types';

type RecipeInput = Omit<Recipe, 'id'>;

/**
 * Curated recipe library. Nutrition values (kcal, pro, prod) are rough per-portion
 * estimates; a later phase should source them from USDA FoodData Central.
 */
const MEALS: Record<string, RecipeInput> = {
  /* ---------- breakfast ---------- */
  oats: {
    name: 'Chocolate overnight oats', short: 'Chocolate oats', slot: 'Breakfast', e: '🥣', serves: 4, fridge: 4, freezer: 0, cold: true,
    foods: { oats: 1, yogurt: 'Sweetened or flavored', bananas: 1 }, sweet: ['Chocolate'],
    ing: [['oats', 2], ['milk', 2], ['yogurt', 1], ['cocoa', 3], ['honey', 3], ['bananas', 2]],
    why: ['Sweet breakfast, which is what you said you prefer', 'Chocolate, the sweet you find most satisfying', 'Greek yogurt only in its sweetened form, the way you like it'],
    steps: ['Mash the bananas in a large bowl.', 'Stir in oats, milk, yogurt, cocoa and honey until no dry oats remain.', 'Divide between 4 jars, lid and refrigerate.'],
    reheat: 'Eat cold, straight from the fridge. If you want it warm, microwave 60–90 seconds and stir.',
    tasks: [{ t: 'Stir together 4 chocolate overnight-oat jars', l: 'hands', m: 8, end: true }],
    subs: [['milk', 'any milk you like'], ['bananas', '2 tbsp maple syrup, if bananas get old']],
    kcal: 360, pro: 16, prod: 0.5, plate: 'One jar is one portion.',
  },
  pancakes: {
    name: 'Sheet-pan banana pancakes', short: 'Sheet-pan pancakes', slot: 'Breakfast', e: '🥞', serves: 8, fridge: 3, freezer: 2,
    foods: { bananas: 1, eggs: 'Baked into something' }, sweet: ['Chocolate'],
    ing: [['flour', 2], ['eggs', 2], ['milk', 1.5], ['bananas', 2], ['bakingpowder', 3], ['sugar', 0.25], ['chips', 0.33], ['butter', 2]],
    why: ['Pancakes are on your favorites list', 'Freezes well, so Thursday–Sunday breakfasts stay fresh', 'Bakes on one pan instead of flipping at the stove'],
    steps: ['Heat oven to 425°F / 220°C. Line a sheet pan with parchment and brush with melted butter.', 'Whisk flour, sugar and baking powder. Add eggs, milk and mashed banana; stir until just combined.', 'Pour onto the pan, scatter chocolate chips, bake 13–15 minutes until golden.', 'Cool, cut into 16 squares, and bag in pairs.'],
    reheat: 'From frozen: toaster on low for 2 cycles, or microwave 45–60 seconds.', thaw: 'No thawing needed.',
    tasks: [{ t: 'Whisk sheet-pan pancake batter', l: 'hands', m: 10 }, { t: 'Bake sheet-pan pancakes', l: 'oven', m: 15, temp: 425 }, { t: 'Cut pancakes into 16 squares, bag in pairs', l: 'hands', m: 8, end: true }],
    subs: [['chocolate chips', 'berries', 'berries']],
    kcal: 340, pro: 9, prod: 0.25, plate: 'Two squares are one portion.',
  },
  eggbites: {
    name: 'Cheesy egg & potato bites', short: 'Egg & potato bites', slot: 'Breakfast', e: '🧁', serves: 6, fridge: 4, freezer: 2,
    foods: { eggs: 'Baked into something', potatoes: 1, cheese: 1 },
    ing: [['eggs', 8], ['potatoes', 1], ['cheddar', 1], ['milk', 0.25]],
    why: ['Eggs baked into something, one of the ways you said works', 'Cheese and potatoes, both rated Love'],
    steps: ['Heat oven to 375°F / 190°C and grease a 12-cup muffin tin.', 'Grate potato, squeeze dry, and divide between cups with the cheese.', 'Whisk eggs with milk and pour over. Bake 20–22 minutes.'],
    reheat: 'Microwave 45–60 seconds until hot in the center.', thaw: 'Move to the fridge the night before, or microwave from frozen for 90 seconds.',
    tasks: [{ t: 'Grate potato and whisk eggs for egg bites', l: 'hands', m: 10 }, { t: 'Bake egg & potato bites', l: 'oven', m: 22, temp: 375 }, { t: 'Cool and box egg bites', l: 'hands', m: 4, end: true }],
    kcal: 290, pro: 17, prod: 0, plate: 'Two bites are one portion.',
  },
  parfait: {
    name: 'Berry yogurt parfait jars', short: 'Berry parfaits', slot: 'Breakfast', e: '🍓', serves: 3, fridge: 3, freezer: 0, cold: true,
    foods: { yogurt: 'Sweetened or flavored', berries: 1 },
    ing: [['yogurt', 1.5], ['berries', 1.5], ['honey', 2]],
    why: ['Berries are a Love for you', 'Vanilla yogurt, the sweetened kind you’ll eat'],
    steps: ['Layer yogurt, berries and a drizzle of honey in 3 jars.', 'Keep the crunchy topping separate so it stays crisp.'],
    reheat: 'Eat cold.', tasks: [{ t: 'Layer 3 berry parfait jars', l: 'hands', m: 6, end: true }],
    kcal: 250, pro: 15, prod: 1, plate: 'One jar is one portion.',
  },

  /* ---------- lunch ---------- */
  teriyaki: {
    name: 'Teriyaki chicken rice bowls', short: 'Teriyaki bowl', slot: 'Lunch', e: '🍱', serves: 3, fridge: 4, freezer: 0,
    foods: { chicken: 1, rice: 1, broccoli: 'Roasted until crispy', carrots: 1 }, sauces: ['Teriyaki'],
    ing: [['thighs', 1.25], ['rice', 1], ['broccoli', 2], ['carrots', 3], ['teriyaki', 0.5], ['oil', 1]],
    why: ['Chicken and rice, both rated Love', 'Teriyaki is on your sauce list', 'Broccoli roasted until crispy, the one way you said works'],
    note: 'Not frozen: the broccoli softens after freezing, and you said mushy is a no.',
    steps: ['Toss chicken with half the teriyaki sauce.', 'Cut broccoli into small florets and carrots into coins; toss with oil and salt.', 'Roast chicken and vegetables on 2 pans at 425°F / 220°C for 22–25 minutes, until the broccoli edges are crisp and chicken reaches 165°F / 74°C.', 'Slice chicken, brush with the remaining sauce, and portion with rice into 3 containers.'],
    reheat: 'Microwave 2–3 minutes, stirring halfway, until steaming (165°F / 74°C). Sprinkle a teaspoon of water over the rice first.',
    tasks: [{ t: 'Cook rice for bowls and burritos', l: 'stove', m: 20, key: 'rice' }, { t: 'Marinate chicken in teriyaki sauce', l: 'hands', m: 6 }, { t: 'Cut broccoli and carrots for roasting', l: 'hands', m: 10 }, { t: 'Roast teriyaki chicken + crispy broccoli & carrots (2 pans)', l: 'oven', m: 25, temp: 425, pans: 2 }, { t: 'Portion 3 teriyaki bowls', l: 'hands', m: 8, end: true }],
    subs: [['chicken thighs', 'turkey', 'turkey'], ['broccoli', 'green beans', 'greenbeans'], ['jasmine rice', 'pasta', 'pasta']],
    kcal: 540, pro: 38, prod: 1.5, plate: 'In each container: half chicken and crispy vegetables, a quarter rice (about ¾ cup cooked).',
  },
  burritos: {
    name: 'Freezer chicken & cheese burritos', short: 'Chicken burritos', slot: 'Lunch', e: '🌯', serves: 4, fridge: 3, freezer: 3,
    foods: { chicken: 1, rice: 1, cheese: 1, corn: 1 }, sauces: ['Mild salsa'],
    ing: [['tortillas', 4], ['thighs', 1.25], ['rice', 0.75], ['cheddar', 1.5], ['salsa', 0.75], ['taco', 2], ['corn', 1]],
    why: ['A take-anywhere version of your favorite chicken burrito bowl', 'Freezes well, so Thursday–Sunday lunches stay safe', 'Mild salsa matches your spice level'],
    steps: ['Season chicken with taco seasoning and roast at 425°F / 220°C for 20–22 minutes.', 'Shred chicken and mix with rice, corn and salsa.', 'Fill each tortilla with filling and cheese, roll tightly, wrap in foil, freeze flat.'],
    reheat: 'From frozen: remove foil, wrap in a damp paper towel, microwave 2 minutes, flip, then 1–2 minutes more until 165°F / 74°C in the center.', thaw: 'Optional: move to the fridge the night before for a 90-second reheat.',
    tasks: [{ t: 'Cook rice for bowls and burritos', l: 'stove', m: 20, key: 'rice' }, { t: 'Season chicken with mild taco spices', l: 'hands', m: 5, key: 'tacoprep' }, { t: 'Roast taco chicken', l: 'oven', m: 22, temp: 425, key: 'tacochicken' }, { t: 'Shred chicken; roll and foil-wrap 4 burritos', l: 'hands', m: 15, end: true }],
    subs: [['chicken thighs', 'ground beef', 'beef'], ['corn', 'leave it out']],
    kcal: 560, pro: 32, prod: 0.5, plate: 'One burrito is one portion. A fruit or corn side covers produce.',
  },
  bbqbowl: {
    name: 'BBQ chicken & cheesy rice bowls', short: 'BBQ chicken bowl', slot: 'Lunch', e: '🍗', serves: 3, fridge: 4, freezer: 3,
    foods: { chicken: 1, rice: 1, cheese: 1, corn: 1 }, sauces: ['BBQ'],
    ing: [['thighs', 1.25], ['rice', 1], ['bbq', 0.5], ['cheddar', 0.75], ['corn', 1]],
    why: ['BBQ is one of your sauces, and you like smoky flavors', 'Chicken, rice and cheese: all rated Love'],
    steps: ['Roast chicken at 425°F / 220°C for 22 minutes, then toss in BBQ sauce.', 'Stir cheese into hot rice. Portion with chicken and corn.'],
    reheat: 'Microwave 2–3 minutes until 165°F / 74°C.', thaw: 'Move to the fridge the night before.',
    tasks: [{ t: 'Cook rice for BBQ bowls', l: 'stove', m: 20, key: 'rice' }, { t: 'Roast chicken for BBQ bowls', l: 'oven', m: 22, temp: 425 }, { t: 'Toss chicken in BBQ sauce and portion 3 bowls', l: 'hands', m: 8, end: true }],
    kcal: 560, pro: 36, prod: 0.5, plate: 'In each container: chicken and corn on one side, about ¾ cup cheesy rice on the other.',
  },
  beefbroc: {
    name: 'Beef & broccoli stir-fry', short: 'Beef & broccoli', slot: 'Lunch', e: '🥡', serves: 3, fridge: 4, freezer: 2,
    foods: { beef: 1, broccoli: 'Steamed', rice: 1 },
    ing: [['flank', 1], ['broccoli', 2], ['oyster', 3], ['soy', 2], ['rice', 1], ['garlic', 2]],
    why: ['Beef and rice are on your list'],
    steps: ['Slice beef thinly against the grain.', 'Sear beef in a hot pan, remove, then steam-fry broccoli with garlic.', 'Return the beef, add oyster and soy sauce, toss 1 minute, and portion with rice.'],
    reheat: 'Microwave 2–3 minutes until 165°F / 74°C.', thaw: 'Move to the fridge the night before.',
    tasks: [{ t: 'Cook rice for stir-fry bowls', l: 'stove', m: 20, key: 'rice' }, { t: 'Slice beef and cut broccoli', l: 'hands', m: 10 }, { t: 'Stir-fry beef and broccoli', l: 'stove', m: 15 }, { t: 'Portion 3 stir-fry bowls', l: 'hands', m: 6, end: true }],
    kcal: 520, pro: 34, prod: 1.5, plate: 'In each container: half beef and broccoli, a quarter rice.',
  },

  /* ---------- dinner ---------- */
  spaghetti: {
    name: 'Hidden-veggie spaghetti with meat sauce', short: 'Spaghetti & meat sauce', slot: 'Dinner', e: '🍝', serves: 4, fridge: 4, freezer: 3,
    foods: { beef: 1, pasta: 1, spinach: 'Blended into a sauce', carrots: 1, onions: 'Blended into a sauce', tomatoes: 'Blended into a sauce', cheese: 1 }, sauces: ['Marinara'],
    ing: [['beef', 1.25], ['marinara', 1], ['spinach', 2], ['carrots', 1], ['onion', 0.5], ['spaghetti', 1], ['parmesan', 0.5]],
    why: ['Spaghetti with meat sauce is on your favorites list', 'Spinach, carrot and onion are blended smooth. You said hidden is fine', 'Marinara is one of your sauces'],
    note: 'Sauce and pasta are stored separately so the pasta doesn’t go mushy.',
    steps: ['Blend marinara with spinach, carrot and onion until completely smooth.', 'Brown the beef, drain, add the blended sauce and simmer 25 minutes.', 'Cook spaghetti 1 minute less than the package says, drain, toss with a little oil.', 'Portion sauce and pasta into separate containers.'],
    reheat: 'Microwave sauce 2 minutes, stir, add pasta and heat 1 more minute until steaming (165°F / 74°C). Top with parmesan.', thaw: 'Move frozen sauce to the fridge the night before. Never thaw on the counter.',
    tasks: [{ t: 'Blend marinara with spinach, carrot and onion', l: 'hands', m: 6 }, { t: 'Brown beef and add blended sauce', l: 'hands', m: 10 }, { t: 'Simmer meat sauce', l: 'stove', m: 25 }, { t: 'Boil spaghetti (1 minute under)', l: 'stove', m: 12 }, { t: 'Portion sauce + pasta; 1 sauce to the freezer', l: 'hands', m: 6, end: true }],
    subs: [['ground beef', 'ground turkey', 'turkey'], ['spaghetti', 'any pasta shape']],
    kcal: 590, pro: 33, prod: 1, plate: 'About 1 cup cooked pasta with 1 cup sauce. The vegetables are already in the sauce.',
  },
  tenders: {
    name: 'Crispy parmesan chicken tenders & potato wedges', short: 'Crispy tenders & wedges', slot: 'Dinner', e: '🍟', serves: 2, fridge: 1, freezer: 3,
    foods: { chicken: 1, potatoes: 1, cheese: 1 }, sauces: ['Honey mustard', 'Ranch'],
    ing: [['tenders', 1], ['panko', 1], ['parmesan', 0.5], ['eggs', 1], ['potatoes', 1.25], ['oil', 2], ['honeymustard', 0.25]],
    why: ['Chicken tenders are on your favorites list', 'Air-fried fresh, because you said crispy food reheats badly', 'Honey mustard for dipping, one of your sauces'],
    note: 'Tenders are breaded and frozen raw, then air-fried fresh in 14 minutes. Wedges keep 4 days in the fridge and re-crisp in the air fryer.',
    steps: ['Dip tenders in beaten egg, then in panko mixed with parmesan.', 'Freeze in a single layer on a lined tray for 1 hour, then bag.', 'Cut potatoes into wedges, toss with oil and salt, roast at 425°F / 220°C for 30 minutes.'],
    reheat: 'Air fryer at 400°F / 200°C: tenders from frozen 12–14 minutes, flipping once, until 165°F / 74°C inside. Add wedges for the last 5 minutes.', thaw: 'No thawing: cook tenders straight from frozen.',
    tasks: [{ t: 'Bread chicken tenders (egg, then panko + parmesan)', l: 'hands', m: 16 }, { t: 'Flash-freeze tenders on a lined tray', l: 'chill', m: 60 }, { t: 'Cut and season potato wedges', l: 'hands', m: 8 }, { t: 'Roast potato wedges', l: 'oven', m: 30, temp: 425 }, { t: 'Bag frozen tenders; box wedges', l: 'hands', m: 4, end: true }],
    subs: [['panko', 'crushed crackers'], ['honey mustard', 'ranch or BBQ']],
    kcal: 650, pro: 50, prod: 0, plate: 'About 4 tenders and a handful of wedges. A vegetable side rounds it out.',
  },
  quesadilla: {
    name: 'Cheesy chicken quesadillas', short: 'Chicken quesadillas', slot: 'Dinner', e: '🫓', serves: 2, fridge: 3, freezer: 3,
    foods: { chicken: 1, cheese: 1 }, sauces: ['Mild salsa'],
    ing: [['thighs', 0.75], ['tortillas', 2], ['cheddar', 1], ['salsa', 0.25], ['taco', 1]],
    why: ['Reuses the taco chicken, so it doesn’t feel like leftovers', 'Cheesy and mild, two things you picked'],
    note: 'Cook-fresh night: 8 minutes in a pan or air fryer.',
    steps: ['Fill a tortilla with taco chicken and cheese, fold.', 'Cook in a dry pan 2–3 minutes per side, or air-fry 6 minutes at 375°F / 190°C.'],
    reheat: 'Cooked fresh on the night.', thaw: 'Move the bag of taco chicken to the fridge the night before.',
    tasks: [{ t: 'Season chicken with mild taco spices', l: 'hands', m: 5, key: 'tacoprep' }, { t: 'Roast taco chicken', l: 'oven', m: 22, temp: 425, key: 'tacochicken' }, { t: 'Bag taco chicken for quesadillas; freeze', l: 'hands', m: 3, end: true }],
    kcal: 540, pro: 34, prod: 0, plate: 'One large quesadilla, cut into 4, with salsa.',
  },
  meatballs: {
    name: 'Turkey meatballs in marinara', short: 'Turkey meatballs', slot: 'Dinner', e: '🧆', serves: 4, fridge: 4, freezer: 3,
    foods: { turkey: 1, pasta: 1, tomatoes: 'Blended into a sauce', cheese: 1 }, sauces: ['Marinara'],
    ing: [['turkey', 1.25], ['marinara', 1], ['parmesan', 0.33], ['eggs', 1], ['panko', 0.5], ['spaghetti', 0.5]],
    why: ['Marinara is one of your sauces', 'Turkey is rated Okay; parmesan and sauce make it familiar'],
    steps: ['Mix turkey, egg, panko and parmesan; roll 16 meatballs.', 'Bake at 400°F / 200°C for 18 minutes, then simmer in marinara 10 minutes.'],
    reheat: 'Microwave 2–3 minutes until 165°F / 74°C.', thaw: 'Move to the fridge the night before.',
    tasks: [{ t: 'Roll 16 turkey meatballs', l: 'hands', m: 15 }, { t: 'Bake meatballs', l: 'oven', m: 18, temp: 400 }, { t: 'Simmer meatballs in marinara', l: 'stove', m: 10 }, { t: 'Portion meatballs', l: 'hands', m: 5, end: true }],
    kcal: 520, pro: 36, prod: 0.5, plate: '4 meatballs with about ¾ cup pasta and sauce.',
  },
  shrimp: {
    name: 'Garlic butter shrimp & rice', short: 'Garlic shrimp', slot: 'Dinner', e: '🍤', serves: 3, fridge: 3, freezer: 0,
    foods: { rice: 1 },
    ing: [['shrimp', 1], ['butter', 3], ['garlic', 3], ['rice', 1]],
    why: ['Mild, buttery and quick'],
    note: 'Shrimp turns rubbery when frozen after cooking, so this stays in the fridge and is eaten early in the week.',
    steps: ['Melt butter with sliced garlic over medium heat.', 'Add shrimp and cook 2 minutes per side until pink and opaque.', 'Portion over rice.'],
    reheat: 'Microwave 90 seconds, just until hot (165°F / 74°C). Longer makes shrimp tough.',
    tasks: [{ t: 'Cook rice for shrimp bowls', l: 'stove', m: 20, key: 'rice' }, { t: 'Cook garlic butter shrimp', l: 'stove', m: 10 }, { t: 'Portion 3 shrimp bowls', l: 'hands', m: 5, end: true }],
    kcal: 480, pro: 30, prod: 0, plate: 'About 5 oz shrimp with ¾ cup rice.',
  },
  salmon: {
    name: 'Honey-soy glazed salmon', short: 'Honey-soy salmon', slot: 'Dinner', e: '🐟', serves: 3, fridge: 3, freezer: 2,
    foods: { salmon: 1, rice: 1 },
    ing: [['salmon', 1], ['soy', 3], ['honey', 2], ['rice', 1]],
    why: ['Sweet-savory glaze'],
    steps: ['Whisk soy sauce and honey.', 'Brush over salmon and roast at 425°F / 220°C for 12–14 minutes, until it flakes.', 'Portion with rice.'],
    reheat: 'Microwave at half power 2 minutes, or eat cold over rice.', thaw: 'Move to the fridge the night before.',
    tasks: [{ t: 'Cook rice for salmon bowls', l: 'stove', m: 20, key: 'rice' }, { t: 'Glaze salmon', l: 'hands', m: 5 }, { t: 'Roast salmon', l: 'oven', m: 14, temp: 425 }, { t: 'Portion 3 salmon bowls', l: 'hands', m: 5, end: true }],
    kcal: 510, pro: 34, prod: 0, plate: 'One fillet with ¾ cup rice.',
  },
  chili: {
    name: 'Mild beef & bean chili', short: 'Beef & bean chili', slot: 'Dinner', e: '🍲', serves: 4, fridge: 4, freezer: 3,
    foods: { beef: 1, beans: 1, tomatoes: 1, onions: 'Finely chopped, cooked soft' },
    ing: [['beef', 1], ['beanscan', 2], ['marinara', 1], ['onion', 1]],
    why: ['Mild and hearty; freezes well'],
    steps: ['Soften finely chopped onion, then brown the beef.', 'Add beans and sauce, simmer 30 minutes.', 'Cool and portion into 4 containers.'],
    reheat: 'Microwave 2–3 minutes, stirring halfway, until 165°F / 74°C.', thaw: 'Move to the fridge the night before.',
    tasks: [{ t: 'Chop onion and brown beef', l: 'hands', m: 10 }, { t: 'Simmer chili', l: 'stove', m: 35 }, { t: 'Portion chili', l: 'hands', m: 5, end: true }],
    kcal: 500, pro: 32, prod: 1.5, plate: 'About 1½ cups.',
  },

  /* ---------- snacks ---------- */
  snackbox: {
    name: 'Cheese, crackers & grapes snack boxes', short: 'Snack boxes', slot: 'Afternoon snack', e: '🧀', serves: 5, fridge: 5, freezer: 0, cold: true,
    foods: { cheese: 1, grapes: 1 },
    ing: [['cheeseblock', 8], ['crackers', 1], ['grapes', 1.5]],
    why: ['Crunchy, cheesy and sweet, all three of your snack picks', 'No cooking, so it adds 10 minutes of packing, not cooking'],
    steps: ['Cube the cheese and wash the grapes.', 'Pack cheese and grapes in 5 small containers; keep crackers in a separate bag so they stay crunchy.'],
    reheat: 'Eat cold.', tasks: [{ t: 'Pack 5 snack boxes: cheese cubes and grapes', l: 'hands', m: 10, end: true }],
    kcal: 230, pro: 9, prod: 1, plate: 'One box.',
  },
  popcorn: {
    name: 'Kettle-style popcorn', short: 'Kettle popcorn', slot: 'Afternoon snack', e: '🍿', serves: 2, fridge: 7, freezer: 0, room: true,
    foods: {}, ing: [['popcorn', 0.5], ['sugar', 0.125], ['oil', 1]],
    why: ['Crunchy and a little sweet', 'Keeps a week in an airtight bag at room temperature'],
    steps: ['Heat oil in a large lidded pot, add kernels and sugar, shake constantly until popping slows.', 'Spread to cool, salt lightly, and bag in 2 portions.'],
    reheat: 'Eat at room temperature.', tasks: [{ t: 'Pop kettle corn and bag 2 portions', l: 'stove', m: 8 }],
    kcal: 160, pro: 3, prod: 0, plate: 'One bag, about 3 cups.',
  },
  pretzels: {
    name: 'Chocolate-dipped pretzels', short: 'Chocolate pretzels', slot: 'Afternoon snack', e: '🥨', serves: 5, fridge: 7, freezer: 0, room: true,
    foods: {}, sweet: ['Chocolate'], ing: [['pretzels', 1], ['chips', 0.5]],
    why: ['Crunchy plus chocolate'], steps: ['Melt chips in 20-second bursts, dip pretzels, set on parchment.'], reheat: 'Room temperature.',
    tasks: [{ t: 'Dip pretzels in chocolate', l: 'hands', m: 10 }],
    kcal: 180, pro: 3, prod: 0, plate: 'About 10 pretzels.',
  },

  /* ---------- sweets ---------- */
  brownies: {
    name: 'Fudgy one-bowl brownies', short: 'Brownie square', slot: 'Evening sweet', e: '🍫', serves: 12, fridge: 5, freezer: 3,
    foods: { eggs: 'Baked into something' }, sweet: ['Brownies', 'Chocolate'],
    ing: [['butter', 8], ['sugar', 1], ['cocoa', 8], ['eggs', 2], ['flour', 0.5], ['chips', 0.5], ['vanilla', 1]],
    why: ['Brownies are one of your favorite desserts', 'A real dessert in a moderate portion: 12 small squares, one per serving', 'Pre-portioned, as you asked, so there’s nothing to decide at night'],
    steps: ['Heat oven to 350°F / 175°C. Melt butter, stir in sugar and cocoa.', 'Beat in eggs and vanilla, fold in flour and chips.', 'Bake in a lined 8-inch pan for 22–25 minutes. Cool fully, cut 12 squares.'],
    reheat: 'Eat as is, or 10 seconds in the microwave.', thaw: 'Frozen squares thaw on the counter in about 20 minutes.',
    tasks: [{ t: 'Mix one-bowl brownie batter', l: 'hands', m: 12 }, { t: 'Bake brownies', l: 'oven', m: 25, temp: 350 }, { t: 'Cut 12 brownie squares; wrap extras for the freezer', l: 'hands', m: 6, end: true }],
    subs: [['chocolate chips', 'leave them out for a lighter square']],
    kcal: 190, pro: 3, prod: 0, plate: 'One small square.',
  },
  bark: {
    name: 'Chocolate-berry frozen yogurt bark', short: 'Froyo bark', slot: 'Evening sweet', e: '🍧', serves: 6, fridge: 0, freezer: 2,
    foods: { yogurt: 'Sweetened or flavored', berries: 1 }, sweet: ['Chocolate', 'Ice cream'],
    ing: [['yogurt', 2], ['honey', 2], ['cocoa', 1], ['berries', 1], ['chips', 0.25]],
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
    ing: [['yogurt', 2], ['cocoa', 4], ['honey', 3], ['chips', 0.25]],
    why: ['Chocolatey, creamy and cold', 'Sweetened yogurt, the form you like'],
    steps: ['Whisk yogurt, cocoa and honey until silky. Spoon into 4 cups, top with chips.'], reheat: 'Eat cold.',
    tasks: [{ t: 'Whisk and portion 4 mousse cups', l: 'hands', m: 7, end: true }],
    kcal: 170, pro: 10, prod: 0, plate: 'One cup.',
  },
  cookies: {
    name: 'Freezer chocolate-chip cookie dough', short: 'Fresh-baked cookie', slot: 'Evening sweet', e: '🍪', serves: 12, fridge: 0, freezer: 3,
    foods: { eggs: 'Baked into something' }, sweet: ['Cookies', 'Chocolate'],
    ing: [['butter', 8], ['sugar', 0.75], ['eggs', 1], ['flour', 1.5], ['chips', 1], ['vanilla', 1]],
    why: ['Cookies are one of your favorite sweets', 'Bake 1–2 at a time in the air fryer, so there’s no whole batch sitting around'],
    steps: ['Mix dough, scoop 12 balls onto a tray and freeze.'], reheat: 'Air fryer 320°F / 160°C for 8–9 minutes from frozen.',
    tasks: [{ t: 'Mix cookie dough and scoop 12 balls', l: 'hands', m: 14 }, { t: 'Freeze dough balls', l: 'chill', m: 60 }],
    kcal: 170, pro: 2, prod: 0, plate: 'One cookie.',
  },
};

/** Sides are added to a meal to balance it. Slot 'Side' keeps them out of meal replacement. */
type SideInput = Omit<RecipeInput, 'slot' | 'serves' | 'fridge' | 'freezer' | 'steps' | 'reheat' | 'tasks' | 'plate'> &
  Partial<Pick<RecipeInput, 'fridge' | 'tasks'>> & { for: Slot[] };

const SIDES: Record<string, SideInput> = {
  side_yogurt: { name: 'Vanilla Greek yogurt cup', short: 'Greek yogurt cup', e: '🥛', kind: 'protein', best: ['Breakfast', 'Afternoon snack'], for: ['Breakfast', 'Afternoon snack'], foods: { yogurt: 'Sweetened or flavored' }, ing: [['yogurtcups', 1]], kcal: 140, pro: 15, prod: 0, st: { k: 'fridge', l: 'Store-bought · fridge' }, why: ['Sweetened, the way you like yogurt'] },
  side_eggs: { name: 'Two scrambled eggs', short: 'Scrambled eggs', e: '🍳', kind: 'protein', best: ['Breakfast'], for: ['Breakfast'], foods: { eggs: 'Scrambled' }, ing: [['eggs', 2]], kcal: 180, pro: 12, prod: 0, st: { k: 'fridge', l: 'Cook fresh · 3 min' }, why: ['Scrambled, one of the ways you eat eggs'] },
  side_cheese: { name: 'String cheese', short: 'String cheese', e: '🧀', kind: 'protein', best: ['Lunch', 'Afternoon snack'], for: ['Breakfast', 'Lunch', 'Afternoon snack'], foods: { cheese: 1 }, ing: [['stringcheese', 1]], kcal: 80, pro: 7, prod: 0, st: { k: 'fridge', l: 'Store-bought · fridge' }, why: [] },
  side_berries: { name: 'Bowl of berries', short: 'Berries', e: '🍓', kind: 'produce', for: ['Breakfast', 'Lunch', 'Afternoon snack'], foods: { berries: 1 }, ing: [['berries', 1]], kcal: 70, pro: 1, prod: 1, st: { k: 'freezer', l: 'Frozen bag · thaw in the fridge overnight' }, why: [] },
  side_apple: { name: 'Apple slices', short: 'Apple slices', e: '🍎', kind: 'produce', for: ['Lunch', 'Afternoon snack'], foods: { apples: 1 }, ing: [['apples', 1]], kcal: 95, pro: 0, prod: 1, st: { k: 'room', l: 'Slice fresh' }, why: [] },
  side_corn: { name: 'Buttered corn', short: 'Buttered corn', e: '🌽', kind: 'produce', veg: true, for: ['Lunch', 'Dinner'], foods: { corn: 1 }, ing: [['corn', 0.75], ['butter', 1]], kcal: 120, pro: 3, prod: 1, st: { k: 'freezer', l: 'Frozen · microwave 3 min' }, why: [] },
  side_greenbeans: { name: 'Air-fried green beans', short: 'Air-fried green beans', e: '🫛', kind: 'produce', veg: true, for: ['Lunch', 'Dinner'], foods: { greenbeans: 'Air-fried' }, ing: [['greenbeans', 1], ['oil', 0.33]], kcal: 60, pro: 2, prod: 1, st: { k: 'freezer', l: 'Frozen · air-fry 8 min, crispy' }, why: [] },
  side_broc: {
    name: 'Crispy parmesan broccoli', short: 'Crispy broccoli', e: '🥦', kind: 'produce', veg: true, for: ['Lunch', 'Dinner'], foods: { broccoli: 'Roasted until crispy', cheese: 1 },
    ing: [['broccoli', 0.5], ['parmesan', 0.0625], ['oil', 0.5]], kcal: 110, pro: 5, prod: 1, fridge: 4,
    tasks: [{ t: 'Cut extra broccoli for sides', l: 'hands', m: 5 }, { t: 'Roast crispy broccoli for sides', l: 'oven', m: 20, temp: 425, pans: 1 }],
    why: ['Roasted until crispy, the way broccoli works for you'],
  },
  side_carrots: {
    name: 'Honey-roasted carrots', short: 'Roasted carrots', e: '🥕', kind: 'produce', veg: true, for: ['Lunch', 'Dinner'], foods: { carrots: 1 },
    ing: [['carrots', 2], ['honey', 1], ['oil', 0.5]], kcal: 90, pro: 1, prod: 1, fridge: 4,
    tasks: [{ t: 'Cut carrots for roasting', l: 'hands', m: 5 }, { t: 'Roast honey carrots for sides', l: 'oven', m: 25, temp: 425, pans: 1 }],
    why: [],
  },
  // Offered only as a one-time try (“Remy noticed”) when zucchini is rated Dislike; otherwise a normal side.
  side_zucchini: {
    name: 'Crispy parmesan zucchini fries', short: 'Zucchini fries', e: '🥒', kind: 'produce', veg: true, for: ['Lunch', 'Dinner'], foods: { zucchini: 'Air-fried', cheese: 1 },
    ing: [['zucchini', 1], ['panko', 0.25], ['parmesan', 0.0625], ['eggs', 0.5], ['oil', 0.33]], kcal: 150, pro: 7, prod: 1, fridge: 3,
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
