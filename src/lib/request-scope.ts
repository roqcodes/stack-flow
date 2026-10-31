import { connection } from "next/server";

/**
 * Marks the route as request-scoped (no static prerender).
 * Call before auth, `new Date()`, or other per-request data access.
 */
export async function ensureRequestScope(): Promise<void> {
  await connection();
}
