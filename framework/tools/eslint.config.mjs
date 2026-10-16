import markdown from "@eslint/markdown";
import playwright from "eslint-plugin-playwright";
import tseslint from "typescript-eslint";
import architecture from "./eslint-plugin/index.ts";

// Architecture rules from AGENTS.md and framework/docs/TESTING_STANDARDS.md that
// ESLint checks on the syntax tree: standard rules configured here, and the
// project's own rules in ./eslint-plugin/, which also check the format of the
// test plans (test-plans/*.md) on their Markdown syntax tree. The checks that
// compare a plan with its specs, or read files other than source code and
// plans, are in framework/tools/architecture.ts, which
// also fails when a section cited as "<file>#<heading anchor>" does not exist.

// Starter and self-test files are checked as if they were already in their
// target place in a project.
const ROOTS = {
  src: ["src", "framework/setup/starter/src"],
  tests: ["tests", "framework/setup/selftest/tests"],
};
const SOURCE = "{ts,js,mjs}";

// Glob patterns for a folder below src/ or tests/, in every place it can live.
const at = (folder, pattern = `**/*.${SOURCE}`) => {
  const [root, ...rest] = folder.split("/");
  const below = rest.length > 0 ? `${rest.join("/")}/` : "";

  return ROOTS[root].map((directory) => `${directory}/${below}${pattern}`);
};
const SPECS = at("tests", "**/*.spec.ts");
const APP_AND_SPECS = [...at("src"), ...at("tests")];
const CORE = [`framework/core/**/*.${SOURCE}`];

// "[<rule id>] <message> (<source>)": the id is what the self-test and readers
// search for, the source is the written rule.
const say = (id, message, source) => `[${id}] ${message} (${source})`;

const restricted = (id, source, message, ...selectors) =>
  selectors.map((selector) => ({
    selector,
    message: say(id, message, source),
  }));

const ASSERTION_OUTSIDE_SPECS = restricted(
  "no-assertions-outside-specs",
  "AGENTS.md#layer-rules",
  "Assertions belong in specs, not in clients, pages, factories or fixtures.",
  "CallExpression[callee.name='expect']",
  "MemberExpression[object.name='expect']",
);

// A plain `as unknown` asserts nothing; any other cast trusts unvalidated data.
const CAST_ON_RESPONSE_JSON = restricted(
  "no-cast-on-response-json",
  "AGENTS.md#hard-rules",
  "Do not cast provider responses. Validate with validateSchema() and use the schema type.",
  "TSAsExpression[typeAnnotation.type!='TSUnknownKeyword'][expression.argument.callee.property.name='json']",
  "TSAsExpression[typeAnnotation.type!='TSUnknownKeyword'][expression.callee.property.name='json']",
  "TSAsExpression[expression.type='TSAsExpression'][expression.expression.argument.callee.property.name='json']",
);

const SQL_STATEMENT =
  /\b(SELECT\s.+\sFROM|INSERT\s+INTO|DELETE\s+FROM|UPDATE\s+\w+\s+SET)\b/
    .source;

const SPEC_SYNTAX = [
  ...restricted(
    "no-raw-locators-in-specs",
    "AGENTS.md#layer-rules",
    "Locators belong in Page Objects or Component Objects. Expose a locator query instead.",
    "CallExpression[callee.property.name=/^(locator|getBy[A-Z]\\w*)$/]",
  ),
  ...restricted(
    "no-sql-in-specs",
    "AGENTS.md#layer-rules",
    "SQL belongs in a domain database client. Use the database fixtures from specs.",
    `Literal[value=/${SQL_STATEMENT}/]`,
    `TemplateElement[value.raw=/${SQL_STATEMENT}/]`,
  ),
  ...restricted(
    "no-test-step",
    "AGENTS.md#playwright-rules",
    "Do not use test.step(); the test and its Page Object methods express the steps.",
    "CallExpression[callee.object.name='test'][callee.property.name='step']",
  ),
];

// locator() is allowed only for a single test id attribute selector, for a
// match getByTestId cannot express (such as a prefix).
const TEST_ID_SELECTOR = /^\[data-testid([\^$*~|]?=["']?[^"'\]]*["']?)?\]$/
  .source;
const APP_AND_SPEC_SYNTAX = [
  ...restricted(
    "locate-by-user-attributes",
    "AGENTS.md#playwright-rules",
    "Locate by role, label or test id, scoped to a container and filtered by content; never by position, CSS or XPath.",
    `CallExpression[callee.property.name='locator'][arguments.0.type='Literal'][arguments.0.value!=/${TEST_ID_SELECTOR}/]`,
    "CallExpression[callee.property.name='locator'][arguments.0.type='TemplateLiteral'][arguments.0.quasis.0.value.raw!=/^\\[data-testid/]",
  ),
  // innerHTML is not covered by playwright/prefer-web-first-assertions.
  ...restricted(
    "web-first-assertions",
    "AGENTS.md#playwright-rules",
    "This assertion does not retry. Use a web-first assertion on the locator, such as await expect(locator).toHaveText().",
    "CallExpression[callee.name='expect'] > AwaitExpression > CallExpression[callee.property.name='innerHTML']",
  ),
];

const imports = (id, source, message, group) => ({
  group,
  message: say(id, message, source),
});

const FRAMEWORK_THROUGH_ALIAS = {
  regex: "^(\\.\\./)+framework/",
  message: say(
    "framework-through-alias",
    "Import the framework through @framework/ so the code does not depend on its location.",
    "AGENTS.md#ownership",
  ),
};
const AXE_THROUGH_SCANNER = {
  name: "@axe-core/playwright",
  message: say(
    "axe-only-through-scanner",
    "Use the AccessibilityScanner fixtures so the central WCAG policy applies.",
    "AGENTS.md#hard-rules",
  ),
};

// Dependencies flow toward the framework core (ADR-007).
const CORE_INDEPENDENT_OF_APP = imports(
  "core-independent-of-app",
  "AGENTS.md#ownership",
  "The framework core must not depend on application code or specs.",
  ["@app/**", "**/src/**", "**/tests/**"],
);
const APP_INDEPENDENT_OF_SPECS = imports(
  "app-independent-of-specs",
  "AGENTS.md#ownership",
  "Application code must not depend on specs.",
  ["**/tests/**"],
);
const FACTORY_BOUNDARIES = imports(
  "factory-boundaries",
  "AGENTS.md#layer-rules",
  "Factories must not call APIs, drive the UI or manage lifecycle; fixtures combine them.",
  [
    "api/clients",
    "pages",
    "components",
    "fixtures",
    "mocks",
    "database",
  ].flatMap((layer) => [`@app/${layer}/**`, `**/${layer}/**`]),
);
const PAGE_OBJECT_BOUNDARIES = imports(
  "page-object-boundaries",
  "AGENTS.md#layer-rules",
  "Page and Component Objects own locators and user actions only; set up data in fixtures.",
  ["api/clients", "database", "fixtures"].flatMap((layer) => [
    `@app/${layer}/**`,
    `**/${layer}/**`,
  ]),
);
const FACTORY_WITHOUT_PLAYWRIGHT = {
  name: "@playwright/test",
  message: say(
    "factories-without-playwright",
    "Factories build data only. Requests, pages and assertions belong in clients, Page Objects and specs.",
    "AGENTS.md#layer-rules",
  ),
};

// One no-restricted-imports entry per folder, because a later config block
// replaces the options of an earlier one.
const importRules = ({ paths = [], patterns = [] }) => ({
  "no-restricted-imports": ["error", { paths, patterns }],
});

export default tseslint.config(
  {
    ignores: [
      "playwright-report/**",
      "test-results/**",
      "framework/templates/**",
    ],
  },
  {
    files: [...APP_AND_SPECS, ...CORE],
    languageOptions: { parser: tseslint.parser },
    plugins: { playwright, architecture },
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },

  // Everywhere: AGENTS.md#playwright-rules (fixed waits), AGENTS.md#hard-rules
  // (casts, axe).
  {
    files: [...APP_AND_SPECS, ...CORE],
    rules: {
      "playwright/no-wait-for-timeout": "error",
      "no-restricted-syntax": ["error", ...CAST_ON_RESPONSE_JSON],
      ...importRules({ paths: [AXE_THROUGH_SCANNER] }),
    },
  },
  // Application layer and specs: AGENTS.md#playwright-rules.
  {
    files: APP_AND_SPECS,
    rules: {
      "playwright/prefer-web-first-assertions": "error",
      "playwright/prefer-to-have-count": "error",
      "playwright/no-networkidle": "error",
      "playwright/no-wait-for-selector": "error",
      "playwright/no-force-option": "error",
      "playwright/no-nth-methods": "error",
      "playwright/missing-playwright-await": "error",
      "no-restricted-syntax": [
        "error",
        ...CAST_ON_RESPONSE_JSON,
        ...APP_AND_SPEC_SYNTAX,
      ],
      ...importRules({
        paths: [AXE_THROUGH_SCANNER],
        patterns: [FRAMEWORK_THROUGH_ALIAS],
      }),
    },
  },

  // Application layer: AGENTS.md#layer-rules, AGENTS.md#ownership.
  {
    files: at("src"),
    rules: {
      "no-restricted-syntax": [
        "error",
        ...CAST_ON_RESPONSE_JSON,
        ...APP_AND_SPEC_SYNTAX,
        ...ASSERTION_OUTSIDE_SPECS,
      ],
      ...importRules({
        paths: [AXE_THROUGH_SCANNER],
        patterns: [FRAMEWORK_THROUGH_ALIAS, APP_INDEPENDENT_OF_SPECS],
      }),
    },
  },
  {
    files: at("src/data"),
    rules: importRules({
      paths: [AXE_THROUGH_SCANNER, FACTORY_WITHOUT_PLAYWRIGHT],
      patterns: [
        FRAMEWORK_THROUGH_ALIAS,
        APP_INDEPENDENT_OF_SPECS,
        FACTORY_BOUNDARIES,
      ],
    }),
  },
  {
    files: [...at("src/pages"), ...at("src/components")],
    rules: importRules({
      paths: [AXE_THROUGH_SCANNER],
      patterns: [
        FRAMEWORK_THROUGH_ALIAS,
        APP_INDEPENDENT_OF_SPECS,
        PAGE_OBJECT_BOUNDARIES,
      ],
    }),
  },

  // Framework core: AGENTS.md#ownership, AGENTS.md#layer-rules. The Lighthouse
  // policy is the one framework helper that asserts by design.
  {
    files: CORE,
    ignores: ["framework/core/performance/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...CAST_ON_RESPONSE_JSON,
        ...ASSERTION_OUTSIDE_SPECS,
      ],
    },
  },
  {
    files: CORE,
    rules: importRules({
      paths: [AXE_THROUGH_SCANNER],
      patterns: [CORE_INDEPENDENT_OF_APP],
    }),
  },
  {
    files: ["framework/core/accessibility/**"],
    rules: importRules({ patterns: [CORE_INDEPENDENT_OF_APP] }),
  },

  // Specs: AGENTS.md#playwright-rules, AGENTS.md#layer-rules.
  {
    files: SPECS,
    rules: {
      "playwright/no-focused-test": "error",
      "playwright/require-top-level-describe": "error",
      "no-restricted-syntax": [
        "error",
        ...CAST_ON_RESPONSE_JSON,
        ...APP_AND_SPEC_SYNTAX,
        ...SPEC_SYNTAX,
      ],
      ...importRules({
        paths: [
          AXE_THROUGH_SCANNER,
          {
            name: "pg",
            message: say(
              "no-sql-in-specs",
              "SQL belongs in a domain database client. Use the database fixtures from specs.",
              "AGENTS.md#layer-rules",
            ),
          },
        ],
        patterns: [FRAMEWORK_THROUGH_ALIAS],
      }),
    },
  },

  // k6 scripts run in k6, not through tsconfig, so they import the framework
  // by path.
  {
    files: [...at("src", "**/*.{js,mjs}"), ...at("tests", "**/*.{js,mjs}")],
    rules: importRules({ paths: [AXE_THROUGH_SCANNER] }),
  },

  // The project rules (./eslint-plugin/), each citing its source in its
  // message.
  {
    files: at("src/api/schemas"),
    rules: { "architecture/schemas-reject-unknown-fields": "error" },
  },
  {
    files: at("src/database"),
    rules: { "architecture/parameterized-sql": "error" },
  },
  {
    files: SPECS,
    rules: {
      "architecture/no-skipped-tests": "error",
      "architecture/shared-visual-options": "error",
      "architecture/no-success-schema-on-negative-response": "error",
      "architecture/no-boolean-wrapped-assertions": "error",
      "architecture/success-response-order": "error",
      "architecture/negative-response-fields": "error",
      "architecture/role-credentials-in-login-specs": "error",
      "architecture/no-inline-payload-to-api-client": "error",
      "architecture/similar-tests-as-scenarios": "error",
    },
  },
  {
    files: at("tests/api", "**/*.spec.ts"),
    rules: {
      "architecture/api-field-coverage": "error",
      "architecture/api-tests-assert-business-fields": "error",
      "architecture/no-partial-success-comparison": "error",
    },
  },
  {
    files: [
      ...at("tests/ui", "**/*.spec.ts"),
      ...at("tests/smoke", "**/*.spec.ts"),
    ],
    rules: { "architecture/ui-tests-assert-the-page": "error" },
  },

  // Test plans: framework/docs/TESTING_STANDARDS.md#test-design-standard.
  {
    files: ["test-plans/**/*.md"],
    plugins: { markdown, architecture },
    language: "markdown/gfm",
    rules: {
      "architecture/plan-case-technique": "error",
      "architecture/plan-case-steps": "error",
      "architecture/plan-coverage": "error",
      "architecture/plan-risk-priority": "error",
    },
  },
);
