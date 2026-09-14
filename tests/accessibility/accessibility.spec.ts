import { test, expect } from "../../src/fixtures/test-fixtures";
import { formatAccessibilityViolations } from "../../src/accessibility/utils/AccessibilityFormatter";

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
    tasksDashboardPage,
    authenticatedAccessibility,
  }) => {
    await tasksDashboardPage.goto();

    const result = await authenticatedAccessibility.scanPage();

    expect(
      result.violations,
      formatAccessibilityViolations(result.violations),
    ).toEqual([]);
  });

});
