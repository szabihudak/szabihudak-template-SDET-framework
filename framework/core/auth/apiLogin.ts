import type { APIRequestContext } from "@playwright/test";

import { getFrameworkConfig } from "../config/frameworkConfig";
import { requireUrl } from "../utils/env";
import type { Credentials } from "./credentials";

export async function getApiAccessToken(
  request: APIRequestContext,
  credentials: Credentials,
): Promise<string> {
  const auth = getFrameworkConfig().auth.api;

  if (auth.strategy === "none") {
    throw new Error(
      "API authentication is disabled. Configure auth.api in config/framework.config.ts.",
    );
  }

  const apiBaseUrl = requireUrl("apiBaseUrl");

  const response = await request.post(`${apiBaseUrl}${auth.loginPath}`, {
    data: {
      [auth.usernameField]: credentials.username,
      [auth.passwordField]: credentials.password,
    },
  });

  if (!response.ok()) {
    throw new Error(
      `API authentication failed: ${response.status()} ${await response.text()}`,
    );
  }

  const body: unknown = await response.json();
  const token =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)[auth.tokenField]
      : undefined;

  if (typeof token !== "string" || token.length === 0) {
    throw new Error(
      `API authentication response does not contain a string "${auth.tokenField}" field.`,
    );
  }

  return token;
}
