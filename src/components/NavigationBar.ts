import { type Locator, type Page } from "@playwright/test";

export class NavigationBar {
  readonly page: Page;
  readonly navigation: Locator;
  readonly logoLink: Locator;
  readonly loginLink: Locator;
  readonly registerLink: Locator;
  readonly userMenuButton: Locator;
  readonly userName: Locator;
  readonly userEmail: Locator;
  readonly dashboardLink: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navigation = page.getByTestId("main-navigation");
    this.logoLink = this.navigation.getByTestId("app-logo-link");
    this.loginLink = this.navigation.getByTestId("nav-login-link");
    this.registerLink = this.navigation.getByTestId("nav-register-link");
    this.userMenuButton = this.navigation.getByTestId("user-menu-button");

    this.userName = page.getByTestId("user-name");
    this.userEmail = page.getByTestId("user-email");
    this.dashboardLink = page.getByTestId("nav-dashboard-link");
    this.logoutButton = page.getByTestId("nav-logout-button");
  }

  async openUserMenu(): Promise<void> {
    await this.userMenuButton.click();
  }
}
