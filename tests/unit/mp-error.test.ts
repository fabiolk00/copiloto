import { describe, expect, it } from "vitest";
import { MPAuthenticationError, MPConnectionError, MPNotFoundError, MPServerError } from "mercadopago";
import { describeMpError } from "@/lib/mp-error";

describe("describeMpError", () => {
  it("extrai o código HTTP e o motivo dos erros reais do SDK", () => {
    const err = new MPNotFoundError({ message: "order not found", error: "not_found", status: 404 });
    expect(describeMpError(err)).toEqual({ status: 404, error: "not_found", message: "order not found" });
  });

  it("erro de autenticação (token errado ou de outro ambiente) aparece com status 401", () => {
    const err = new MPAuthenticationError({ message: "invalid access token", status: 401 });
    expect(describeMpError(err).status).toBe(401);
  });

  it("sem message nem error no corpo mantém o status, que é o que o String(err) escondia", () => {
    const err = new MPServerError({ status: 503 });
    const resumo = describeMpError(err);
    expect(resumo.status).toBe(503);
    expect(resumo.message).toBe("MercadoPago API error");
  });

  it("inclui no máximo 3 causes, só com code e description", () => {
    const err = new MPNotFoundError({
      status: 404,
      cause: [1, 2, 3, 4, 5].map((n) => ({ code: n, description: `d${n}`, extra: "ignorado" })),
    });
    const causes = describeMpError(err).causes ?? [];
    expect(causes).toHaveLength(3);
    expect(Object.keys(causes[0]).sort()).toEqual(["code", "description"]);
  });

  it("falha de rede não tem status HTTP: o campo fica ausente", () => {
    const resumo = describeMpError(new MPConnectionError(new Error("fetch failed")));
    expect(resumo.status).toBeUndefined();
  });

  it("valores que não são erro viram só uma mensagem, sem lançar", () => {
    expect(describeMpError("texto")).toEqual({ message: "texto" });
    expect(describeMpError(null)).toEqual({ message: "null" });
    expect(describeMpError(undefined)).toEqual({ message: "undefined" });
  });

  it("nunca devolve header de autorização nem o objeto original", () => {
    const err = Object.assign(new Error("falha"), { status: 401, headers: { authorization: "Bearer SEGREDO" }, config: { token: "SEGREDO" } });
    expect(JSON.stringify(describeMpError(err))).not.toContain("SEGREDO");
  });
});
