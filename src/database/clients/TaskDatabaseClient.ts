import type { QueryResultRow } from "pg";

import type { TaskPriority, TaskStatus } from "../../api/constants/task";
import { DatabaseClient } from "./DatabaseClient";

export interface TaskDatabaseRecord extends QueryResultRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus | null;
  priority: TaskPriority | null;
  position: number | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export class TaskDatabaseClient {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async findById(taskId: string): Promise<TaskDatabaseRecord | null> {
    const rows = await this.databaseClient.query<TaskDatabaseRecord>(
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
        FROM tasks
        WHERE id = $1
        LIMIT 1
      `,
      [taskId],
    );

    return rows[0] ?? null;
  }

  async findByTitleForUser(
    title: string,
    userId: string,
  ): Promise<TaskDatabaseRecord | null> {
    const rows = await this.databaseClient.query<TaskDatabaseRecord>(
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
        FROM tasks
        WHERE title = $1
          AND user_id = $2
        LIMIT 1
      `,
      [title, userId],
    );

    return rows[0] ?? null;
  }
}
