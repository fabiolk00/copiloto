import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEYS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  vi.resetModules();
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.resetModules();
});

describe("lib/env — variáveis do Storage", () => {
  it("falha no carregamento sem SUPABASE_URL", async () => {
    delete process.env.SUPABASE_URL;
    await expect(import("@/lib/env")).rejects.toThrow(/SUPABASE_URL/);
  });

  it("falha no carregamento com SUPABASE_URL que não é URL", async () => {
    process.env.SUPABASE_URL = "projeto.supabase.co";
    await expect(import("@/lib/env")).rejects.toThrow(/SUPABASE_URL/);
  });

  it("falha no carregamento sem SUPABASE_SERVICE_ROLE_KEY", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect(import("@/lib/env")).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("carrega com as duas definidas", async () => {
    const { env } = await import("@/lib/env");
    expect(env.SUPABASE_URL).toMatch(/^https:\/\//);
  });
});
