import rule from "../rules/similar-tests-as-scenarios.ts";
import { run, spec } from "./tester.ts";

const tokenTest = (
  name: string,
  token: string,
) => `  test("${name}", async ({ taskApi }) => {
    const response = await taskApi.createTask(createTask(), "${token}");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });`;

run("similar-tests-as-scenarios", rule, {
  valid: [
    spec(`  for (const scenario of scenarios) {
    test(scenario.name, async ({ taskApi }) => {
      const response = await taskApi.createTask(createTask(), scenario.token);
      expect(response.status()).toBe(401);
    });
  }`),
    spec(`${tokenTest("rejects a missing token", "")}
  // separate-test: needs its own fixture later
${tokenTest("rejects an invalid token", "x")}`),
    spec(`${tokenTest("rejects a missing token", "")}
  test("creates a task", async ({ taskApi }) => {
    const response = await taskApi.createTask(createTask());
    expect(response.status()).toBe(201);
  });`),
  ],
  invalid: [
    {
      code: spec(`${tokenTest("rejects a missing token", "")}
${tokenTest("rejects an invalid token", "invalid")}`),
      errors: [{ messageId: "similar", data: { lines: "4, 10" } }],
    },
  ],
});
