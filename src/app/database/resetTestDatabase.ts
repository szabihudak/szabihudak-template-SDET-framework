import { spawnSync } from "node:child_process";

import {
  resetTestDatabase,
  runCommand,
} from "../../framework/database/resetTestDatabase";

const BASELINE_USERS = ["testuser@upex.dev", "admin@upex.dev"];

const COMPOSE_FILES = [
  "-f",
  "docker-compose.yml",
  "-f",
  "docker-compose.local.yml",
];

void resetTestDatabase({
  preflight: () => {
    console.log("Checking Docker availability...");

    const result = spawnSync("docker", ["info"], {
      stdio: "ignore",
      env: process.env,
    });

    if (result.error || result.status !== 0) {
      throw new Error(
        "Database reset aborted: Docker is not available. Start Docker before resetting the database.",
      );
    }

    console.log("Docker is available.");
  },

  // UPEX owns its schema and seed data; the reset only orchestrates them.
  restoreBaseline: () => {
    console.log("Applying UPEX database schema...");

    runCommand("docker", [
      "compose",
      ...COMPOSE_FILES,
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
      ...COMPOSE_FILES,
      "run",
      "--rm",
      "--no-deps",
      "app",
      "bun",
      "run",
      "db:seed",
    ]);
  },

  verifyBaseline: async (client) => {
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
  },
});
