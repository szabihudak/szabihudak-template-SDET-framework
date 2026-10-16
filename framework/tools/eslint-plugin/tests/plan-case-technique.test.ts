import rule from "../rules/plan-case-technique.ts";
import { PLAN, runPlan } from "./tester.ts";

runPlan("plan-case-technique", rule, {
  valid: [
    PLAN,
    PLAN.replace(
      "| boundary value analysis | Negative |",
      "| boundary value analysis | Positive |",
    ),
    "# Notes without a Cases table\n",
  ],
  invalid: [
    {
      code: PLAN.replace(
        "| happy path | Positive |",
        "| happy path, error guessing | Positive |",
      ),
      errors: [{ messageId: "technique" }],
    },
    {
      code: PLAN.replace("| boundary value analysis |", "| |"),
      errors: [{ messageId: "technique" }],
    },
    {
      code: PLAN.replace("| happy path | Positive |", "| smoke | Positive |"),
      errors: [{ messageId: "technique" }],
    },
    {
      code: PLAN.replace("| Technique |", "| Method |"),
      errors: [{ messageId: "noColumn", data: { column: "Technique" } }],
    },
    {
      code: PLAN.replace("| Type |", "| Kind |"),
      errors: [{ messageId: "noColumn", data: { column: "Type" } }],
    },
    {
      code: PLAN.replace(
        "| happy path | Positive |",
        "| happy path | Negative |",
      ),
      errors: [{ messageId: "type" }],
    },
    {
      code: PLAN.replace(
        "| boundary value analysis | Negative |",
        "| error guessing | Positive |",
      ),
      errors: [{ messageId: "type" }],
    },
    {
      code: PLAN.replace(
        "| boundary value analysis | Negative |",
        "| boundary value analysis | negative case |",
      ),
      errors: [{ messageId: "type" }],
    },
  ],
});
