import type { TSESTree } from "@typescript-eslint/utils";
import {
  assertions,
  code,
  createRule,
  say,
  schemaValidations,
  tests,
} from "../ast.ts";
import {
  ancestors,
  importedNames,
  loadSchema,
  schemaFields,
} from "../schemas.ts";

const ID = "api-field-coverage";
const SOURCE = "framework/docs/TESTING_STANDARDS.md#api-test-standard";
const UNASSERTED = /^\s*unasserted:\s*([^(\n]+?)\s*(?:\(([^)\n]*)\))?\s*$/;

// Every field of a schema a test validates against, including the fields of
// nested objects, is asserted in some test of the file (directly, or through
// an enclosing object compared with toEqual or toStrictEqual), declares a
// format in the schema, or is listed in an "// unasserted: user.id (reason)"
// comment.
export default createRule({
  meta: {
    type: "problem",
    messages: {
      uncovered: say(
        ID,
        '{{schema}} field "{{field}}" is not asserted, has no format in the schema and is not listed in an "// unasserted: {{field}} (reason)" comment.',
        SOURCE,
      ),
      noReason: say(
        ID,
        'The "unasserted: {{fields}}" comment needs a reason in parentheses.',
        SOURCE,
      ),
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) => ({
    "Program:exit"(program: TSESTree.Program) {
      const exempt = new Set<string>();

      for (const comment of context.sourceCode.getAllComments()) {
        const match = UNASSERTED.exec(comment.value);
        if (!match) continue;
        const [, fields, reason] = match;
        if (!reason?.trim()) {
          context.report({
            loc: comment.loc,
            messageId: "noReason",
            data: { fields },
          });
        }
        for (const field of fields.split(",")) exempt.add(field.trim());
      }

      const validations = tests(program).flatMap(({ callback }) =>
        schemaValidations(callback),
      );
      const imports = importedNames(program, context.filename, context.cwd);
      // Assertion subjects, and those compared as a whole object.
      const asserted = assertions(program).map((item) => ({
        subject: code(context, item.subject),
        whole: item.matcher === "toEqual" || item.matcher === "toStrictEqual",
      }));

      for (const schemaName of new Set(validations.map((v) => v.schema))) {
        const file = imports.get(schemaName);
        const schema = file && loadSchema(file, schemaName, context.cwd);
        if (!schema) continue;

        const forSchema = validations.filter((v) => v.schema === schemaName);
        const variables = new Set(forSchema.map((v) => v.variable));
        const path = (variable: string, field: string) =>
          field ? `${variable}.${field}` : variable;

        for (const { path: field, format } of schemaFields(schema)) {
          const covered = [...variables].some(
            (variable) =>
              asserted.some(({ subject }) =>
                new RegExp(
                  `^${path(variable, field).replace(/\./g, "\\.")}(?![\\w$])`,
                ).test(subject),
              ) ||
              ancestors(field).some((ancestor) =>
                asserted.some(
                  ({ subject, whole }) =>
                    whole && subject === path(variable, ancestor),
                ),
              ),
          );
          const listed = [field, ...ancestors(field)].some((name) =>
            exempt.has(name),
          );

          if (!covered && !format && !listed) {
            context.report({
              node: forSchema[0].call,
              messageId: "uncovered",
              data: { schema: schemaName, field },
            });
          }
        }
      }
    },
  }),
});
