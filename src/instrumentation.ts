/**
 * Runs once per server process (dev and production). Brings up the embedded
 * PostgreSQL instance, provisions the schema and the HR workspace, so the
 * first request already finds a working database.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const { ensureDatabase } = await import("./lib/server/pg");
  await ensureDatabase();
}
