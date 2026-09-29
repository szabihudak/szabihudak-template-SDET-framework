import OpenAI from "openai";

import { validateSchema } from "../../api/utils/SchemaValidator";
import { buildFailureAnalysisPrompt } from "../prompts/buildFailureAnalysisPrompt";
import {
  FailureAnalysisSchema,
  type FailureAnalysis,
} from "../schemas/FailureAnalysisSchema";
import type { FailureEvidence } from "../schemas/FailureEvidenceSchema";
import type { FailureAnalyzer } from "./FailureAnalyzer";

export class OpenAIFailureAnalyzer implements FailureAnalyzer {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async analyze(evidence: FailureEvidence): Promise<FailureAnalysis> {
    const prompt = buildFailureAnalysisPrompt(evidence);

    const response = await this.client.responses.create({
      model: this.model,
      instructions: prompt.instructions,
      input: prompt.input,
      text: {
        format: {
          type: "json_schema",
          name: "failure_analysis",
          strict: true,
          schema: FailureAnalysisSchema,
        },
      },
    });

    if (response.status === "incomplete") {
      const reason = response.incomplete_details?.reason ?? "unknown";

      throw new Error(
        `OpenAI failure analysis returned an incomplete response: ${reason}.`,
      );
    }

    for (const item of response.output ?? []) {
      if (item.type !== "message") {
        continue;
      }

      for (const content of item.content) {
        if (content.type === "refusal") {
          throw new Error(
            `OpenAI failure analysis was refused: ${content.refusal}`,
          );
        }
      }
    }

    if (!response.output_text) {
      throw new Error("OpenAI failure analysis returned no output.");
    }
    const parsed: unknown = JSON.parse(response.output_text);
    validateSchema(FailureAnalysisSchema, parsed);
    return parsed;
  }
}
