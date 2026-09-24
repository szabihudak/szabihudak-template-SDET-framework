import { expect, test } from "@playwright/test";

import {
  sanitizePath,
  sanitizeText,
} from "../../src/ai/utils/failureEvidenceSanitizer";

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
});
