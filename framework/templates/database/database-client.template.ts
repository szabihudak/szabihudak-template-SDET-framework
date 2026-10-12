// @template database-client: Domain-specific parameterized SQL and persisted record mapping.
// @template Canonical source: src/database/clients/TaskDatabaseClient.ts. Rules: framework/docs/TESTING_STANDARDS.md#database-test-standard
// @template Replace the tokens described in framework/templates/index.json. Fields, locators and test data are illustrative.
import type { QueryResultRow } from "pg";

import type { __Domain__Priority, __Domain__Status } from "@app/api/constants/__domain__";
import { DatabaseClient } from "@framework/database/DatabaseClient";

export interface __Domain__DatabaseRecord extends QueryResultRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: __Domain__Status | null;
  priority: __Domain__Priority | null;
  position: number | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export class __Domain__DatabaseClient {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async findById(__domain__Id: string): Promise<__Domain__DatabaseRecord | null> {
    const rows = await this.databaseClient.query<__Domain__DatabaseRecord>(
      `
        SELECT
          id,
          user_id,
          title,
          description,
          status,
          priority,
          position,
          created_at,
          updated_at
        FROM __domains__
        WHERE id = $1
        LIMIT 1
      `,
      [__domain__Id],
    );

    return rows[0] ?? null;
  }

  async findByTitleForUser(
    title: string,
    userId: string,
  ): Promise<__Domain__DatabaseRecord | null> {
    const rows = await this.databaseClient.query<__Domain__DatabaseRecord>(
      `
        SELECT
          id,
          user_id,
          title,
          description,
          status,
          priority,
          position,
          created_at,
          updated_at
        FROM __domains__
        WHERE title = $1
          AND user_id = $2
        LIMIT 1
      `,
      [title, userId],
    );

    return rows[0] ?? null;
  }
}
