import rule from "../rules/parameterized-sql.ts";
import { run } from "./tester.ts";

run("parameterized-sql", rule, {
  valid: [
    'db.query("SELECT id FROM tasks WHERE id = $1", [id]);',
    "db.query(`SELECT id FROM tasks`);",
    'const label = "Task " + title;',
  ],
  invalid: [
    {
      code: "db.query(`SELECT id FROM tasks WHERE id = '${id}'`);",
      errors: [{ messageId: "interpolated" }],
    },
    {
      code: `db.query("DELETE FROM tasks WHERE id = " + id);`,
      errors: [{ messageId: "interpolated" }],
    },
  ],
});
