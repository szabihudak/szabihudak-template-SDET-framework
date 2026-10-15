// @template ui-spec: Browser behavior with API setup, Page Object interaction and a mocked error state.
// @template Canonical source: tests/ui/task-dashboard.spec.ts. Rules: framework/docs/TESTING_STANDARDS.md#ui-spec-standard
// @template Replace the tokens described in framework/templates/index.json. Fields, locators and test data are illustrative.
import { test, expect } from "@app/fixtures/test-fixtures";
import { create__Domain__ } from "@app/data/__domain__Factory";
import { mock__Domains__ServerError } from "@app/mocks/__domain__ApiMock";

test.describe("__Domain__ Dashboard tests", () => {
  test("T001___Domain__Dashboard_E2E: keeps Create __Domain__ disabled until a title is entered", async ({
    __page__Page,
  }) => {
    await __page__Page.goto();
    await __page__Page.openNew__Domain__Dialog();
    await expect(__page__Page.create__Domain__Button).toBeDisabled();

    await __page__Page.fill__Domain__Title("UI validation __domain__");

    await expect(__page__Page.create__Domain__Button).toBeEnabled();
  });

  test("T002___Domain__Dashboard_E2E: authenticated user sees the __domains__ on the dashboard", async ({
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

  test("T003___Domain__Dashboard_E2E: updates __domain__ priority through the edit dialog", async ({
    __domain__Api,
    __page__Page,
    created__Domain__,
    authenticatedTestUser,
  }) => {
    const __domain__ToUpdate = created__Domain__.response;
    const unchanged__Domain__ = await __domain__Api.create__Domain__ForUser(
      create__Domain__({
        title: "Priority Update Unchanged __Domain__",
        description: "__Domain__ that should retain its original priority",
        priority: "medium",
        status: "backlog",
      }),
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

  test("T004___Domain__Dashboard_E2E: shows error state when __domains__ API fails", async ({
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
