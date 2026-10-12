import { Type, type Static } from "@sinclair/typebox";

export const loginCredentialsSchema = Type.Object(
  {
    email: Type.String({ format: "email" }),
    password: Type.String(),
  },
  {
    additionalProperties: false,
  },
);

export type LoginCredentials = Static<typeof loginCredentialsSchema>;
