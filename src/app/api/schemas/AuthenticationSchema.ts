import { Type, type Static } from "@sinclair/typebox";

export const authenticationSchema = Type.Object(
  {
    access_token: Type.String(),
    token_type: Type.String(),
    expires_in: Type.Number(),
  },
  {
    additionalProperties: false,
  },
);

export type Authentication = Static<typeof authenticationSchema>;
