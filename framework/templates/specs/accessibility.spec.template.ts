// @template accessibility-spec: Full-page automated accessibility scans of public and authenticated pages.
// @template Canonical source: tests/accessibility/accessibility.spec.ts. Rules: framework/docs/TESTING_STANDARDS.md#accessibility-test-standard
// @template Replace the tokens described in framework/templates/index.json. Fields, locators and test data are illustrative.
import { formatAccessibilityViolations } from "@framework/accessibility/utils/AccessibilityFormatter";
import { test, expect } from "@app/fixtures/test-fixtures";

test.describe("Accessibility", () => {
  test("home page has no accessibility violations", async ({
    homePage,
    accessibility,
  }) => {
    await homePage.goto();

    const result = await accessibility.scanPage();

    expect(
      result.violations,
      formatAccessibilityViolations(result.violations),
    ).toEqual([]);
  });

  test("authenticated dashboard has no accessibility violations", async ({
    __page__Page,
    authenticatedAccessibility,
  }) => {
    await __page__Page.goto();

    const result = await authenticatedAccessibility.scanPage();

    expect(
      result.violations,
      formatAccessibilityViolations(result.violations),
    ).toEqual([]);
  });
});
