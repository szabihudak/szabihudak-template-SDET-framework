import rule from "../rules/schemas-reject-unknown-fields.ts";
import { run } from "./tester.ts";

run("schemas-reject-unknown-fields", rule, {
  valid: [
    "Type.Object({ id: Type.String() }, { additionalProperties: false });",
    "Type.Object({ user: Type.Object({ id: Type.String() }, { additionalProperties: false }) }, { additionalProperties: false });",
  ],
  invalid: [
    {
      code: "Type.Object({ id: Type.String() });",
      errors: [{ messageId: "loose" }],
    },
    {
      code: "Type.Object({ id: Type.String() }, { additionalProperties: true });",
      errors: [{ messageId: "loose" }],
    },
    {
      code: "Type.Object({ user: Type.Object({ id: Type.String() }) }, { additionalProperties: false });",
      errors: [{ messageId: "loose" }],
    },
  ],
});
