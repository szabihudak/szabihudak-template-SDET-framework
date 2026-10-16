import fs from "node:fs";
import path from "node:path";

import { request as playwrightRequest } from "@playwright/test";
import { Client } from "pg";

import { getApiAccessToken } from "../core/auth/apiLogin";
import { signInBrowserSession } from "../core/auth/browserLogin";
import { getRoleCredentials } from "../core/auth/credentials";
import { getFrameworkConfig } from "../core/config/frameworkConfig";
import { loadDotEnv } from "../core/utils/dotenv";
import { getCurrentEnvironment } from "../core/utils/env";
import { assertSupportedNode } from "./runtime";

// A warning passes the check but tells the user what it could not confirm.
type Result = string | void | { warning: string };

type Check = {
  name: string;
  run: () => Promise<Result>;
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

  // getCurrentEnvironment() already failed on a URL an enabled module needs;
  // a URL left out because no module needs it has nothing to check.
  for (const [label, url] of [
    ["web", environment.webBaseUrl],
    ["API", environment.apiBaseUrl],
  ] as const) {
    if (!url) continue;
    checks.push({
      name: `${label} base URL ${url} is reachable`,
      run: async () => {
        const response = await fetch(url, { redirect: "manual" });

        if (response.status >= 500) {
          throw new Error(`responded with ${response.status}`);
        }

        // A 404 proves the server answers, not that the base path is right.
        if (response.status === 404) {
          return {
            warning:
              label === "API"
                ? "HTTP 404: the server responds, but the base path is not confirmed. The API login check confirms it once login is configured."
                : "HTTP 404: the server responds, but this page does not exist. Check the web base URL.",
          };
        }

        return `HTTP ${response.status}`;
      },
    });
  }

  if (Object.keys(config.roles).length === 0) {
    console.log(
      "ℹ Login is not configured yet: set auth and roles in config/framework.config.ts (README.md, Configure login).",
    );
  } else if (
    config.auth.api.strategy === "none" &&
    config.auth.browser.strategy === "none"
  ) {
    // npm run onboard adds the role before the login method is configured.
    console.log(
      "ℹ The login method is not configured yet, so the test account cannot be tried: set auth in config/framework.config.ts (README.md, Configure login).",
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

  let warnings = 0;

  for (const check of checks) {
    try {
      const result = await check.run();

      if (result && typeof result === "object") {
        warnings += 1;
        console.log(`⚠ ${check.name}: ${result.warning}`);
      } else {
        console.log(`✔ ${check.name}${result ? ` (${result})` : ""}`);
      }
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
    `\nAll checks passed${warnings > 0 ? ` with ${warnings} warning(s)` : ""}. Next: write the first tests from the golden templates (AGENTS.md).`,
  );
}

main().catch((error: unknown) => {
  console.error(`✖ ${message(error)}`);
  process.exit(1);
});
