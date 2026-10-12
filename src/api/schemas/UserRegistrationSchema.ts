import { Type, type Static } from "@sinclair/typebox";

export const userRegistrationSchema = Type.Object(
  {
    message: Type.String(),
    user: Type.Object(
      {
        id: Type.String(),
        email: Type.String({ format: "email" }),
        name: Type.String(),
        createdAt: Type.String({ format: "date-time" }),
      },
      {
        additionalProperties: false,
      },
    ),
  },
  {
    additionalProperties: false,
  },
);

export type UserRegistration = Static<typeof userRegistrationSchema>;
