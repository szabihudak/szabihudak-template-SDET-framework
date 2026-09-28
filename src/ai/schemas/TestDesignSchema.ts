import { Static, Type } from "@sinclair/typebox";

export const TestScenarioTypeSchema = Type.Union([
  Type.Literal("positive"),
  Type.Literal("negative"),
  Type.Literal("boundary"),
]);

export const RecommendedLayerSchema = Type.Union([
  Type.Literal("api"),
  Type.Literal("ui"),
  Type.Literal("database"),
  Type.Literal("contract"),
  Type.Literal("unknown"),
]);

export const TestScenarioSchema = Type.Object(
  {
    title: Type.String(),
    type: TestScenarioTypeSchema,
    recommendedLayer: RecommendedLayerSchema,
    reason: Type.String(),
    preconditions: Type.Array(Type.String()),
    expectedOutcome: Type.String(),
  },
  {
    additionalProperties: false,
  },
);

export const TestDesignSchema = Type.Object(
  {
    summary: Type.String(),
    risks: Type.Array(Type.String()),
    scenarios: Type.Array(TestScenarioSchema),
    missingContext: Type.Array(Type.String()),
  },
  {
    additionalProperties: false,
  },
);

export type TestScenario = Static<typeof TestScenarioSchema>;
export type TestDesign = Static<typeof TestDesignSchema>;
