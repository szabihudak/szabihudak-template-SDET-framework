import rule from "../rules/plan-coverage.ts";
import { PLAN, runPlan } from "./tester.ts";

const SECOND = "| T002_Login_API | API | rejects a short password |";

runPlan("plan-coverage", rule, {
  valid: [
    PLAN,
    PLAN.replace(
      "charter: 30 minutes on error messages",
      "not applicable: the contract tests cover the whole endpoint",
    ),
    // IDs need not be consecutive: an implemented case keeps its ID.
    PLAN.replaceAll("T002_Login_API", "T007_Login_API"),
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
        "not applicable: no unexpected input identified",
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
      code: PLAN.replace(
        "| error handling | not applicable: no unexpected input identified |",
        "| error handling | T002_Login_API |",
      ),
      errors: [{ messageId: "wrongCategory" }],
    },
    {
      code: PLAN.replace(
        "| boundary values | T002_Login_API |",
        "| boundary values | not applicable: none |",
      ).replace(
        "| equivalence classes | not applicable: the contract defines no input classes beyond the password length |",
        "| equivalence classes | T002_Login_API |",
      ),
      errors: [{ messageId: "uncovered" }, { messageId: "wrongCategory" }],
    },
    {
      code: PLAN.replace(
        "| happy path | T001_Login_API |\n| boundary values | T002_Login_API |",
        "| boundary values | T002_Login_API |\n| happy path | T001_Login_API |",
      ),
      errors: [{ messageId: "order" }],
    },
    {
      // A boundary case before the happy path.
      code: (() => {
        const lines = PLAN.split("\n");
        const first = lines.findIndex((line) => line.startsWith("| T001"));
        [lines[first], lines[first + 1]] = [lines[first + 1], lines[first]];
        return lines.join("\n");
      })(),
      errors: [{ messageId: "caseOrder" }],
    },
    {
      // A Negative case before a Positive one in the same category.
      code: PLAN.replace(
        `${SECOND} boundary value analysis | Negative |`,
        `${SECOND} boundary value analysis | Negative |`,
      )
        .replace(
          "| Medium | Yes | contract |\n",
          "| Medium | Yes | contract |\n| T003_Login_API | API | accepts a six-character password | boundary value analysis | Positive | 1. Log in.<br>2. Check. | HTTP 200 | R2 | Medium | Yes | contract |\n",
        )
        .replace(
          "| boundary values | T002_Login_API |",
          "| boundary values | T002_Login_API, T003_Login_API |",
        ),
      errors: [{ messageId: "caseOrder" }],
    },
    {
      code: PLAN.replace(/## Coverage[\s\S]*$/, ""),
      errors: [{ messageId: "noTable" }],
    },
  ],
});
