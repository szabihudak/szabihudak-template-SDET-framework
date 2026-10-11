import { type Locator, type Page } from "@playwright/test";

import type { TestUser } from "../api/models/User";

export class RegisterPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly registerButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId("register-title");
    this.nameInput = page.getByTestId("register-name-input");
    this.emailInput = page.getByTestId("register-email-input");
    this.passwordInput = page.getByTestId("register-password-input");
    this.confirmPasswordInput = page.getByTestId(
      "register-confirm-password-input",
    );
    this.registerButton = page.getByTestId("register-submit-button");
    this.errorMessage = page.getByTestId("register-error");
    this.successMessage = page.getByTestId("register-success");
  }

  async goto(): Promise<void> {
    await this.page.goto("/register");
  }

  async register(user: TestUser): Promise<void> {
    await this.nameInput.fill(user.name);
    await this.emailInput.fill(user.email);
    await this.passwordInput.fill(user.password);
    await this.confirmPasswordInput.fill(user.password);
    await this.registerButton.click();
  }
}
