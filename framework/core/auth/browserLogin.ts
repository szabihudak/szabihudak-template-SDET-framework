import type { APIRequestContext, Browser, Page } from "@playwright/test";

import { getFrameworkConfig } from "../config/frameworkConfig";
import { requireUrl } from "../utils/env";
import type { Credentials } from "./credentials";

function getBrowserAuth() {
  const auth = getFrameworkConfig().auth.browser;

  if (auth.strategy === "none") {
    throw new Error(
      "Browser authentication is disabled. Configure auth.browser in config/framework.config.ts.",
    );
  }

  return auth;
}

// Establishes the Auth.js session cookie on the request context's cookie jar.
export async function signInBrowserSession(
  request: APIRequestContext,
  credentials: Credentials,
): Promise<void> {
  const auth = getBrowserAuth();
  const webBaseUrl = requireUrl("webBaseUrl");

  const csrfResponse = await request.get(auth.csrfPath);

  if (!csrfResponse.ok()) {
    throw new Error(
      `Failed to obtain NextAuth CSRF token: ${csrfResponse.status()}`,
    );
  }

  const { csrfToken } = await csrfResponse.json();

  const loginResponse = await request.post(auth.callbackPath, {
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
}

// Programmatic login keeps UI login out of setup unless login is under test.
export async function openAuthenticatedPage(
  browser: Browser,
  credentials: Credentials,
): Promise<Page> {
  const auth = getBrowserAuth();
  const webBaseUrl = requireUrl("webBaseUrl");

  const context = await browser.newContext({
    baseURL: webBaseUrl,
  });

  await signInBrowserSession(context.request, credentials);

  const page = await context.newPage();

  await page.goto(auth.landingPath);

  await page.waitForURL(`**${auth.landingPath}`);

  return page;
}
