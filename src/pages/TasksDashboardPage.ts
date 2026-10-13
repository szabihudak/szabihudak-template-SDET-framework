import { type Locator, type Page } from "@playwright/test";

import type { TaskPriority, TaskStatus } from "@app/api/constants/task";

export class TasksDashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly taskCards: Locator;
  readonly newTaskButton: Locator;
  readonly taskTitleInput: Locator;
  readonly createTaskButton: Locator;
  readonly editMenuItem: Locator;
  readonly priorityCombobox: Locator;
  readonly saveChangesButton: Locator;

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
    this.editMenuItem = page.getByRole("menuitem", { name: "Edit" });
    this.priorityCombobox = page.getByRole("combobox", { name: "Priority" });
    this.saveChangesButton = page.getByRole("button", { name: "Save Changes" });
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
    await this.taskMenuButton(taskId).click();
    await this.editMenuItem.click();
    await this.priorityCombobox.click();
    await this.priorityOption(priority).click();
    await this.saveChangesButton.click();
  }

  taskMenuButton(taskId: string): Locator {
    return this.page.getByTestId(`task-menu-${taskId}`);
  }

  priorityOption(priority: TaskPriority): Locator {
    return this.page.getByRole("option", {
      name: priority.charAt(0).toUpperCase() + priority.slice(1),
    });
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
