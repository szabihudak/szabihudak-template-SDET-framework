import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

export class AccessibilityScanner {
  constructor(private readonly page: Page) {}

  async scanPage() {
    return await new AxeBuilder({ page: this.page }).analyze();
  }

  async scan(selector: string) {
    return await new AxeBuilder({ page: this.page })
      .include(selector)
      .analyze();
  }
}
