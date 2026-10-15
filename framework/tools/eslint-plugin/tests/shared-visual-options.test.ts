import rule from "../rules/shared-visual-options.ts";
import { run } from "./tester.ts";

run("shared-visual-options", rule, {
  valid: [
    'await expect(page).toHaveScreenshot("dashboard.png", VISUAL_COMPARISON_OPTIONS);',
    'await expect(card).toHaveScreenshot("card.png", { ...VISUAL_COMPARISON_OPTIONS });',
    '// visual-exception: clock (shows the current time)\nawait expect(page).toHaveScreenshot("page.png", { ...VISUAL_COMPARISON_OPTIONS, mask: [clock] });',
  ],
  invalid: [
    {
      code: 'await expect(page).toHaveScreenshot("dashboard.png");',
      errors: [{ messageId: "deviation" }],
    },
    {
      code: 'await expect(page).toHaveScreenshot("page.png", { ...VISUAL_COMPARISON_OPTIONS, maxDiffPixels: 100 });',
      errors: [{ messageId: "deviation" }],
    },
  ],
});
