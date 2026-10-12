import { expect, test } from "@playwright/test";
import OpenAI from "openai";

import { OpenAITestScenarioGenerator } from "@framework/ai/generators/OpenAITestScenarioGenerator";
import type { TestDesign } from "@framework/ai/schemas/TestDesignSchema";
import type { TestDesignInput } from "@framework/ai/schemas/TestDesignInputSchema";

const input: TestDesignInput = {
  requirement: "A task must have a title before it can be created.",
  acceptanceCriteria: [
    "The Create Task action remains unavailable while the title is empty.",
  ],
  frameworkContext: [
    "Authenticated task-dashboard UI coverage already exists.",
  ],
};

function createClient(outputText?: string): OpenAI {
  return {
    responses: {
      create: async () => ({
        status: "completed",
        incomplete_details: null,
        output: [],
        output_text: outputText ?? "",
      }),
    },
  } as unknown as OpenAI;
}

test.describe("OpenAITestScenarioGenerator", () => {
  test("returns validated test design for valid structured output", async () => {
    const expectedDesign: TestDesign = {
      summary: "Validate task-title behavior before task creation.",
      risks: ["A task could be created without the required title."],
      scenarios: [
        {
          title: "Create Task remains disabled while title is empty",
          type: "negative",
          recommendedLayer: "ui",
          reason:
            "The behavior is directly observable through the user interface.",
          preconditions: ["User is authenticated and on the task dashboard."],
          expectedOutcome:
            "The Create Task action remains unavailable until a title is entered.",
        },
      ],
      missingContext: [],
    };
    const generator = new OpenAITestScenarioGenerator(
      createClient(JSON.stringify(expectedDesign)),
      "test-model",
    );
    const result = await generator.generate(input);

    expect(result).toEqual(expectedDesign);
  });

  test("throws when OpenAI returns no output", async () => {
    const generator = new OpenAITestScenarioGenerator(
      createClient(),
      "test-model",
    );

    await expect(generator.generate(input)).rejects.toThrow(
      "OpenAI test design generation returned no output.",
    );
  });

  test("throws when OpenAI returns invalid JSON", async () => {
    const generator = new OpenAITestScenarioGenerator(
      createClient("not-json"),
      "test-model",
    );

    await expect(generator.generate(input)).rejects.toThrow();
  });

  test("rejects schema-invalid structured output", async () => {
    const invalidDesign = {
      summary: "Invalid test design.",
      risks: [],
      scenarios: [
        {
          title: "Invalid layer",
          type: "negative",
          recommendedLayer: "service",
          reason: "Invalid layer value.",
          preconditions: [],
          expectedOutcome: "The scenario is rejected.",
        },
      ],
      missingContext: [],
    };
    const generator = new OpenAITestScenarioGenerator(
      createClient(JSON.stringify(invalidDesign)),
      "test-model",
    );

    await expect(generator.generate(input)).rejects.toThrow();
  });

  test("throws when OpenAI returns an incomplete response", async () => {
    const client = {
      responses: {
        create: async () => ({
          status: "incomplete",
          incomplete_details: {
            reason: "max_output_tokens",
          },
          output: [],
          output_text: "",
        }),
      },
    } as unknown as OpenAI;
    const generator = new OpenAITestScenarioGenerator(client, "test-model");

    await expect(generator.generate(input)).rejects.toThrow(
      "OpenAI test design generation returned an incomplete response: max_output_tokens.",
    );
  });

  test("throws when OpenAI refuses the response", async () => {
    const client = {
      responses: {
        create: async () => ({
          status: "completed",
          incomplete_details: null,
          output: [
            {
              type: "message",
              content: [
                {
                  type: "refusal",
                  refusal: "Unable to generate this test design.",
                },
              ],
            },
          ],
          output_text: "",
        }),
      },
    } as unknown as OpenAI;
    const generator = new OpenAITestScenarioGenerator(client, "test-model");

    await expect(generator.generate(input)).rejects.toThrow(
      "OpenAI test design generation was refused: Unable to generate this test design.",
    );
  });
});
