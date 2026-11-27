/**
 * PostgreSQL access. The database runs in-process (embedded-postgres, no
 * root required) and is created automatically on first boot; the schema and
 * the single HR workspace are provisioned idempotently at startup.
 */
import { Socket } from "node:net";
import { createPool, type DbPool } from "./pool";
import { ensureSchema } from "./schema";
import { ensureHrWorkspace } from "./seed";

const PG_PORT = 5432;
const PG_USER = "postgres";
const PG_PASSWORD = process.env.PG_PASSWORD ?? "NYae001@";
const PG_DATABASE = process.env.PG_DATABASE ?? "wellbeing";

interface EmbeddedPostgresLike {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  createDatabase(name: string): Promise<void>;
}

interface EmbeddedPostgresConstructor {
  new (options: {
    databaseDir: string;
    user: string;
    password: string;
    port: number;
    persistent: boolean;
    onError?: (error: Error | string) => void;
  }): EmbeddedPostgresLike;
}

const globalState = globalThis as unknown as {
  __wellbeingPg?: EmbeddedPostgresLike | undefined;
  __wellbeingReady?: Promise<DbPool> | undefined;
};

async function startEmbeddedPostgres(): Promise<EmbeddedPostgresLike> {
  const { default: EmbeddedPostgres } = (await import("embedded-postgres")) as unknown as {
    default: EmbeddedPostgresConstructor;
  };
  const databaseDir = `${process.cwd()}/db/pgdata`;
  const instance = new EmbeddedPostgres({
    databaseDir,
    user: PG_USER,
    password: PG_PASSWORD,
    port: PG_PORT,
    persistent: true,
    onError: (error) => console.error("embedded postgres:", error),
  });

  // initialise() (initdb) must run exactly once: it fails if the data
  // directory already contains a cluster.
  try {
    await instance.initialise();
    console.log("embedded postgres: cluster initialised");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("exists")) {
      throw error;
    }
  }
  try {
    await instance.start();
    console.log("embedded postgres: server started");
  } catch (error) {
    // A server from a previous process (dev restart, orphaned child) may
    // already be running against this data directory. If the port answers,
    // attach to it instead of failing.
    if (await isPortAccepting(PG_PORT)) {
      console.log("embedded postgres: reusing already-running server");
    } else {
      throw error;
    }
  }
  return instance;
}

function isPortAccepting(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket();
    const done = (open: boolean): void => {
      socket.destroy();
      resolve(open);
    };
    socket.once("error", () => done(false));
    socket.connect(port, "127.0.0.1", () => done(true));
  });
}

/**
 * Bring up PostgreSQL, create the application database, schema and HR
 * workspace, and hand back a connection pool. Safe to call repeatedly: the
 * work runs once per process and every caller awaits the same promise.
 */
export function ensureDatabase(): Promise<DbPool> {
  globalState.__wellbeingReady ??= (async () => {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (connectionString && (process.env.VERCEL === "1" || !connectionString.includes("127.0.0.1"))) {
      const appPool = createPool({
        host: "",
        port: 5432,
        user: "",
        password: "",
        database: "",
        connectionString,
        ssl: true,
      });
      await ensureSchema(appPool);
      await ensureHrWorkspace(appPool);
      return appPool;
    }

    const embedded = await startEmbeddedPostgres();
    globalState.__wellbeingPg = embedded;

    const pool = createPool({
      host: "127.0.0.1",
      port: PG_PORT,
      user: PG_USER,
      password: PG_PASSWORD,
      database: "postgres",
    });

    // Create the application database when it does not exist yet.
    const exists = await pool.query(
      "select 1 as ok from pg_database where datname = $1",
      [PG_DATABASE],
    );
    if (exists.rowCount === 0) {
      await pool.query(`create database "${PG_DATABASE}"`);
      console.log(`embedded postgres: database "${PG_DATABASE}" created`);
    }
    await pool.end();

    const appPool = createPool({
      host: "127.0.0.1",
      port: PG_PORT,
      user: PG_USER,
      password: PG_PASSWORD,
      database: PG_DATABASE,
    });
    await ensureSchema(appPool);
    await ensureHrWorkspace(appPool);

    const shutdown = () => {
      void embedded.stop();
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);

    return appPool;
  })();
  return globalState.__wellbeingReady;
}
