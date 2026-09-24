import { spawnSync } from "node:child_process";

import { Client } from "pg";

const EXPECTED_TEST_ENV = "localDocker";
const REQUIRED_CONFIRMATION = "true";

const BASELINE_USERS = ["testuser@upex.dev", "admin@upex.dev"];

function abort(message: string): never {
  throw new Error(`Database reset aborted: ${message}`);
}

function validateEnvironment(): URL {
  if (process.env.TEST_ENV !== EXPECTED_TEST_ENV) {
    abort(
      `TEST_ENV must be "${EXPECTED_TEST_ENV}". Received "${process.env.TEST_ENV ?? "undefined"}".`,
    );
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    abort("DATABASE_URL is not defined.");
  }

  if (process.env.CONFIRM_DB_RESET !== REQUIRED_CONFIRMATION) {
    abort(
      `CONFIRM_DB_RESET must be explicitly set to "${REQUIRED_CONFIRMATION}".`,
    );
  }

  let databaseUrl: URL;

  try {
    databaseUrl = new URL(connectionString);
  } catch {
    abort("DATABASE_URL is not a valid connection string.");
  }

  if (
    databaseUrl.protocol !== "postgres:" &&
    databaseUrl.protocol !== "postgresql:"
  ) {
    abort(
      `DATABASE_URL must use postgres or postgresql protocol. Received "${databaseUrl.protocol}".`,
    );
  }

  return databaseUrl;
}

function runCommand(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Command failed with exit code ${result.status}: ${command} ${args.join(" ")}`,
    );
  }
}

function validateDockerAvailability(): void {
  console.log("Checking Docker availability...");

  const result = spawnSync("docker", ["info"], {
    stdio: "ignore",
    env: process.env,
  });

  if (result.error || result.status !== 0) {
    abort(
      "Docker is not available. Start Docker before resetting the database.",
    );
  }

  console.log("Docker is available.");
}

async function resetPublicSchema(connectionString: string): Promise<void> {
  const client = new Client({
    connectionString,
  });

  await client.connect();

  try {
    console.log("Resetting public schema...");

    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");

    console.log("Public schema reset successfully.");
  } finally {
    await client.end();
  }
}

function restoreApplicationBaseline(): void {
  const composeFiles = [
    "-f",
    "docker-compose.yml",
    "-f",
    "docker-compose.local.yml",
  ];

  console.log("Applying UPEX database schema...");

  runCommand("docker", [
    "compose",
    ...composeFiles,
    "run",
    "--rm",
    "--no-deps",
    "app",
    "bun",
    "run",
    "db:push",
  ]);

  console.log("Seeding UPEX baseline data...");

  runCommand("docker", [
    "compose",
    ...composeFiles,
    "run",
    "--rm",
    "--no-deps",
    "app",
    "bun",
    "run",
    "db:seed",
  ]);
}

async function verifyBaseline(connectionString: string): Promise<void> {
  const client = new Client({
    connectionString,
  });

  await client.connect();

  try {
    console.log("Verifying database baseline...");

    const result = await client.query<{ email: string }>(
      `
        SELECT email
        FROM users
        WHERE email = ANY($1::text[])
      `,
      [BASELINE_USERS],
    );

    const foundUsers = new Set(result.rows.map((row) => row.email));

    const missingUsers = BASELINE_USERS.filter(
      (email) => !foundUsers.has(email),
    );

    if (missingUsers.length > 0) {
      throw new Error(
        `Baseline verification failed. Missing seeded users: ${missingUsers.join(", ")}`,
      );
    }

    const taskResult = await client.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM tasks
        WHERE user_id IN (
          SELECT id
          FROM users
          WHERE email = ANY($1::text[])
        )
      `,
      [BASELINE_USERS],
    );

    const taskCount = Number(taskResult.rows[0]?.count ?? 0);

    if (taskCount === 0) {
      throw new Error(
        "Baseline verification failed. Seeded users have no baseline tasks.",
      );
    }

    console.log(
      `Database baseline verified successfully: ${BASELINE_USERS.length} users, ${taskCount} tasks.`,
    );
  } finally {
    await client.end();
  }
}

async function resetTestDatabase(): Promise<void> {
  const databaseUrl = validateEnvironment();
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    abort("DATABASE_URL is not defined.");
  }

  console.log("Test database reset requested.");
  console.log(`Environment: ${process.env.TEST_ENV}`);
  console.log(`Database host: ${databaseUrl.host}`);
  console.log(
    `Database name: ${databaseUrl.pathname.replace(/^\//, "") || "<unknown>"}`,
  );

  validateDockerAvailability();

  await resetPublicSchema(connectionString);

  restoreApplicationBaseline();

  await verifyBaseline(connectionString);

  console.log("Test database reset completed successfully.");
}

resetTestDatabase().catch((error: unknown) => {
  console.error("Test database reset failed.");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exit(1);
});
