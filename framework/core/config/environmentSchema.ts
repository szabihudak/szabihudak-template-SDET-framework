import { Type, type Static } from "@sinclair/typebox";

export const environmentPermissionsSchema = Type.Object(
  {
    database: Type.Boolean(),
    destructive: Type.Boolean(),
    performance: Type.Boolean(),
    interactiveDiscovery: Type.Optional(Type.Boolean()),
  },
  {
    additionalProperties: false,
  },
);

export const environmentSchema = Type.Object(
  {
    // Required only by the modules in REQUIRED_URLS; getCurrentEnvironment()
    // checks them against the enabled modules.
    webBaseUrl: Type.Optional(Type.String({ format: "uri" })),
    apiBaseUrl: Type.Optional(Type.String({ format: "uri" })),
    // Public OpenAPI (Swagger) document, JSON or YAML. AI tools read the
    // provider contract from it through the OpenAPI MCP server.
    openApiUrl: Type.Optional(Type.String({ format: "uri" })),
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

export type EnvironmentUrl = "webBaseUrl" | "apiBaseUrl";

// The environment URLs each enabled module needs: browser modules open the web
// app, the API module calls the API, performance runs Lighthouse and k6.
export const REQUIRED_URLS: Record<EnvironmentUrl, string[]> = {
  webBaseUrl: ["ui", "smoke", "accessibility", "visual", "performance"],
  apiBaseUrl: ["api", "performance"],
};
