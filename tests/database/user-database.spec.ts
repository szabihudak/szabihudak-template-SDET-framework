import { test, expect } from "@app/fixtures/test-fixtures";

test.describe("User database validation", () => {
  test("registered user is persisted with the expected data", async ({
    registeredTestUser,
    userDatabase,
  }) => {
    const user = registeredTestUser;
    const userInDb = await userDatabase.findByEmail(user.email);

    expect(userInDb).not.toBeNull();
    expect(userInDb?.email).toBe(user.email);
    expect(userInDb?.name).toBe(user.name);
    expect(userInDb?.password_hash).toBeTruthy();
    expect(userInDb?.password_hash).not.toBe(user.password);
    expect(userInDb?.created_at).not.toBeNull();
    expect(userInDb?.updated_at).not.toBeNull();
  });
});
