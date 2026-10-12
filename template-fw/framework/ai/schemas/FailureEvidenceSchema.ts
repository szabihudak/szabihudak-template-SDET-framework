import { Static, Type } from "@sinclair/typebox";

export const FailureArtifactTypeSchema = Type.Union([
  Type.Literal("trace"),
  Type.Literal("screenshot"),
  Type.Literal("video"),
]);

export const FailureArtifactSchema = Type.Object(
  {
    type: FailureArtifactTypeSchema,
    path: Type.String(),
  },
  {
    additionalProperties: false,
  },
);

export const FailureTestContextSchema = Type.Object(
  {
    title: Type.String(),
    titlePath: Type.Array(Type.String()),
    file: Type.String(),
    project: Type.String(),
  },
  {
    additionalProperties: false,
  },
);

export const FailureExecutionContextSchema = Type.Object(
  {
    environment: Type.String(),
    retry: Type.Integer({ minimum: 0 }),
  },
  {
    additionalProperties: false,
  },
);

export const FailureDetailsSchema = Type.Object(
  {
    message: Type.String(),
    stack: Type.Optional(Type.String()),
  },
  {
    additionalProperties: false,
  },
);

export const FailureEvidenceSchema = Type.Object(
  {
    test: FailureTestContextSchema,
    execution: FailureExecutionContextSchema,
    failure: FailureDetailsSchema,
    artifacts: Type.Array(FailureArtifactSchema),
  },
  {
    additionalProperties: false,
  },
);

export type FailureEvidence = Static<typeof FailureEvidenceSchema>;
export type FailureArtifact = Static<typeof FailureArtifactSchema>;
export type FailureArtifactType = Static<typeof FailureArtifactTypeSchema>;
