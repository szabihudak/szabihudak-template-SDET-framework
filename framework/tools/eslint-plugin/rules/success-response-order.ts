import type { TSESTree } from "@typescript-eslint/utils";
import {
  assertions,
  code,
  createRule,
  responseBodies,
  say,
  schemaValidations,
  SUCCESS_STATUS,
  tests,
} from "../ast.ts";

const ID = "success-response-order";
const SOURCE = "framework/docs/TESTING_STANDARDS.md#api-test-standard";

// A successful response: status, then validateSchema(), then the fields.
export default createRule({
  meta: {
    type: "problem",
    messages: {
      notValidated: say(
        ID,
        'The successful response "{{body}}" is not validated. Call validateSchema(<schema>, {{body}}) right after the status assertion, then assert its fields.',
        SOURCE,
      ),
      assertedEarly: say(
        ID,
        '"{{body}}" is asserted before validateSchema(). Assert the status, then validateSchema(), then the fields.',
        SOURCE,
      ),
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) => ({
    "Program:exit"(program: TSESTree.Program) {
      for (const { callback } of tests(program)) {
        for (const { variable, declaration, status } of responseBodies(
          context,
          callback,
        )) {
          if (!status || !SUCCESS_STATUS.test(status)) continue;

          const validated = schemaValidations(callback).find(
            (validation) => validation.variable === variable,
          );
          if (!validated) {
            context.report({
              node: declaration,
              messageId: "notValidated",
              data: { body: variable },
            });
            continue;
          }
          const early = assertions(callback).find(
            ({ subject, call }) =>
              new RegExp(`^${variable}(?![\\w$])`).test(
                code(context, subject),
              ) && call.range[0] < validated.call.range[0],
          );
          if (early) {
            context.report({
              node: early.call,
              messageId: "assertedEarly",
              data: { body: variable },
            });
          }
        }
      }
    },
  }),
});
