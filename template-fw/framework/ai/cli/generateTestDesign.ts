import fs from "node:fs";
import path from "node:path";

import OpenAI from "openai";

import { validateSchema } from "../../api/SchemaValidator";
import { OpenAITestScenarioGenerator } from "../generators/OpenAITestScenarioGenerator";
import {
  TestDesignInputSchema,
  type TestDesignInput,
} from "../schemas/TestDesignInputSchema";

async function main(): Promise<void> {
  const inputPath = process.argv[2];

  if (!inputPath) {
    throw new Error(
      "Usage: npm run ai:generate-test-design -- <test-design-input.json>",
    );
  }

  const absoluteInputPath = path.resolve(inputPath);

  if (!fs.existsSync(absoluteInputPath)) {
    throw new Error(`Test design input file not found: ${inputPath}`);
  }

  const rawInput = fs.readFileSync(absoluteInputPath, "utf8");
  const parsed: unknown = JSON.parse(rawInput);

  validateSchema(TestDesignInputSchema, parsed);

  const input: TestDesignInput = parsed;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required.");
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const model = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";

  const generator = new OpenAITestScenarioGenerator(client, model);

  const testDesign = await generator.generate(input);

  const outputDir = path.resolve("test-results", "ai-test-design");
  fs.mkdirSync(outputDir, { recursive: true });

  const sourceName = path.basename(
    absoluteInputPath,
    path.extname(absoluteInputPath),
  );

  const outputPath = path.join(outputDir, `${sourceName}-test-design.json`);

  fs.writeFileSync(outputPath, JSON.stringify(testDesign, null, 2), "utf8");

  console.log(`AI test design written to: ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
