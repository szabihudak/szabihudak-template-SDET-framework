import rule from "../rules/no-partial-success-comparison.ts";
import { run, spec } from "./tester.ts";

const read = (assertion: string) =>
  spec(`  test("reads the current user", async ({ userApi }) => {
    const response = await userApi.getCurrentUser();
    expect(response.status()).toBe(200);
    const body = await response.json();
    validateSchema(currentUserSchema, body);
${assertion}
  });`);

run("no-partial-success-comparison", rule, {
  valid: [
    { code: read("    expect(body.user).toStrictEqual(expectedUser);") },
    { code: read("    expect(body.user.email).toBe(email);") },
    {
      code: read(
        "    // partial: the contract adds fields per tenant\n    expect(body.user).toMatchObject({ email });",
      ),
    },
    {
      code: spec(`  test("rejects a missing token", async ({ userApi }) => {
    const response = await userApi.getCurrentUser("");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toEqual(expect.objectContaining({ error: "Unauthorized" }));
  });`),
    },
  ],
  invalid: [
    {
      code: read("    expect(body.user).toMatchObject({ email });"),
      errors: [{ messageId: "partial", data: { subject: "body.user" } }],
    },
    {
      code: read(
        "    expect(body).toEqual(expect.objectContaining({ user: expectedUser }));",
      ),
      errors: [{ messageId: "partial", data: { subject: "body" } }],
    },
    {
      code: read(
        "    expect(body).toStrictEqual({\n      user: expect.objectContaining({ email }),\n    });",
      ),
      errors: [{ messageId: "partial" }],
    },
    {
      code: read(
        "    // partial:\n    expect(body.user).toMatchObject({ email });",
      ),
      errors: [{ messageId: "partial" }],
    },
  ],
});
