import { AST_NODE_TYPES as T } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import {
  assertions,
  code,
  createRule,
  descendants,
  previousLine,
  say,
  schemaValidations,
  tests,
} from "../ast.ts";

const ID = "no-partial-success-comparison";
const SOURCE = "framework/docs/TESTING_STANDARDS.md#api-test-standard";
const PARTIAL = /\/\/\s*partial:\s*\S/;

const isObjectContaining = (node: TSESTree.Node) =>
  node.type === T.CallExpression &&
  node.callee.type === T.MemberExpression &&
  node.callee.object.type === T.Identifier &&
  node.callee.object.name === "expect" &&
  node.callee.property.type === T.Identifier &&
  node.callee.property.name === "objectContaining";

// A validated body, or an object in it, compared with toMatchObject or
// expect.objectContaining: unless "// partial: <reason>" stands above it,
// missing fields and unexpected values pass unnoticed.
export default createRule({
  meta: {
    type: "problem",
    messages: {
      partial: say(
        ID,
        '"{{subject}}" is compared partially. Compare it as a whole with toEqual or toStrictEqual, or write "// partial: <reason>" above the assertion.',
        SOURCE,
      ),
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) => ({
    "Program:exit"(program: TSESTree.Program) {
      for (const { callback } of tests(program)) {
        const validated = new Set(
          schemaValidations(callback).map(({ variable }) => variable),
        );

        for (const { call, subject, matcher } of assertions(callback)) {
          const text = code(context, subject);
          const ofBody = [...validated].some((variable) =>
            new RegExp(`^${variable}(?![\\w$])`).test(text),
          );
          const partial =
            matcher === "toMatchObject" ||
            call.arguments.some((argument) =>
              [argument, ...descendants(argument)].some(isObjectContaining),
            );

          if (ofBody && partial && !PARTIAL.test(previousLine(context, call))) {
            context.report({
              node: call,
              messageId: "partial",
              data: { subject: text },
            });
          }
        }
      }
    },
  }),
});
