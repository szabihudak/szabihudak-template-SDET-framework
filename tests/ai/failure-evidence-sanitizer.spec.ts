import { expect, test } from "@playwright/test";

import {
  sanitizePath,
  sanitizeText,
} from "../../src/framework/ai/utils/failureEvidenceSanitizer";

test.describe("failure evidence sanitizer", () => {
  test("keeps repository-relative artifact paths", () => {
    const result = sanitizePath(
      `${process.cwd()}/test-results/example/trace.zip`,
    );

    expect(result).toBe("test-results/example/trace.zip");
  });

  test("removes local machine path outside the repository", () => {
    const result = sanitizePath("/Users/example/private/file.txt");

    expect(result).toBe("file.txt");
  });

  test("preserves repository-relative stack location", () => {
    const result = sanitizeText(
      `at LoginPage.login (${process.cwd()}/src/pages/LoginPage.ts:42:15)`,
    );

    expect(result).toBe("at LoginPage.login (src/pages/LoginPage.ts:42:15)");
  });

  test("redacts bearer tokens", () => {
    const result = sanitizeText("Authorization: Bearer abc.def.ghi");

    expect(result).toBe("Authorization: Bearer [REDACTED]");
  });

  test("redacts database connection strings", () => {
    const result = sanitizeText(
      "connection failed: postgresql://user:password@db.example.com/test",
    );

    expect(result).toBe("connection failed: [REDACTED]");
  });
  test("removes ANSI escape sequences", () => {
    const result = sanitizeText("\u001b[31mExpected\u001b[39m: value");
    expect(result).toBe("Expected: value");
  });

  test("redacts basic authorization credentials", () => {
    const result = sanitizeText("Authorization: Basic dXNlcjpwYXNzd29yZA==");

    expect(result).toBe("Authorization: Basic [REDACTED]");
  });

  test("redacts cookie headers", () => {
    const result = sanitizeText("Cookie: session=abc123; theme=dark");

    expect(result).toBe("Cookie: [REDACTED]");
  });

  test("redacts set-cookie headers", () => {
    const result = sanitizeText(
      "Set-Cookie: next-auth.session-token=secret-value; Path=/; HttpOnly",
    );

    expect(result).toBe("Set-Cookie: [REDACTED]");
  });

  test("redacts token-like key value pairs", () => {
    const result = sanitizeText(
      "access_token=abc123 refresh_token=def456 session=ghi789",
    );

    expect(result).toBe(
      "access_token=[REDACTED] refresh_token=[REDACTED] session=[REDACTED]",
    );
  });

  test("redacts email addresses", () => {
    const result = sanitizeText(
      "User john.doe@example.com could not authenticate",
    );

    expect(result).toBe("User [REDACTED_EMAIL] could not authenticate");
  });
});
