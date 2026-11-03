import { spawn } from "node:child_process";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startHarnessDb } from "./db.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const DB_PORT = Number(process.env.HARNESS_DB_PORT ?? 55700);
const FAKE_MP_PORT = Number(process.env.HARNESS_FAKE_MP_PORT ?? 55701);
const APP_PORT = Number(process.env.HARNESS_APP_PORT ?? 55702);

const MP_WEBHOOK_SECRET = "harness-test-webhook-secret";
const MP_ACCESS_TOKEN = "TEST-harness-access-token";

const REPORT_DIR = join(ROOT, "harness", "report");
mkdirSync(REPORT_DIR, { recursive: true });
const JSON_REPORT_PATH = join(REPORT_DIR, "playwright-report.json");

function log(msg) {
  console.log(`[harness] ${msg}`);
}

function run(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
      ...opts,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve(0);
      else reject(new Error(`${command} ${args.join(" ")} saiu com código ${code}`));
    });
    child.on("error", reject);
  });
}

async function waitForHttp(url, { timeoutMs = 60_000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return true;
    } catch {
      // ainda não está no ar — tenta de novo
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout esperando ${url} responder`);
}

function printReportTable() {
  if (!existsSync(JSON_REPORT_PATH)) {
    log("Nenhum relatório JSON do Playwright encontrado — a suíte deve ter falhado antes de rodar.");
    return;
  }
  const report = JSON.parse(readFileSync(JSON_REPORT_PATH, "utf8"));
  const rows = [];
  for (const suite of report.suites ?? []) {
    collectSpecs(suite, rows);
  }

  const nameWidth = Math.max(8, ...rows.map((r) => r.name.length));
  const header = `${"Cenário".padEnd(nameWidth)} | Resultado | Tempo (ms)`;
  console.log("\n" + header);
  console.log("-".repeat(header.length));
  for (const row of rows) {
    console.log(`${row.name.padEnd(nameWidth)} | ${row.status.padEnd(9)} | ${row.duration}`);
  }
  const totalMs = rows.reduce((sum, r) => sum + r.duration, 0);
  const passed = rows.filter((r) => r.status === "passed").length;
  console.log("-".repeat(header.length));
  console.log(`${passed}/${rows.length} passou — tempo total somado dos testes: ${totalMs}ms\n`);
}

function collectSpecs(suite, rows) {
  for (const spec of suite.specs ?? []) {
    const test = spec.tests?.[0];
    const result = test?.results?.[0];
    rows.push({
      name: spec.title,
      status: result?.status ?? "unknown",
      duration: result?.duration ?? 0,
    });
  }
  for (const child of suite.suites ?? []) {
    collectSpecs(child, rows);
  }
}

async function main() {
  log(`DB porta ${DB_PORT} | fake-mp porta ${FAKE_MP_PORT} | app porta ${APP_PORT}`);

  log("Subindo banco efêmero (PGlite) e aplicando migrations...");
  const db = await startHarnessDb({ port: DB_PORT });

  log("Subindo fake da Mercado Pago...");
  process.env.FAKE_MP_PORT = String(FAKE_MP_PORT);
  process.env.MP_WEBHOOK_SECRET = MP_WEBHOOK_SECRET;
  process.env.APP_WEBHOOK_URL = `http://127.0.0.1:${APP_PORT}/api/webhooks/mercadopago`;
  const { startFakeMp, stopFakeMp } = await import("./fake-mp/server.mjs");
  await startFakeMp();

  // Segurança: a precedência de env do Next.js é `process.env` primeiro,
  // parando na primeira ocorrência — `.env.local` (com as credenciais e o
  // DATABASE_URL REAIS do projeto) só é consultado para chaves que não
  // estejam em `process.env` (ver node_modules/next/dist/docs/01-app/
  // 02-guides/environment-variables.md#environment-variable-load-order).
  // Como todas as chaves sensíveis abaixo são passadas explicitamente, o
  // app sob o harness nunca toca o Supabase real nem credenciais reais da
  // Mercado Pago, mesmo rodando no mesmo diretório que tem um `.env.local`.
  const appEnv = {
    ...process.env,
    MP_ACCESS_TOKEN,
    MP_WEBHOOK_SECRET,
    // Curto de propósito (não os 30min default) para o teste de expiração
    // não depender de uma espera real longa — mas com folga suficiente
    // (~25s) para os outros cenários, que pagam o Pix e esperam a
    // confirmação por polling, terminarem bem antes de a janela expirar.
    // O teste de expiração espera por uma condição ("expirou" na tela),
    // nunca por um sleep arbitrário.
    MP_PIX_EXPIRATION: "PT25S",
    MP_API_BASE_URL: `http://127.0.0.1:${FAKE_MP_PORT}`,
    DATABASE_URL: db.url,
    // Valores falsos: o harness não baixa PDF; só satisfazem a validação de lib/env.ts.
    SUPABASE_URL: "https://harness.supabase.test",
    SUPABASE_SERVICE_ROLE_KEY: "harness-chave-nao-real",
    APP_URL: `http://127.0.0.1:${APP_PORT}`,
    PORT: String(APP_PORT),
    NODE_ENV: "production",
    // O rate limit por IP (lib/rate-limit.ts) já tem teste dedicado em
    // tests/security/anti-abuse.test.ts. O harness E2E roda várias jornadas
    // completas contra um único processo de app, todas vistas pelo mesmo IP
    // (localhost) — sem afrouxar aqui, a própria suíte E2E tropeçaria no
    // limite pensado para abuso real de um usuário.
    PIX_CREATE_RATE_LIMIT: "1000",
    MP_WEBHOOK_RATE_LIMIT: "1000",
  };

  let appProcess;
  let exitCode = 1;
  try {
    log("Buildando o app (next build) com as envs do harness...");
    await run("npx", ["next", "build"], { env: appEnv });

    log(`Iniciando o app (next start -p ${APP_PORT})...`);
    appProcess = spawn("npx", ["next", "start", "-p", String(APP_PORT)], {
      cwd: ROOT,
      env: appEnv,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    appProcess.on("exit", (code, signal) => {
      if (code !== null && code !== 0) {
        console.error(`[harness] processo do app encerrou inesperadamente (code=${code}, signal=${signal})`);
      }
    });

    await waitForHttp(`http://127.0.0.1:${APP_PORT}/`);
    log("App no ar. Rodando testes Playwright...");

    const e2eEnv = {
      ...process.env,
      APP_BASE_URL: `http://127.0.0.1:${APP_PORT}`,
      FAKE_MP_CONTROL_URL: `http://127.0.0.1:${FAKE_MP_PORT}`,
      HARNESS_DATABASE_URL: db.url,
      HARNESS_JSON_REPORT: JSON_REPORT_PATH,
    };

    try {
      await run("npx", ["playwright", "test", "-c", "e2e/playwright.config.ts"], { env: e2eEnv });
      exitCode = 0;
    } catch (err) {
      console.error(`[harness] Playwright falhou: ${err.message}`);
      exitCode = 1;
    }
  } finally {
    log("Encerrando app, fake-mp e banco...");
    if (appProcess) {
      appProcess.kill();
    }
    await stopFakeMp();
    await db.stop();
  }

  printReportTable();
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("[harness] erro fatal:", err);
  process.exit(1);
});
