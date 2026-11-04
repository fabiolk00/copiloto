import postgres from "postgres";
import { env } from "@/lib/env";

declare global {
  var __pgSql: ReturnType<typeof postgres> | undefined;
}

// `DATABASE_URL` runs through Supabase's pgbouncer in transaction-pooling mode,
// which does not support protocol-level prepared statements — `prepare: false`
// is required, not optional. Cached on `global` so Next.js dev hot-reloads
// reuse the same pool instead of leaking connections on every module reload.
export const sql =
  globalThis.__pgSql ?? postgres(env.DATABASE_URL, { prepare: false, max: Number(process.env.DB_POOL_MAX) || 5 });

if (process.env.NODE_ENV !== "production") {
  globalThis.__pgSql = sql;
}
