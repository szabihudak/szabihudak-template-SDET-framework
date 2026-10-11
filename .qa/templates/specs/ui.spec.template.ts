// @template ui-spec: Browser behavior with API setup, Page Object interaction and a mocked error state.
// @template Canonical source: tests/ui/task-dashboard.spec.ts. Rules: docs/TESTING_STANDARDS.md#ui-spec-standard
// @template Replace the tokens described in .qa/index.json. Fields, locators and test data are illustrative.
import { test, expect } from "../../src/app/fixtures/test-fixtures";
import { mock__Domains__ServerError } from "../../src/app/mocks/__domain__ApiMock";

test.describe("__Domain__ Dashboard tests", () => {
  test("keeps Create __Domain__ disabled until a title is entered", async ({
    __page__Page,
  }) => {
    await __page__Page.goto();
    await __page__Page.openNew__Domain__Dialog();
    await expect(__page__Page.create__Domain__Button).toBeDisabled();

    await __page__Page.fill__Domain__Title("UI validation __domain__");

    await expect(__page__Page.create__Domain__Button).toBeEnabled();
  });

  test("authenticated user sees the __domains__ on the dashboard", async ({
    __page__Page,
    created__Domain__,
  }) => {
    const { request } = created__Domain__;

    await __page__Page.goto();

    await expect(__page__Page.__domain__Title(request.title)).toHaveText(
      request.title,
    );
    await expect(
      __page__Page.__domain__Description(request.title, request.description),
    ).toHaveText(request.description);
    await expect(
      __page__Page.__domain__Priority(request.title, request.priority),
    ).toHaveText(request.priority);
  });

  test("updates __domain__ priority through the edit dialog", async ({
    __domain__Api,
    __page__Page,
    created__Domain__,
    authenticatedTestUser,
  }) => {
    const __domain__ToUpdate = created__Domain__.response;
    const unchanged__Domain__ = await __domain__Api.create__Domain__ForUser(
      {
        title: "Priority Update Unchanged __Domain__",
        description: "__Domain__ that should retain its original priority",
        priority: "medium",
        status: "backlog",
      },
      authenticatedTestUser.accessToken,
    );
    const updatedPriority = "high";

    await __page__Page.goto();

    await expect(
      __page__Page.__domain__Priority(
        __domain__ToUpdate.title,
        __domain__ToUpdate.priority,
      ),
    ).toHaveText(__domain__ToUpdate.priority);
    await expect(
      __page__Page.__domain__Priority(
        unchanged__Domain__.title,
        unchanged__Domain__.priority,
      ),
    ).toHaveText(unchanged__Domain__.priority);

    await __page__Page.update__Domain__Priority(
      __domain__ToUpdate.id,
      updatedPriority,
    );

    await expect(
      __page__Page.__domain__Priority(__domain__ToUpdate.title, updatedPriority),
    ).toHaveText(updatedPriority);
    await expect(
      __page__Page.__domain__Priority(
        unchanged__Domain__.title,
        unchanged__Domain__.priority,
      ),
    ).toHaveText(unchanged__Domain__.priority);

    await __page__Page.goto();

    await expect(
      __page__Page.__domain__Priority(__domain__ToUpdate.title, updatedPriority),
    ).toHaveText(updatedPriority);
    await expect(
      __page__Page.__domain__Priority(
        unchanged__Domain__.title,
        unchanged__Domain__.priority,
      ),
    ).toHaveText(unchanged__Domain__.priority);
  });

  test("shows error state when __domains__ API fails", async ({
    authenticatedPage,
    __page__Page,
  }) => {
    await mock__Domains__ServerError(authenticatedPage);

    await __page__Page.goto();

    await expect(__page__Page.emptyColumn("backlog")).toHaveText(
      "No __domains__",
    );
    await expect(__page__Page.emptyColumn("in_progress")).toHaveText(
      "No __domains__",
    );
    await expect(__page__Page.emptyColumn("done")).toHaveText("No __domains__");
  });
});
