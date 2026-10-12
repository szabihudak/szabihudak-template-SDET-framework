import { Type, type Static } from "@sinclair/typebox";

export const currentUserSchema = Type.Object(
  {
    user: Type.Object(
      {
        id: Type.String(),
        email: Type.String({ format: "email" }),
        name: Type.String(),
        createdAt: Type.String({ format: "date-time" }),
        updatedAt: Type.String({ format: "date-time" }),
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

export type CurrentUser = Static<typeof currentUserSchema>;
