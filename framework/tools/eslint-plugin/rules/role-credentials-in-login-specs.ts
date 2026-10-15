import { AST_NODE_TYPES as T } from "@typescript-eslint/utils";
import { createRule, isCallTo, previousLine, say } from "../ast.ts";

const ID = "role-credentials-in-login-specs";
const SOURCE = "framework/docs/TESTING_STANDARDS.md#authentication-standard";
const LOGIN_SPEC = /(login|authentication)[^/]*\.spec\.ts$/;
const OWN_LOGIN = /\/\/\s*own-login:\s*\S/;

// Only login specs sign in themselves; every other spec gets its token or page
// from the role fixtures, unless "// own-login: <reason>" stands above the call.
export default createRule({
  meta: {
    type: "problem",
    messages: {
      ownLogin: say(
        ID,
        'Only login specs sign in with role credentials. Get the token or page from the role fixtures (apiTokenFor(role), authenticatedPageFor(...)), or write "// own-login: <reason>" above the call.',
        SOURCE,
      ),
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) =>
    LOGIN_SPEC.test(context.filename.split("\\").join("/"))
      ? {}
      : {
          CallExpression(node) {
            const login =
              node.callee.type === T.MemberExpression &&
              node.callee.property.type === T.Identifier &&
              node.callee.property.name === "login";

            if (
              (isCallTo(node, "getRoleCredentials") || login) &&
              !OWN_LOGIN.test(previousLine(context, node))
            ) {
              context.report({ node, messageId: "ownLogin" });
            }
          },
        },
});
