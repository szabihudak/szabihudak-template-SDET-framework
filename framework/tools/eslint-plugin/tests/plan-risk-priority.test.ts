import rule from "../rules/plan-risk-priority.ts";
import { PLAN, runPlan } from "./tester.ts";

runPlan("plan-risk-priority", rule, {
  valid: [
    PLAN,
    PLAN.replace(
      "| R2 | Medium | Yes |",
      "| R2 | Medium | No: needs a fresh account per run |",
    ),
  ],
  invalid: [
    {
      code: PLAN.replace(
        "| High | Medium | High |",
        "| High | Medium | Medium |",
      ),
      errors: [{ messageId: "level" }],
    },
    {
      code: PLAN.replace(
        "| High | Medium | High |",
        "| Severe | Medium | High |",
      ),
      errors: [{ messageId: "rating" }, { messageId: "risk" }],
    },
    {
      code: PLAN.replace("| R1 | High | Yes |", "| R1 | Medium | Yes |"),
      errors: [{ messageId: "priority" }],
    },
    {
      code: PLAN.replace("| R2 | Medium | Yes |", "| R2 | Medium | No |"),
      errors: [{ messageId: "regression" }],
    },
    {
      code: PLAN.replace("| R2 | Medium | Yes |", "| R9 | Medium | Yes |"),
      errors: [{ messageId: "uncovered" }, { messageId: "risk" }],
    },
    {
      code: PLAN.replace(/## Risks[\s\S]*?(?=## Cases)/, ""),
      errors: [{ messageId: "noTable" }],
    },
  ],
});
