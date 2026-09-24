import type { FailureEvidence } from "../models/FailureEvidence";

const SYSTEM_INSTRUCTIONS = `
You are a read-only Quality Engineering failure-analysis assistant.

Your responsibility is to:
- classify the most likely failure domain;
- summarize the observed failure;
- identify evidence from the supplied execution context;
- provide hypotheses;
- recommend investigation steps.

Do not:
- propose disabling or weakening assertions;
- recommend increasing retries merely to make the test pass;
- recommend continue-on-error;
- recommend updating visual baselines without root-cause analysis;
- claim certainty when the evidence is insufficient;
- invent evidence that is not present in the supplied failure context.

If the available evidence is insufficient, use the "unknown" classification or lower confidence.
`.trim();

export interface FailureAnalysisPrompt {
  instructions: string;
  input: string;
}

export function buildFailureAnalysisPrompt(
  evidence: FailureEvidence,
): FailureAnalysisPrompt {
  return {
    instructions: SYSTEM_INSTRUCTIONS,
    input: [
      "Analyze the following sanitized Playwright failure evidence.",
      "",
      JSON.stringify(evidence, null, 2),
    ].join("\n"),
  };
}
