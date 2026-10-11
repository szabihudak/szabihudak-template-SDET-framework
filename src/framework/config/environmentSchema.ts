import { Type, type Static } from "@sinclair/typebox";

export const environmentPermissionsSchema = Type.Object(
  {
    database: Type.Boolean(),
    destructive: Type.Boolean(),
    performance: Type.Boolean(),
  },
  {
    additionalProperties: false,
  },
);

export const environmentSchema = Type.Object(
  {
    webBaseUrl: Type.String({ format: "uri" }),
    apiBaseUrl: Type.String({ format: "uri" }),
    allow: environmentPermissionsSchema,
  },
  {
    additionalProperties: false,
  },
);

export const environmentsSchema = Type.Record(Type.String(), environmentSchema);

export type EnvironmentPermission = keyof Static<
  typeof environmentPermissionsSchema
>;

export type EnvironmentConfig = Static<typeof environmentSchema> & {
  name: string;
};
