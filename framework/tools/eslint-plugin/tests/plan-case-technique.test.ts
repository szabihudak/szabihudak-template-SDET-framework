import rule from "../rules/plan-case-technique.ts";
import { PLAN, runPlan } from "./tester.ts";

runPlan("plan-case-technique", rule, {
  valid: [PLAN, "# Notes without a Cases table\n"],
  invalid: [
    {
      code: PLAN.replace("| happy path |", "| happy path, error guessing |"),
      errors: [{ messageId: "technique" }],
    },
    {
      code: PLAN.replace("| boundary value analysis |", "| |"),
      errors: [{ messageId: "technique" }],
    },
    {
      code: PLAN.replace("| happy path |", "| smoke |"),
      errors: [{ messageId: "technique" }],
    },
    {
      code: PLAN.replace("| Technique |", "| Method |"),
      errors: [{ messageId: "noColumn" }],
    },
  ],
});
