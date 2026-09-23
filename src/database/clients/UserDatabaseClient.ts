import type { QueryResultRow } from "pg";
import { DatabaseClient } from "./DatabaseClient";

export interface UserDatabaseRecord extends QueryResultRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export class UserDatabaseClient {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async findById(userId: string): Promise<UserDatabaseRecord | null> {
    const rows = await this.databaseClient.query<UserDatabaseRecord>(
      `
SELECT
  id,
  email,
  password_hash,
  name,
  created_at,
  updated_at
FROM users
WHERE id = $1
LIMIT 1;
      `,
      [userId],
    );

    return rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<UserDatabaseRecord | null> {
    const rows = await this.databaseClient.query<UserDatabaseRecord>(
      `
SELECT
  id,
  email,
  password_hash,
  name,
  created_at,
  updated_at
FROM users
WHERE email = $1
LIMIT 1;
      `,
      [email],
    );

    return rows[0] ?? null;
  }

  async deleteById(userId: string): Promise<void> {
    await this.databaseClient.query(
      `
        DELETE FROM users
        WHERE id = $1
      `,
      [userId],
    );
  }
}
