import { type Locator, type Page } from "@playwright/test";

import type { TaskPriority, TaskStatus } from "../api/constants/task";

export class TasksDashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly taskCards: Locator;
  readonly newTaskButton: Locator;
  readonly taskTitleInput: Locator;
  readonly createTaskButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", {
      name: /tasks|dashboard/i,
    });
    this.taskCards = page.locator('[data-testid^="task-card-"]');
    this.newTaskButton = page.getByRole("button", { name: "New Task" });
    this.taskTitleInput = page.getByRole("textbox", { name: "Title" });
    this.createTaskButton = page.getByRole("button", {
      name: "Create Task",
    });
  }

  async goto(): Promise<void> {
    await this.page.goto("/dashboard");
  }

  async openNewTaskDialog(): Promise<void> {
    await this.newTaskButton.click();
  }

  async fillTaskTitle(title: string): Promise<void> {
    await this.taskTitleInput.fill(title);
  }

  async updateTaskPriority(
    taskId: string,
    priority: TaskPriority,
  ): Promise<void> {
    await this.page.getByTestId(`task-menu-${taskId}`).click();
    await this.page.getByRole("menuitem", { name: "Edit" }).click();
    await this.page.getByRole("combobox", { name: "Priority" }).click();
    await this.page
      .getByRole("option", {
        name: priority.charAt(0).toUpperCase() + priority.slice(1),
      })
      .click();
    await this.page.getByRole("button", { name: "Save Changes" }).click();
  }

  taskCardByTitle(title: string): Locator {
    return this.taskCards.filter({
      hasText: title,
    });
  }

  taskTitle(title: string): Locator {
    return this.taskCardByTitle(title).getByText(title, {
      exact: true,
    });
  }

  taskDescription(title: string, description: string): Locator {
    return this.taskCardByTitle(title).getByText(description, {
      exact: true,
    });
  }

  taskPriority(title: string, priority: TaskPriority): Locator {
    return this.taskCardByTitle(title).getByText(priority, {
      exact: true,
    });
  }

  emptyColumn(status: TaskStatus): Locator {
    return this.page.getByTestId(`column-empty-${status}`);
  }
}
