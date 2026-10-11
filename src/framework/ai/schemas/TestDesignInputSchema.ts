import { Static, Type } from "@sinclair/typebox";

export const TestDesignInputSchema = Type.Object(
  {
    requirement: Type.String({ minLength: 1 }),
    acceptanceCriteria: Type.Optional(Type.Array(Type.String())),
    frameworkContext: Type.Optional(Type.Array(Type.String())),
  },
  {
    additionalProperties: false,
  },
);

export type TestDesignInput = Static<typeof TestDesignInputSchema>;
