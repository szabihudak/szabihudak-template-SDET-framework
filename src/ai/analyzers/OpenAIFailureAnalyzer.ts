import OpenAI from "openai";

import type { FailureEvidence } from "../models/FailureEvidence";
import { buildFailureAnalysisPrompt } from "../prompts/buildFailureAnalysisPrompt";
import {
  FailureAnalysisSchema,
  type FailureAnalysis,
} from "../schemas/FailureAnalysisSchema";
import { validateSchema } from "../../api/utils/SchemaValidator";
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

    if (!response.output_text) {
      throw new Error("OpenAI failure analysis returned no output.");
    }

    const parsed: unknown = JSON.parse(response.output_text);

    validateSchema(FailureAnalysisSchema, parsed);

    return parsed;
  }
}
