import { AST_NODE_TYPES as T } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { assertions, createRule, descendants, say, tests } from "../ast.ts";

const ID = "ui-tests-assert-the-page";
const SOURCE = "framework/docs/TESTING_STANDARDS.md#ui-spec-standard";
// Matchers that check what the page shows; toHaveURL and toHaveTitle do not.
const PAGE_MATCHERS = new Set([
  "toBeVisible",
  "toBeHidden",
  "toBeEnabled",
  "toBeDisabled",
  "toBeChecked",
  "toBeEditable",
  "toBeEmpty",
  "toBeFocused",
  "toBeAttached",
  "toBeInViewport",
  "toHaveText",
  "toContainText",
  "toHaveValue",
  "toHaveValues",
  "toHaveCount",
  "toHaveAttribute",
  "toHaveClass",
  "toHaveCSS",
  "toHaveId",
  "toHaveJSProperty",
  "toHaveScreenshot",
  "toHaveAccessibleName",
  "toHaveAccessibleDescription",
  "toHaveAccessibleErrorMessage",
  "toHaveRole",
  "toMatchAriaSnapshot",
]);

// Specs tagged @selftest belong to the setup self-test: they run against any
// application, also inside generated test projects, so they cannot know its
// elements. Real project specs never carry the tag.
const isSelfTest = (program: TSESTree.Program) =>
  descendants(program).some(
    (node) =>
      node.type === T.Property &&
      node.key.type === T.Identifier &&
      node.key.name === "tag" &&
      node.value.type === T.Literal &&
      node.value.value === "@selftest",
  );

export default createRule({
  meta: {
    type: "problem",
    messages: {
      noPageAssertion: say(
        ID,
        "This UI test never asserts what the page shows. Add an assertion on a visible element or text; a URL or response check alone is not enough.",
        SOURCE,
      ),
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) => ({
    "Program:exit"(program: TSESTree.Program) {
      if (isSelfTest(program)) return;

      for (const { call, callback } of tests(program)) {
        if (
          !assertions(callback).some(({ matcher }) =>
            PAGE_MATCHERS.has(matcher),
          )
        ) {
          context.report({ node: call, messageId: "noPageAssertion" });
        }
      }
    },
  }),
});
