import type { Browser, Page } from "@playwright/test";

import { getFrameworkConfig } from "../config/frameworkConfig";
import { getCurrentEnvironment } from "../utils/env";
import type { Credentials } from "./credentials";

// Programmatic login keeps UI login out of setup unless login is under test.
export async function openAuthenticatedPage(
  browser: Browser,
  credentials: Credentials,
): Promise<Page> {
  const auth = getFrameworkConfig().auth.browser;

  if (auth.strategy === "none") {
    throw new Error(
      "Browser authentication is disabled. Configure auth.browser in config/framework.config.ts.",
    );
  }

  const { webBaseUrl } = getCurrentEnvironment();

  const context = await browser.newContext({
    baseURL: webBaseUrl,
  });

  const csrfResponse = await context.request.get(auth.csrfPath);

  if (!csrfResponse.ok()) {
    throw new Error(
      `Failed to obtain NextAuth CSRF token: ${csrfResponse.status()}`,
    );
  }

  const { csrfToken } = await csrfResponse.json();

  const loginResponse = await context.request.post(auth.callbackPath, {
    form: {
      csrfToken,
      [auth.usernameField]: credentials.username,
      [auth.passwordField]: credentials.password,
      callbackUrl: `${webBaseUrl}${auth.landingPath}`,
    },
  });

  if (!loginResponse.ok()) {
    throw new Error(
      `Programmatic authentication failed: ${loginResponse.status()} ${await loginResponse.text()}`,
    );
  }

  const page = await context.newPage();

  await page.goto(auth.landingPath);

  await page.waitForURL(`**${auth.landingPath}`);

  return page;
}
