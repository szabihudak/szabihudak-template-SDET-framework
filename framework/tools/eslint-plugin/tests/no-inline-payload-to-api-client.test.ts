import rule from "../rules/no-inline-payload-to-api-client.ts";
import { run } from "./tester.ts";

run("no-inline-payload-to-api-client", rule, {
  valid: [
    "await taskApi.createTask(createTask({ title: 'Plan' }));",
    'await taskApi.updateTask(task.id, { priority: "high" });',
    "await taskApi.createTask({ ...taskData, title: 'x' });",
    "await page.fill({ a: 1, b: 2 });",
  ],
  invalid: [
    {
      code: 'await userApi.register({ name: "Ana", email: "a@b.c", password: "123456" });',
      errors: [{ messageId: "inline" }],
    },
    {
      code: 'await fixtures.taskApi.createTask({ title: "x", priority: "low" });',
      errors: [{ messageId: "inline" }],
    },
  ],
});
