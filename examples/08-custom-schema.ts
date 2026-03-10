/**
 * Example: Custom schema without Zod
 *
 * If you're not using Zod, you can bring your own JSON Schema + parse function.
 * Works with TypeBox, Valibot, or any hand-rolled validator.
 *
 * Run: OPENAI_API_KEY=sk-... npx tsx examples/08-custom-schema.ts
 */

import OpenAI from "openai";
import { generate } from "../src/index.js";

// --- Custom validator (no Zod) -----------------------------------------------

interface WeatherData {
  city: string;
  temperature: number;
  unit: "celsius" | "fahrenheit";
  condition: string;
  humidity: number;
  windSpeed: number;
  forecast: Array<{ day: string; high: number; low: number; condition: string }>;
}

const WeatherSchema = {
  jsonSchema: {
    type: "object" as const,
    properties: {
      city: { type: "string" },
      temperature: { type: "number" },
      unit: { type: "string", enum: ["celsius", "fahrenheit"] },
      condition: { type: "string" },
      humidity: { type: "number", minimum: 0, maximum: 100 },
      windSpeed: { type: "number", minimum: 0 },
      forecast: {
        type: "array",
        items: {
          type: "object",
          properties: {
            day: { type: "string" },
            high: { type: "number" },
            low: { type: "number" },
            condition: { type: "string" },
          },
          required: ["day", "high", "low", "condition"],
        },
      },
    },
    required: ["city", "temperature", "unit", "condition", "humidity", "windSpeed", "forecast"],
  },
  parse: (data: unknown): WeatherData => {
    const d = data as WeatherData;
    if (!d.city || typeof d.temperature !== "number") {
      throw new Error("Invalid weather data");
    }
    if (!["celsius", "fahrenheit"].includes(d.unit)) {
      throw new Error("unit must be celsius or fahrenheit");
    }
    return d;
  },
};

// --- With TypeBox (if you prefer) -----------------------------------------------
// import { Type, Static } from "@sinclair/typebox";
// import Ajv from "ajv";
//
// const WeatherTypeBox = Type.Object({ city: Type.String(), temperature: Type.Number() });
// type Weather = Static<typeof WeatherTypeBox>;
//
// const ajv = new Ajv();
// const validate = ajv.compile(WeatherTypeBox);
//
// const WeatherSchema = {
//   jsonSchema: WeatherTypeBox,
//   parse: (data: unknown): Weather => {
//     if (!validate(data)) throw new Error(ajv.errorsText(validate.errors));
//     return data;
//   },
// };

const openai = new OpenAI();

async function getWeather() {
  const cities = ["Tokyo", "New York", "London"];

  for (const city of cities) {
    const { data } = await generate({
      client: openai,
      model: "gpt-4o-mini",
      schema: WeatherSchema,
      prompt: `Generate realistic current weather data and a 3-day forecast for ${city}. Use celsius.`,
      temperature: 0.5,
    });

    console.log(`\n${data.city}: ${data.temperature}°${data.unit === "celsius" ? "C" : "F"}, ${data.condition}`);
    console.log(`  Humidity: ${data.humidity}%  Wind: ${data.windSpeed} km/h`);
    console.log("  Forecast:");
    for (const day of data.forecast) {
      console.log(`    ${day.day}: ${day.high}° / ${day.low}° — ${day.condition}`);
    }
  }
}

getWeather().catch(console.error);
