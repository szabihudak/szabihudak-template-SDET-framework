import { expect, test } from "@playwright/test";
import OpenAI from "openai";

import { OpenAIFailureAnalyzer } from "../../src/ai/analyzers/OpenAIFailureAnalyzer";
import type { FailureAnalysis } from "../../src/ai/schemas/FailureAnalysisSchema";
import type { FailureEvidence } from "../../src/ai/schemas/FailureEvidenceSchema";

const evidence: FailureEvidence = {
  test: {
    title: "example failure",
    titlePath: ["example failure"],
    file: "tests/ui/example.spec.ts",
    project: "chromium",
  },
  execution: {
    environment: "localDocker",
    retry: 0,
  },
  failure: {
    message: "Expected value to be true",
    stack: "at tests/ui/example.spec.ts:10:5",
  },
  artifacts: [],
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

test.describe("OpenAIFailureAnalyzer", () => {
  test("returns validated failure analysis for valid structured output", async () => {
    const expectedAnalysis: FailureAnalysis = {
      classification: "unknown",
      confidence: "low",
      summary: "The available evidence does not establish a root cause.",
      evidence: ["The assertion failed during test execution."],
      hypotheses: ["Additional application or environment evidence is needed."],
      recommendedNextSteps: ["Inspect the relevant runtime diagnostics."],
    };
    const analyzer = new OpenAIFailureAnalyzer(
      createClient(JSON.stringify(expectedAnalysis)),
      "test-model",
    );
    const result = await analyzer.analyze(evidence);

    expect(result).toEqual(expectedAnalysis);
  });

  test("throws when OpenAI returns no output", async () => {
    const analyzer = new OpenAIFailureAnalyzer(createClient(), "test-model");

    await expect(analyzer.analyze(evidence)).rejects.toThrow(
      "OpenAI failure analysis returned no output.",
    );
  });

  test("throws when OpenAI returns invalid JSON", async () => {
    const analyzer = new OpenAIFailureAnalyzer(
      createClient("not-json"),
      "test-model",
    );

    await expect(analyzer.analyze(evidence)).rejects.toThrow();
  });

  test("rejects schema-invalid structured output", async () => {
    const invalidAnalysis = {
      classification: "product",
      confidence: "certain",
      summary: "Invalid confidence value.",
      evidence: [],
      hypotheses: [],
      recommendedNextSteps: [],
    };
    const analyzer = new OpenAIFailureAnalyzer(
      createClient(JSON.stringify(invalidAnalysis)),
      "test-model",
    );

    await expect(analyzer.analyze(evidence)).rejects.toThrow();
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
    const analyzer = new OpenAIFailureAnalyzer(client, "test-model");

    await expect(analyzer.analyze(evidence)).rejects.toThrow(
      "OpenAI failure analysis returned an incomplete response: max_output_tokens.",
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
                  refusal: "Unable to provide this analysis.",
                },
              ],
            },
          ],
          output_text: "",
        }),
      },
    } as unknown as OpenAI;

    const analyzer = new OpenAIFailureAnalyzer(client, "test-model");

    await expect(analyzer.analyze(evidence)).rejects.toThrow(
      "OpenAI failure analysis was refused: Unable to provide this analysis.",
    );
  });
});
