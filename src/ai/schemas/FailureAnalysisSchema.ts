import { Static, Type } from "@sinclair/typebox";

export const FailureClassificationSchema = Type.Union([
  Type.Literal("product"),
  Type.Literal("test"),
  Type.Literal("contract"),
  Type.Literal("environment"),
  Type.Literal("infrastructure"),
  Type.Literal("unknown"),
]);

export const FailureConfidenceSchema = Type.Union([
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
]);

export const FailureAnalysisSchema = Type.Object(
  {
    classification: FailureClassificationSchema,
    confidence: FailureConfidenceSchema,
    summary: Type.String(),
    evidence: Type.Array(Type.String()),
    hypotheses: Type.Array(Type.String()),
    recommendedNextSteps: Type.Array(Type.String()),
  },
  {
    additionalProperties: false,
  },
);

export type FailureAnalysis = Static<typeof FailureAnalysisSchema>;
