// @template page-object: Page-level UI structure, actions and locator queries.
// @template Canonical source: src/pages/TasksDashboardPage.ts. Rules: framework/docs/TESTING_STANDARDS.md#page-object-standard
// @template Replace the tokens described in framework/templates/index.json. Fields, locators and test data are illustrative.
import { type Locator, type Page } from "@playwright/test";

import type { __Domain__Priority, __Domain__Status } from "@app/api/constants/__domain__";

export class __Page__Page {
  readonly page: Page;
  readonly heading: Locator;
  readonly __domain__Cards: Locator;
  readonly new__Domain__Button: Locator;
  readonly __domain__TitleInput: Locator;
  readonly create__Domain__Button: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", {
      name: /__domains__|dashboard/i,
    });
    this.__domain__Cards = page.locator('[data-testid^="__domain__-card-"]');
    this.new__Domain__Button = page.getByRole("button", { name: "New __Domain__" });
    this.__domain__TitleInput = page.getByRole("textbox", { name: "Title" });
    this.create__Domain__Button = page.getByRole("button", {
      name: "Create __Domain__",
    });
  }

  async goto(): Promise<void> {
    await this.page.goto("/dashboard");
  }

  async openNew__Domain__Dialog(): Promise<void> {
    await this.new__Domain__Button.click();
  }

  async fill__Domain__Title(title: string): Promise<void> {
    await this.__domain__TitleInput.fill(title);
  }

  async update__Domain__Priority(
    __domain__Id: string,
    priority: __Domain__Priority,
  ): Promise<void> {
    await this.page.getByTestId(`__domain__-menu-${__domain__Id}`).click();
    await this.page.getByRole("menuitem", { name: "Edit" }).click();
    await this.page.getByRole("combobox", { name: "Priority" }).click();
    await this.page
      .getByRole("option", {
        name: priority.charAt(0).toUpperCase() + priority.slice(1),
      })
      .click();
    await this.page.getByRole("button", { name: "Save Changes" }).click();
  }

  __domain__CardByTitle(title: string): Locator {
    return this.__domain__Cards.filter({
      hasText: title,
    });
  }

  __domain__Title(title: string): Locator {
    return this.__domain__CardByTitle(title).getByText(title, {
      exact: true,
    });
  }

  __domain__Description(title: string, description: string): Locator {
    return this.__domain__CardByTitle(title).getByText(description, {
      exact: true,
    });
  }

  __domain__Priority(title: string, priority: __Domain__Priority): Locator {
    return this.__domain__CardByTitle(title).getByText(priority, {
      exact: true,
    });
  }

  emptyColumn(status: __Domain__Status): Locator {
    return this.page.getByTestId(`column-empty-${status}`);
  }
}
