import { spawnSync } from "node:child_process";

import { Client } from "pg";

import { assertEnvironmentAllows, getCurrentEnvironment } from "../utils/env";

const REQUIRED_CONFIRMATION = "true";

export type DatabaseResetHooks = {
  preflight?: () => void;
  restoreBaseline: () => void;
  verifyBaseline: (client: Client) => Promise<void>;
};

function abort(message: string): never {
  throw new Error(`Database reset aborted: ${message}`);
}

function validateEnvironment(): string {
  try {
    assertEnvironmentAllows("destructive", "Database reset");
  } catch (error) {
    abort(error instanceof Error ? error.message : String(error));
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

  console.log("Test database reset requested.");
  console.log(`Environment: ${getCurrentEnvironment().name}`);
  console.log(`Database host: ${databaseUrl.host}`);
  console.log(
    `Database name: ${databaseUrl.pathname.replace(/^\//, "") || "<unknown>"}`,
  );

  return connectionString;
}

export function runCommand(command: string, args: string[]): void {
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

async function withClient(
  connectionString: string,
  action: (client: Client) => Promise<void>,
): Promise<void> {
  const client = new Client({
    connectionString,
  });

  await client.connect();

  try {
    await action(client);
  } finally {
    await client.end();
  }
}

export async function resetTestDatabase(
  hooks: DatabaseResetHooks,
): Promise<void> {
  try {
    const connectionString = validateEnvironment();

    hooks.preflight?.();

    await withClient(connectionString, async (client) => {
      console.log("Resetting public schema...");

      await client.query("DROP SCHEMA IF EXISTS public CASCADE");
      await client.query("CREATE SCHEMA public");

      console.log("Public schema reset successfully.");
    });

    hooks.restoreBaseline();

    await withClient(connectionString, async (client) => {
      console.log("Verifying database baseline...");

      await hooks.verifyBaseline(client);
    });

    console.log("Test database reset completed successfully.");
  } catch (error: unknown) {
    console.error("Test database reset failed.");
    console.error(error instanceof Error ? error.message : error);

    process.exit(1);
  }
}
