import { describe, expect, it } from "vitest";
import { resolveCurriculoDocx, resolveGuiaPdf } from "@/lib/entrega";
import { CURRICULO_OBJECT_PATHS, PDF_OBJECT_PATHS } from "@/lib/storage";

describe("resolveGuiaPdf (allowlist área x trilha)", () => {
  it.each([
    ["financeiro", "crescer", "Guia-Carreira-Financeiro-Crescer-na-Empresa.pdf"],
    ["financeiro", "mudar", "Guia-Carreira-Financeiro-Mudar-de-Empresa.pdf"],
    ["analise-de-dados", "crescer", "Guia-Carreira-Analise-de-Dados-Crescer-na-Empresa.pdf"],
    ["analise-de-dados", "mudar", "Guia-Carreira-Analise-de-Dados-Mudar-de-Empresa.pdf"],
    ["comercial", "crescer", "Guia-Carreira-Comercial-Crescer-na-Empresa.pdf"],
    ["comercial", "mudar", "Guia-Carreira-Comercial-Mudar-de-Empresa.pdf"],
    ["administrativo", "crescer", "Guia-Carreira-Administrativo-Crescer-na-Empresa.pdf"],
    ["administrativo", "mudar", "Guia-Carreira-Administrativo-Mudar-de-Empresa.pdf"],
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
    for (const area of ["financeiro", "analise-de-dados", "comercial", "administrativo"]) {
      for (const trilha of ["crescer", "mudar"]) {
        const p = resolveGuiaPdf(area, trilha);
        if (p) alcancaveis.add(p);
      }
    }
    expect([...alcancaveis].sort()).toEqual([...PDF_OBJECT_PATHS].sort());
  });
});

describe("resolveCurriculoDocx (um modelo por área, independente da trilha)", () => {
  it.each([
    ["financeiro", "Curriculo-ATS-Financeiro-Mudar-de-Empresa.docx"],
    ["analise-de-dados", "Curriculo-ATS-Analise-de-Dados-Mudar-de-Empresa.docx"],
    ["comercial", "Curriculo-ATS-Comercial-Mudar-de-Empresa.docx"],
    ["administrativo", "Curriculo-ATS-Administrativo-Mudar-de-Empresa.docx"],
  ])("%s -> %s", (area, arquivo) => {
    expect(resolveCurriculoDocx(area)).toBe(arquivo);
  });

  it("toda área que tem guia (em qualquer trilha) tem currículo", () => {
    for (const area of ["financeiro", "analise-de-dados", "comercial", "administrativo"]) {
      for (const trilha of ["crescer", "mudar"]) {
        expect(resolveGuiaPdf(area, trilha)).not.toBeNull();
        expect(resolveCurriculoDocx(area)).not.toBeNull();
      }
    }
  });

  it("entradas fora do mapa são recusadas, incluindo traversal e chaves herdadas do Object", () => {
    expect(resolveCurriculoDocx("../../etc")).toBeNull();
    expect(resolveCurriculoDocx("constructor")).toBeNull();
    expect(resolveCurriculoDocx("__proto__")).toBeNull();
    expect(resolveCurriculoDocx("")).toBeNull();
  });

  it("todo caminho de currículo da allowlist de storage é alcançável por alguma área", () => {
    const alcancaveis = ["financeiro", "analise-de-dados", "comercial", "administrativo"].map((a) => resolveCurriculoDocx(a));
    expect([...alcancaveis].sort()).toEqual([...CURRICULO_OBJECT_PATHS].sort());
  });
});
