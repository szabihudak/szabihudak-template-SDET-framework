import OpenAI from "openai";

import { validateSchema } from "../../api/utils/SchemaValidator";
import { buildTestDesignPrompt } from "../prompts/buildTestDesignPrompt";
import type { TestDesignInput } from "../schemas/TestDesignInputSchema";
import { TestDesignSchema, type TestDesign } from "../schemas/TestDesignSchema";
import type { TestScenarioGenerator } from "./TestScenarioGenerator";

export class OpenAITestScenarioGenerator implements TestScenarioGenerator {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async generate(input: TestDesignInput): Promise<TestDesign> {
    const prompt = buildTestDesignPrompt(input);
    const response = await this.client.responses.create({
      model: this.model,
      instructions: prompt.instructions,
      input: prompt.input,
      text: {
        format: {
          type: "json_schema",
          name: "test_design",
          strict: true,
          schema: TestDesignSchema,
        },
      },
    });

    if (response.status === "incomplete") {
      const reason = response.incomplete_details?.reason ?? "unknown";

      throw new Error(
        `OpenAI test design generation returned an incomplete response: ${reason}.`,
      );
    }
    for (const item of response.output ?? []) {
      if (item.type !== "message") {
        continue;
      }

      for (const content of item.content) {
        if (content.type === "refusal") {
          throw new Error(
            `OpenAI test design generation was refused: ${content.refusal}`,
          );
        }
      }
    }
    if (!response.output_text) {
      throw new Error("OpenAI test design generation returned no output.");
    }
    const parsed: unknown = JSON.parse(response.output_text);
    validateSchema(TestDesignSchema, parsed);
    return parsed;
  }
}
