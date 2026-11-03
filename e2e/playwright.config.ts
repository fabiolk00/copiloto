import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Caminhos absolutos de propósito: outputFile/outputFolder dos reporters
// são resolvidos relativos ao diretório do config (e2e/), não à raiz do
// projeto — sem isso, o relatório HTML do Playwright (que embute um bundle
// React minificado) acaba em e2e/harness/report/html e o ESLint do projeto
// tenta lintar esse bundle de terceiros junto com o código real.
const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://127.0.0.1:55702";
const JSON_REPORT = process.env.HARNESS_JSON_REPORT ?? join(PROJECT_ROOT, "harness", "report", "playwright-report.json");

export default defineConfig({
  testDir: ".",
  outputDir: join(PROJECT_ROOT, "harness", "report", "test-results"),
  // O fake-mp e o banco são singletons compartilhados por toda a suíte (ver
  // harness/run.mjs) — rodar specs em paralelo faria um teste pisar no
  // estado global de outro (ex.: modo caos). Determinismo > velocidade aqui.
  workers: 1,
  retries: 0,
  // O cenário de expiração espera de verdade uma janela real e curta
  // (MP_PIX_EXPIRATION=PT25S, ver harness/run.mjs) acabar — folga para isso
  // e para a reação em cadeia que vem depois (novo Pix).
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: JSON_REPORT }],
    ["html", { open: "never", outputFolder: join(PROJECT_ROOT, "harness", "report", "html") }],
  ],
  use: {
    baseURL: APP_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
