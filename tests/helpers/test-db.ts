import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";

/**
 * Chave em `globalThis` usada pelo mock de `@/lib/db` em cada arquivo de
 * teste de integração (`vi.mock("@/lib/db", () => ({ get sql() { ... } }))`).
 * Um getter é necessário porque `startTestDb` só cria o client depois que o
 * módulo mockado já foi resolvido.
 */
export const TEST_SQL_GLOBAL_KEY = "__PIX_TEST_SQL__";

const MIGRATIONS_DIR = join(__dirname, "..", "..", "supabase", "migrations");

type TestDbHandle = {
  sql: postgres.Sql;
  db: PGlite;
  server: PGLiteSocketServer;
};

/**
 * Sobe um Postgres real embutido (PGlite, via WASM) exposto por um servidor
 * TCP que fala o protocolo de fiação do Postgres, e aplica as migrations
 * reais do projeto. O driver `postgres.js` usado em produção conecta nele
 * sem nenhuma adaptação — os testes de integração exercitam exatamente as
 * mesmas queries que correm contra o Supabase real.
 */
export async function startTestDb(port: number): Promise<TestDbHandle> {
  const db = new PGlite();
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });
  await server.start();

  const sql = postgres({
    host: "127.0.0.1",
    port,
    database: "postgres",
    user: "postgres",
    prepare: false,
    max: 1,
  });

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const ddl = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    // Migrations que dependem de extensões do Supabase (pg_cron, pg_net, Vault)
    // não rodam no PGlite; ficam marcadas com este comentário e são ignoradas aqui.
    if (ddl.includes("-- @supabase-only")) continue;
    await sql.unsafe(ddl);
  }

  (globalThis as Record<string, unknown>)[TEST_SQL_GLOBAL_KEY] = sql;
  return { sql, db, server };
}

export async function stopTestDb(handle: TestDbHandle): Promise<void> {
  await handle.sql.end({ timeout: 1 });
  await handle.server.stop();
  await handle.db.close();
  delete (globalThis as Record<string, unknown>)[TEST_SQL_GLOBAL_KEY];
}

/** Isola cada teste: zera todas as tabelas de domínio entre um teste e o próximo. */
export async function resetTestDb(sql: postgres.Sql): Promise<void> {
  await sql`truncate table pedido_webhook_eventos, pedidos restart identity cascade`;
}
