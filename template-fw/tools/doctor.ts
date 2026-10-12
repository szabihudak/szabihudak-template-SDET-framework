import fs from "node:fs";
import path from "node:path";

import { request as playwrightRequest } from "@playwright/test";
import { Client } from "pg";

import { getApiAccessToken } from "../framework/auth/apiLogin";
import { signInBrowserSession } from "../framework/auth/browserLogin";
import { getRoleCredentials } from "../framework/auth/credentials";
import { getFrameworkConfig } from "../framework/config/frameworkConfig";
import { loadDotEnv } from "../framework/utils/dotenv";
import { getCurrentEnvironment } from "../framework/utils/env";
import { assertSupportedNode } from "./runtime";

type Check = {
  name: string;
  run: () => Promise<string | void>;
};

const message = (error: unknown) =>
  error instanceof Error ? error.message.split("\n")[0] : String(error);

async function main(): Promise<void> {
  assertSupportedNode();
  loadDotEnv();

  const checks: Check[] = [];
  let failures = 0;

  const config = getFrameworkConfig();
  console.log("✔ config/framework.config.ts is valid");

  let environment: ReturnType<typeof getCurrentEnvironment>;
  try {
    environment = getCurrentEnvironment();
    console.log(`✔ TEST_ENV=${environment.name} is configured`);
  } catch (error) {
    console.error(`✖ ${message(error)}`);

    if (!fs.existsSync(path.resolve(__dirname, "../../.env"))) {
      console.error(
        "  No .env file found. Run npm run setup, then cp .env.example .env and fill in TEST_ENV and the credentials.",
      );
    }

    process.exit(1);
  }

  for (const [label, url] of [
    ["web", environment.webBaseUrl],
    ["API", environment.apiBaseUrl],
  ] as const) {
    checks.push({
      name: `${label} base URL ${url} is reachable`,
      run: async () => {
        const response = await fetch(url, { redirect: "manual" });

        if (response.status >= 500) {
          throw new Error(`responded with ${response.status}`);
        }

        return `HTTP ${response.status}`;
      },
    });
  }

  if (Object.keys(config.roles).length === 0) {
    console.log(
      "ℹ Login is not configured yet (auth and roles in config/framework.config.ts). See template-fw/docs/FIRST_TESTS_PROMPT.md, step 1.",
    );
  }

  for (const role of Object.keys(config.roles)) {
    checks.push({
      name: `credentials for role "${role}" are set`,
      run: async () => {
        getRoleCredentials(role);
      },
    });

    if (config.auth.api.strategy !== "none") {
      checks.push({
        name: `role "${role}" receives an API access token`,
        run: async () => {
          const context = await playwrightRequest.newContext();

          try {
            await getApiAccessToken(context, getRoleCredentials(role));
          } finally {
            await context.dispose();
          }
        },
      });
    }

    if (config.auth.browser.strategy !== "none") {
      checks.push({
        name: `role "${role}" signs in to a browser session`,
        run: async () => {
          const context = await playwrightRequest.newContext({
            baseURL: environment.webBaseUrl,
          });

          try {
            await signInBrowserSession(context, getRoleCredentials(role));
          } finally {
            await context.dispose();
          }
        },
      });
    }
  }

  if (config.modules.database && environment.allow.database) {
    checks.push({
      name: "dedicated test database accepts connections",
      run: async () => {
        if (!process.env.DATABASE_URL) {
          throw new Error("DATABASE_URL is not set");
        }

        const client = new Client({
          connectionString: process.env.DATABASE_URL,
        });

        await client.connect();

        try {
          await client.query("SELECT 1");
        } finally {
          await client.end();
        }
      },
    });
  }

  for (const check of checks) {
    try {
      const detail = await check.run();
      console.log(`✔ ${check.name}${detail ? ` (${detail})` : ""}`);
    } catch (error) {
      failures += 1;
      console.error(`✖ ${check.name}: ${message(error)}`);
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }

  console.log(
    "\nAll checks passed. Next: write tests from the golden templates (template-fw/docs/FIRST_TESTS_PROMPT.md).",
  );
}

main().catch((error: unknown) => {
  console.error(`✖ ${message(error)}`);
  process.exit(1);
});
