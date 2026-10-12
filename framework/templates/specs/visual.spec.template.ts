// @template visual-spec: Page-level and component-level screenshot contracts on deterministic state.
// @template Canonical source: tests/visual/visual.spec.ts. Rules: framework/docs/TESTING_STANDARDS.md#visual-regression-test-standard
// @template Replace the tokens described in framework/templates/index.json. Fields, locators and test data are illustrative.
import { create__Domain__ } from "@app/data/__domain__Factory";
import { test, expect } from "@app/fixtures/test-fixtures";
import { VISUAL_COMPARISON_OPTIONS } from "@framework/visual/constants/visualComparison";

test.describe("Visual regression", () => {
  test("authenticated dashboard matches the approved visual baseline", async ({
    __domain__Api,
    authenticatedTestUser,
    __page__Page,
  }) => {
    const __domain__ = create__Domain__({
      title: "Visual Regression __Domain__ - Page",
      description: "Stable visual regression fixture",
      priority: "high",
      status: "done",
    });
    await __domain__Api.create__Domain__ForUser(__domain__, authenticatedTestUser.accessToken);
    await __page__Page.goto();
    await expect(__page__Page.__domain__CardByTitle(__domain__.title)).toBeVisible();

    await expect(__page__Page.page).toHaveScreenshot(
      "__domain__-dashboard.png",
      VISUAL_COMPARISON_OPTIONS,
    );
  });

  test("the __domain__ card matches the approved visual baseline", async ({
    __domain__Api,
    authenticatedTestUser,
    __page__Page,
  }) => {
    const __domain__ = create__Domain__({
      title: "Visual Regression __Domain__ - Card",
      description: "Stable visual regression fixture",
      priority: "low",
      status: "in_progress",
    });
    await __domain__Api.create__Domain__ForUser(__domain__, authenticatedTestUser.accessToken);
    await __page__Page.goto();
    const __domain__Card = __page__Page.__domain__CardByTitle(__domain__.title);
    await expect(__domain__Card).toBeVisible();

    await expect(__domain__Card).toHaveScreenshot(
      "__domain__-card.png",
      VISUAL_COMPARISON_OPTIONS,
    );
  });
});
