import rule from "../rules/plan-case-steps.ts";
import { PLAN, runPlan } from "./tester.ts";

runPlan("plan-case-steps", rule, {
  valid: [PLAN],
  invalid: [
    {
      code: PLAN.replace(
        "### T002_Login_API\n\n1. Log in with a five-character password.\n",
        "",
      ),
      errors: [{ messageId: "missing" }],
    },
    {
      code: PLAN.replace(
        "1. Log in with a five-character password.",
        "- Log in with a five-character password.",
      ),
      errors: [{ messageId: "missing" }],
    },
    {
      code: `${PLAN}\n### T009_Login_API\n\n1. Not planned.\n`,
      errors: [{ messageId: "unknown" }],
    },
  ],
});
