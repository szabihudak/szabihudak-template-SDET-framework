import rule from "../rules/role-credentials-in-login-specs.ts";
import { run } from "./tester.ts";

const login = `import { getRoleCredentials } from "@framework/auth/roles";
const credentials = getRoleCredentials("user");
const response = await userApi.login(credentials);`;

run("role-credentials-in-login-specs", rule, {
  valid: [
    { filename: "/repo/tests/api/user-authentication.spec.ts", code: login },
    { filename: "/repo/tests/ui/login.spec.ts", code: login },
    {
      filename: "/repo/tests/api/create-task.spec.ts",
      code: 'const token = await apiTokenFor("user");',
    },
    {
      filename: "/repo/tests/api/session-expiry.spec.ts",
      code: `// own-login: the test needs a fresh session it can let expire
const response = await userApi.login(credentials);`,
    },
  ],
  invalid: [
    {
      filename: "/repo/tests/api/create-task.spec.ts",
      code: login,
      errors: [{ messageId: "ownLogin" }, { messageId: "ownLogin" }],
    },
    {
      filename: "/repo/tests/api/session-expiry.spec.ts",
      code: "// own-login:\nconst response = await userApi.login(credentials);",
      errors: [{ messageId: "ownLogin" }],
    },
  ],
});
