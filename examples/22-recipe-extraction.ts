// Recipe extraction — parse blog-style recipe posts into structured data
// Run: OPENAI_API_KEY=... npx tsx examples/22-recipe-extraction.ts

import OpenAI from "openai";
import { z } from "zod";
import { generate } from "../src/index.js";

const client = new OpenAI();

const RecipeSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  servings: z.number().int().optional(),
  prepTimeMinutes: z.number().optional(),
  cookTimeMinutes: z.number().optional(),
  totalTimeMinutes: z.number().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  cuisine: z.string().optional(),
  dietaryTags: z.array(z.string()).describe("e.g. vegan, gluten-free, keto"),
  ingredients: z.array(
    z.object({
      quantity: z.string().optional(),
      unit: z.string().optional(),
      name: z.string(),
      notes: z.string().optional(),
    })
  ),
  instructions: z.array(
    z.object({
      step: z.number().int(),
      instruction: z.string(),
      tip: z.string().optional(),
    })
  ),
  nutritionPer100g: z
    .object({
      calories: z.number().optional(),
      proteinG: z.number().optional(),
      carbsG: z.number().optional(),
      fatG: z.number().optional(),
    })
    .optional(),
});

const blogPost = `
The Best Homemade Shakshuka (30-Minute One-Pan Meal!)

Oh my goodness, I've been making this recipe every Sunday for years and it never gets old.
If you don't know shakshuka, it's a North African/Middle Eastern dish of eggs poached
in a spiced tomato sauce. It's vegetarian, naturally gluten-free, and deeply satisfying.

Serves 4 | Prep: 10 min | Cook: 20 min | Total: 30 min | Easy

What you need:
- 2 tablespoons olive oil
- 1 large onion, diced
- 1 red bell pepper, diced
- 4 garlic cloves, minced
- 1 teaspoon cumin
- 1 teaspoon smoked paprika
- 1/2 tsp cayenne (adjust to taste)
- 2 cans (28 oz total) crushed tomatoes
- Salt and black pepper to taste
- 6 large eggs
- Fresh parsley or cilantro for serving
- Feta cheese crumbles (optional but highly recommended)
- Crusty bread or pita for serving

How to make it:

1. Heat olive oil in a large skillet or cast iron pan over medium heat. Add onion and
   bell pepper. Cook until soft, about 7-8 minutes. Don't rush this step — caramelizing
   the veggies builds flavor.

2. Add garlic, cumin, paprika, and cayenne. Stir constantly for about 1 minute until
   fragrant. Pro tip: blooming spices in fat unlocks way more flavor.

3. Pour in the crushed tomatoes. Season with salt and pepper. Simmer on medium-low
   for 10 minutes, stirring occasionally, until sauce thickens slightly.

4. Use a spoon to make 6 wells in the sauce. Crack an egg into each well. Cover the
   pan and cook 5-8 minutes depending on how runny you like your yolks.

5. Remove from heat. Top with fresh herbs and feta. Serve immediately with bread!

Roughly 280 calories per serving, about 14g protein, 20g carbs, 16g fat.
`;

async function main() {
  const { data } = await generate({
    client,
    model: "gpt-4o-mini",
    schema: RecipeSchema,
    prompt: blogPost,
    systemPrompt: "Parse this recipe blog post into a clean structured format.",
  });

  console.log(`Recipe: ${data.name}`);
  console.log(`Cuisine: ${data.cuisine ?? "N/A"} | Difficulty: ${data.difficulty ?? "N/A"}`);
  console.log(`Time: ${data.totalTimeMinutes ?? "?"}min | Serves: ${data.servings ?? "?"}`);
  if (data.dietaryTags.length) console.log(`Tags: ${data.dietaryTags.join(", ")}`);

  console.log(`\nIngredients (${data.ingredients.length}):`);
  data.ingredients.forEach((ing) => {
    const qty = [ing.quantity, ing.unit].filter(Boolean).join(" ");
    console.log(`  • ${qty ? qty + " " : ""}${ing.name}${ing.notes ? ` (${ing.notes})` : ""}`);
  });

  console.log(`\nInstructions:`);
  data.instructions.forEach((step) => {
    console.log(`  ${step.step}. ${step.instruction}`);
    if (step.tip) console.log(`     💡 ${step.tip}`);
  });

  if (data.nutritionPer100g?.calories) {
    console.log(`\nNutrition: ~${data.nutritionPer100g.calories} cal | ${data.nutritionPer100g.proteinG}g protein`);
  }
}

main().catch(console.error);
