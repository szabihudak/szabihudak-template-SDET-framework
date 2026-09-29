import fs from "node:fs";
import path from "node:path";

import OpenAI from "openai";

import { validateSchema } from "../../api/utils/SchemaValidator";
import { OpenAIFailureAnalyzer } from "../analyzers/OpenAIFailureAnalyzer";
import {
  FailureEvidenceSchema,
  type FailureEvidence,
} from "../schemas/FailureEvidenceSchema";
import { sanitizePath, sanitizeText } from "../utils/failureEvidenceSanitizer";

async function main(): Promise<void> {
  const evidencePath = process.argv[2];

  if (!evidencePath) {
    throw new Error(
      "Usage: npm run ai:analyze-failure -- <failure-evidence.json>",
    );
  }
  const absoluteEvidencePath = path.resolve(evidencePath);
  if (!fs.existsSync(absoluteEvidencePath)) {
    throw new Error(`Failure evidence file not found: ${evidencePath}`);
  }

  const rawEvidence = fs.readFileSync(absoluteEvidencePath, "utf8");
  const parsed: unknown = JSON.parse(rawEvidence);
  validateSchema(FailureEvidenceSchema, parsed);

  const evidence: FailureEvidence = {
    test: {
      title: sanitizeText(parsed.test.title),
      titlePath: parsed.test.titlePath.map(sanitizeText),
      file: sanitizePath(parsed.test.file),
      project: sanitizeText(parsed.test.project),
    },
    execution: {
      environment: sanitizeText(parsed.execution.environment),
      retry: parsed.execution.retry,
    },
    failure: {
      message: sanitizeText(parsed.failure.message),
      stack: parsed.failure.stack
        ? sanitizeText(parsed.failure.stack)
        : undefined,
    },
    artifacts: parsed.artifacts.map((artifact) => ({
      type: artifact.type,
      path: sanitizePath(artifact.path),
    })),
  };

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required.");
  }
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const model = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
  const analyzer = new OpenAIFailureAnalyzer(client, model);
  const analysis = await analyzer.analyze(evidence);
  const outputDir = path.resolve("test-results", "ai-failure-analysis");
  fs.mkdirSync(outputDir, { recursive: true });
  const sourceName = path.basename(
    absoluteEvidencePath,
    path.extname(absoluteEvidencePath),
  );
  const outputPath = path.join(outputDir, `${sourceName}-analysis.json`);
  fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2), "utf8");
  console.log(`AI failure analysis written to: ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
