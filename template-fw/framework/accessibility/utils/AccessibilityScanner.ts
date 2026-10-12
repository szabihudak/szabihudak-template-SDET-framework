import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { WCAG_AA_TAGS } from "../constants/accessibilityTags";

export class AccessibilityScanner {
  constructor(private readonly page: Page) {}

  async scanPage() {
    return await new AxeBuilder({ page: this.page })
      .withTags([...WCAG_AA_TAGS])
      .analyze();
  }
}
