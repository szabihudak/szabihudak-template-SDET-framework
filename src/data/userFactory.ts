import type { TestUser } from "../api/models/User";

type CreateTestUserOptions = {
  name?: string;
  email?: string;
  password?: string;
};

type CreateTestUserPayloadOptions = CreateTestUserOptions & {
  missingFields?: (keyof TestUser)[];
};

export function createTestUser(options: CreateTestUserOptions = {}): TestUser {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    name: options.name ?? `qa_${id}`,
    email: options.email ?? `qa_${id}@example.com`,
    password: options.password ?? "TestPassword123!",
  };
}

export function createTestUserPayload(
  options: CreateTestUserPayloadOptions = {},
): Partial<TestUser> {
  const user: Partial<TestUser> = createTestUser(options);

  for (const field of options.missingFields ?? []) {
    delete user[field];
  }

  return user;
}
