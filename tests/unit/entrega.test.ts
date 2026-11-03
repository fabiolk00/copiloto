import { describe, expect, it } from "vitest";
import { resolveGuiaPdf } from "@/lib/entrega";
import { PDF_OBJECT_PATHS } from "@/lib/storage";

describe("resolveGuiaPdf (allowlist área x trilha)", () => {
  it.each([
    ["financeiro", "crescer", "Guia-Carreira-Financeiro-Crescer-na-Empresa.pdf"],
    ["financeiro", "mudar", "Guia-Carreira-Financeiro-Mudar-de-Empresa.pdf"],
    ["analise-de-dados", "crescer", "Guia-Carreira-Analise-de-Dados-Crescer-na-Empresa.pdf"],
    ["analise-de-dados", "mudar", "Guia-Carreira-Analise-de-Dados-Mudar-de-Empresa.pdf"],
    ["comercial", "crescer", "Guia-Carreira-Comercial-Crescer-na-Empresa.pdf"],
    ["comercial", "mudar", "Guia-Carreira-Comercial-Mudar-de-Empresa.pdf"],
  ])("%s / %s -> %s", (area, trilha, arquivo) => {
    expect(resolveGuiaPdf(area, trilha)).toBe(arquivo);
  });

  it("trilha null é recusada (nunca assume um arquivo padrão)", () => {
    expect(resolveGuiaPdf("financeiro", null)).toBeNull();
  });

  it("entradas fora do mapa são recusadas, incluindo traversal e chaves herdadas do Object", () => {
    expect(resolveGuiaPdf("../../etc", "crescer")).toBeNull();
    expect(resolveGuiaPdf("financeiro", "../crescer")).toBeNull();
    expect(resolveGuiaPdf("constructor", "crescer")).toBeNull();
    expect(resolveGuiaPdf("__proto__", "toString")).toBeNull();
    expect(resolveGuiaPdf("financeiro", "outra")).toBeNull();
  });

  it("todo caminho da allowlist de storage é alcançável por algum par área/trilha", () => {
    const alcancaveis = new Set<string>();
    for (const area of ["financeiro", "analise-de-dados", "comercial"]) {
      for (const trilha of ["crescer", "mudar"]) {
        const p = resolveGuiaPdf(area, trilha);
        if (p) alcancaveis.add(p);
      }
    }
    expect([...alcancaveis].sort()).toEqual([...PDF_OBJECT_PATHS].sort());
  });
});
