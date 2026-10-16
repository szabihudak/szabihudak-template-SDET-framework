import { Type, type Static } from "@sinclair/typebox";

export const BROWSERS = ["chromium", "firefox", "webkit"] as const;

const browserAuthSchema = Type.Union([
  Type.Object(
    {
      strategy: Type.Literal("nextAuth"),
      csrfPath: Type.String({ minLength: 1 }),
      callbackPath: Type.String({ minLength: 1 }),
      landingPath: Type.String({ minLength: 1 }),
      usernameField: Type.String({ minLength: 1 }),
      passwordField: Type.String({ minLength: 1 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { strategy: Type.Literal("none") },
    { additionalProperties: false },
  ),
]);

const apiAuthSchema = Type.Union([
  Type.Object(
    {
      strategy: Type.Literal("bearer"),
      loginPath: Type.String({ minLength: 1 }),
      usernameField: Type.String({ minLength: 1 }),
      passwordField: Type.String({ minLength: 1 }),
      tokenField: Type.String({ minLength: 1 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { strategy: Type.Literal("none") },
    { additionalProperties: false },
  ),
]);

const roleSchema = Type.Object(
  {
    usernameEnv: Type.String({ pattern: "^[A-Z][A-Z0-9_]*$" }),
    passwordEnv: Type.String({ pattern: "^[A-Z][A-Z0-9_]*$" }),
  },
  { additionalProperties: false },
);

export const frameworkConfigSchema = Type.Object(
  {
    requirementsDoc: Type.Optional(Type.String({ minLength: 1 })),
    // User journeys and UI acceptance criteria for UI/E2E test plans.
    uiScenariosDoc: Type.Optional(Type.String({ minLength: 1 })),
    modules: Type.Object(
      {
        api: Type.Boolean(),
        ui: Type.Boolean(),
        smoke: Type.Boolean(),
        database: Type.Boolean(),
        accessibility: Type.Boolean(),
        visual: Type.Boolean(),
        performance: Type.Boolean(),
      },
      { additionalProperties: false },
    ),
    browsers: Type.Array(
      Type.Union(BROWSERS.map((browser) => Type.Literal(browser))),
      { minItems: 1, uniqueItems: true },
    ),
    execution: Type.Object(
      {
        ciRetries: Type.Integer({ minimum: 0 }),
        ciWorkers: Type.Union([
          Type.Integer({ minimum: 1 }),
          Type.String({ pattern: "^[1-9][0-9]?%$|^100%$" }),
        ]),
      },
      { additionalProperties: false },
    ),
    auth: Type.Object(
      {
        browser: browserAuthSchema,
        api: apiAuthSchema,
      },
      { additionalProperties: false },
    ),
    roles: Type.Record(
      Type.String({ pattern: "^[a-z][a-zA-Z0-9]*$" }),
      roleSchema,
    ),
  },
  { additionalProperties: false },
);

export type FrameworkConfig = Static<typeof frameworkConfigSchema>;

export type Browser = (typeof BROWSERS)[number];

export function defineFrameworkConfig(
  config: FrameworkConfig,
): FrameworkConfig {
  return config;
}
