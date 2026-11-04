import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");

/**
 * Banco efêmero do harness: Postgres real (PGlite, compilado para WASM, sem
 * Docker) exposto por um servidor TCP que fala o protocolo de fiação do
 * Postgres — o app sob teste conecta nele com a mesma `DATABASE_URL`/driver
 * `postgres.js` de produção, sem adaptação nenhuma. Aplica as migrations reais.
 *
 * Não há seed de "produtos" ou "usuários": este app não tem tabela de
 * produtos (o catálogo de áreas/guias é um array estático em lib/guias.ts)
 * nem contas de usuário (ver o comentário em app/api/orders/[id]/status/route.ts —
 * o design é deliberadamente sem login). O equivalente a "usuário A" e
 * "usuário B" pedido no harness são dois e-mails de pagador fixos,
 * definidos em e2e/fixtures.ts, usados pelos cenários que precisam de duas
 * identidades distintas.
 */
export async function startHarnessDb({ port }) {
  const db = new PGlite();
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 20 });
  await server.start();

  const sql = postgres({
    host: "127.0.0.1",
    port,
    database: "postgres",
    user: "postgres",
    prepare: false,
    max: 5,
  });

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const ddl = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    // Migrations de extensões do Supabase (pg_cron, pg_net) não rodam no PGlite.
    if (ddl.includes("-- @supabase-only")) continue;
    await sql.unsafe(ddl);
  }

  return {
    sql,
    url: `postgresql://postgres@127.0.0.1:${port}/postgres`,
    async stop() {
      await sql.end({ timeout: 1 });
      await server.stop();
      await db.close();
    },
  };
}
