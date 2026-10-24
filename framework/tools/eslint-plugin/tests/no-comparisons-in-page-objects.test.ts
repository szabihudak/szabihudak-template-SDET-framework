import rule from "../rules/no-comparisons-in-page-objects.ts";
import { run } from "./tester.ts";

run("no-comparisons-in-page-objects", rule, {
  valid: [
    "class P { row(id) { return this.page.getByTestId(`task-${id}`); } }",
    'class P { async open(tab) { await this.page.getByRole("tab", { name: tab === "all" ? "All" : tab }).click(); } }',
    "class P { async titles() { return this.rows.allTextContents(); } }",
  ],
  invalid: [
    {
      code: 'class P { async isSaved() { return (await this.toast.textContent()) === "Saved"; } }',
      errors: [{ messageId: "comparison" }],
    },
    {
      code: "class P { async hasRows() { return (await this.rows.count()) > 0; } }",
      errors: [{ messageId: "comparison" }],
    },
    {
      code: 'class P { async verify() { if (!(await this.toast.isVisible())) throw new Error("not saved"); } }',
      errors: [{ messageId: "thrown" }],
    },
  ],
});
