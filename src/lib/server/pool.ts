/** Thin wrapper around a pg connection pool. */
import { Pool } from "pg";

export interface DbClient {
  query(sql: string, params?: unknown[]): Promise<{ rowCount: number | null }>;
  release(): void;
}

export interface QueryResult {
  rowCount: number;
  rows: unknown[];
}

export interface DbPool {
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  connect(): Promise<DbClient>;
  end(): Promise<void>;
}

export function createPool(config: {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionString?: string;
  ssl?: boolean;
}): DbPool {
  const pool = new Pool({
    ...(config.connectionString ? { connectionString: config.connectionString } : {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
    }),
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });
  return {
    async query(sql, params = []) {
      const result = await pool.query(sql, params as never[]);
      return {
        rowCount: result.rowCount ?? 0,
        rows: result.rows as unknown[],
      };
    },
    async connect() {
      const client = await pool.connect();
      return {
        async query(sql, params = []) {
          const result = await client.query(sql, params as never[]);
          return { rowCount: result.rowCount ?? 0 };
        },
        release() {
          client.release();
        },
      };
    },
    end() {
      return pool.end();
    },
  };
}
