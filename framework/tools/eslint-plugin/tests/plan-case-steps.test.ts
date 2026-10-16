import rule from "../rules/plan-case-steps.ts";
import { PLAN, runPlan } from "./tester.ts";

runPlan("plan-case-steps", rule, {
  valid: [
    PLAN,
    PLAN.replace("2. Check the status.", "2. Check the status.<br/>3. Done."),
  ],
  invalid: [
    {
      code: PLAN.replace("<br>2. Check the status.", ""),
      errors: [{ messageId: "steps" }],
    },
    {
      code: PLAN.replace(
        "<br>2. Check the status.",
        "<br>3. Check the status.",
      ),
      errors: [{ messageId: "steps" }],
    },
    {
      code: PLAN.replace(
        "1. Log in with a five-character password.<br>2. Check the status.",
        "Log in with a five-character password and check the status.",
      ),
      errors: [{ messageId: "steps" }],
    },
    {
      code: PLAN.replace("| Steps |", "| Notes |"),
      errors: [{ messageId: "noColumn" }],
    },
    {
      code: `${PLAN}\n## Steps\n\n### T001_Login_API\n\n1. Log in.\n`,
      errors: [{ messageId: "section" }],
    },
  ],
});
