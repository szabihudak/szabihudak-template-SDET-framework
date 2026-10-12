import { test, expect } from "@app/fixtures/test-fixtures";
import { formatAccessibilityViolations } from "@framework/accessibility/utils/AccessibilityFormatter";

test.describe("Accessibility", { tag: "@selftest" }, () => {
  test("home page has no accessibility violations", async ({
    page,
    accessibility,
  }) => {
    await page.goto("/");

    const result = await accessibility.scanPage();

    expect(
      result.violations,
      formatAccessibilityViolations(result.violations),
    ).toEqual([]);
  });
});
