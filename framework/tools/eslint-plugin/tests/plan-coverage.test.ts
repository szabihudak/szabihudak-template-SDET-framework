import rule from "../rules/plan-coverage.ts";
import { PLAN, runPlan } from "./tester.ts";

runPlan("plan-coverage", rule, {
  valid: [
    PLAN,
    PLAN.replace(
      "charter: 30 minutes on error messages",
      "not applicable: the contract tests cover the whole endpoint",
    ),
  ],
  invalid: [
    {
      code: PLAN.replace(
        "| exploratory | charter: 30 minutes on error messages |\n",
        "",
      ),
      errors: [{ messageId: "missing", data: { category: "exploratory" } }],
    },
    {
      code: PLAN.replace(
        "not applicable: login is a public endpoint",
        "not applicable:",
      ),
      errors: [{ messageId: "value" }],
    },
    {
      code: PLAN.replace(
        "| happy path | T001_Login_API |",
        "| happy path | T009_Login_API |",
      ),
      errors: [{ messageId: "uncovered" }, { messageId: "value" }],
    },
    {
      code: PLAN.replace(
        "charter: 30 minutes on error messages",
        "T001_Login_API",
      ),
      errors: [{ messageId: "value" }],
    },
    {
      code: PLAN.replace(
        "| happy path | T001_Login_API |",
        "| smoke | T001_Login_API |",
      ),
      errors: [
        { messageId: "uncovered" },
        { messageId: "missing", data: { category: "happy path" } },
        { messageId: "unknownCategory" },
      ],
    },
    {
      code: PLAN.replace(/## Coverage[\s\S]*?(?=## Steps)/, ""),
      errors: [{ messageId: "noTable" }],
    },
  ],
});
