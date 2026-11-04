// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PixCheckout from "@/components/venda/PixCheckout";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("@/components/venda/TrilhaProvider", () => ({
  useTrilha: () => ({ trilha: null, setTrilha: vi.fn() }),
}));

vi.mock("@/lib/track", () => ({ track: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("<PixCheckout /> sem trilha escolhida", () => {
  it("o botão fica desabilitado e orienta a escolha, sem chamar a API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(
      <PixCheckout area="financeiro" areaName="Financeiro">
        Quero o guia de Financeiro
      </PixCheckout>
    );

    const botao = screen.getByRole("button", { name: /quero o guia de financeiro/i });
    expect(botao).toBeDisabled();
    expect(screen.getByText(/escolha uma trilha/i)).toBeInTheDocument();

    await userEvent.setup().click(botao);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
