import { type Locator, type Page } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId("login-title");
    this.emailInput = page.getByTestId("login-email-input");
    this.passwordInput = page.getByTestId("login-password-input");
    this.loginButton = page.getByTestId("login-submit-button");
    this.errorMessage = page.getByTestId("login-error");
  }

  async goto(): Promise<void> {
    await this.page.goto("/login");
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}
