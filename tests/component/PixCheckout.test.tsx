// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PixCheckout from "@/components/venda/PixCheckout";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("@/components/venda/TrilhaProvider", () => ({
  useTrilha: () => ({ trilha: "crescer", setTrilha: vi.fn() }),
}));

vi.mock("@/lib/track", () => ({ track: vi.fn() }));

const PIX_RESPONSE = {
  pedidoId: "client-token-1",
  qrCode: "00020126580014br.gov.bcb.pix-copia-e-cola",
  qrCodeBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
  ticketUrl: "https://www.mercadopago.com/pix/ticket/ORD-1",
  expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
};

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(body) };
}

async function fillEmailAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /gerar pix/i }));
  const emailInput = screen.getByLabelText(/seu e-mail/i);
  await user.type(emailInput, "comprador@example.com");
  await user.click(screen.getByRole("button", { name: /gerar código pix/i }));
}

/**
 * `userEvent.setup()` sempre instala seu próprio stub de `navigator.clipboard`
 * (um getter, ver node_modules/@testing-library/user-event/.../Clipboard.js),
 * substituindo qualquer mock feito antes dele. Por isso o mock de
 * `writeText` só pode ser aplicado depois de chamar `userEvent.setup()`,
 * sobrescrevendo o método no próprio objeto que o getter devolve.
 */
function mockClipboardWriteText(impl?: () => Promise<void>) {
  const fn = impl ? vi.fn(impl) : vi.fn().mockResolvedValue(undefined);
  navigator.clipboard.writeText = fn;
  return fn;
}

describe("<PixCheckout />", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    // jsdom não implementa execCommand — fornecemos um stub para o fallback de cópia poder ser exercitado.
    (document as unknown as { execCommand: (cmd: string) => boolean }).execCommand = vi.fn(() => true);
    // sessionStorage é compartilhado pelo jsdom entre os testes deste arquivo —
    // sem isto, a sessão persistida por um teste faria o próximo montar já em
    // modo de retomada (ver PixCheckout.tsx).
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("ao montar com uma sessão de refresh persistida, retoma o Pix automaticamente sem pedir e-mail de novo", async () => {
    sessionStorage.setItem(
      "pix-checkout-session",
      JSON.stringify({ clientToken: "resumed-token", email: "resumido@example.com" })
    );
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchOnce({ ...PIX_RESPONSE, pedidoId: "resumed-token" })
    );

    render(
      <PixCheckout area="financeiro" areaName="Financeiro">
        Gerar Pix
      </PixCheckout>
    );

    await screen.findByAltText(/qr code pix/i);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, requestInit] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sentBody = JSON.parse(requestInit.body as string);
    expect(sentBody.clientToken).toBe("resumed-token");
    expect(sentBody.payerEmail).toBe("resumido@example.com");
  });

  it("renderiza o QR code e o campo Pix copia e cola depois de gerar o Pix", async () => {
    const user = userEvent.setup();
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFetchOnce(PIX_RESPONSE));

    render(
      <PixCheckout area="financeiro" areaName="Financeiro">
        Gerar Pix
      </PixCheckout>
    );

    await fillEmailAndSubmit(user);

    const img = await screen.findByAltText(/qr code pix/i);
    expect(img).toHaveAttribute("src", `data:image/png;base64,${PIX_RESPONSE.qrCodeBase64}`);

    const copiaECola = screen.getByLabelText(/pix copia e cola/i) as HTMLInputElement;
    expect(copiaECola.value).toBe(PIX_RESPONSE.qrCode);

    expect(screen.getByRole("link", { name: /abrir página de pagamento/i })).toHaveAttribute(
      "href",
      PIX_RESPONSE.ticketUrl
    );
  });

  it("botão Copiar chama a clipboard e mostra feedback 'Copiado!'", async () => {
    const user = userEvent.setup();
    const writeText = mockClipboardWriteText();
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFetchOnce(PIX_RESPONSE));

    render(
      <PixCheckout area="financeiro" areaName="Financeiro">
        Gerar Pix
      </PixCheckout>
    );
    await fillEmailAndSubmit(user);
    await screen.findByAltText(/qr code pix/i);

    await user.click(screen.getByRole("button", { name: /copiar/i }));

    expect(writeText).toHaveBeenCalledWith(PIX_RESPONSE.qrCode);
    expect(await screen.findByRole("button", { name: /copiado!/i })).toBeInTheDocument();
  });

  it("usa o fallback de textarea + execCommand quando a clipboard falha, e ainda mostra o feedback", async () => {
    const user = userEvent.setup();
    mockClipboardWriteText(() => Promise.reject(new Error("clipboard indisponível")));
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFetchOnce(PIX_RESPONSE));

    render(
      <PixCheckout area="financeiro" areaName="Financeiro">
        Gerar Pix
      </PixCheckout>
    );
    await fillEmailAndSubmit(user);
    await screen.findByAltText(/qr code pix/i);

    await user.click(screen.getByRole("button", { name: /copiar/i }));

    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(await screen.findByRole("button", { name: /copiado!/i })).toBeInTheDocument();
  });

  it("mostra a tela de erro quando a criação do Pix falha, e permite tentar de novo", async () => {
    const user = userEvent.setup();
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchOnce({ error: "Não foi possível gerar o Pix." }, false, 502)
    );

    render(
      <PixCheckout area="financeiro" areaName="Financeiro">
        Gerar Pix
      </PixCheckout>
    );
    await fillEmailAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível gerar o pix/i);
    expect(screen.getByRole("button", { name: /tentar de novo/i })).toBeInTheDocument();
  });

  it("conta a contagem regressiva e passa para 'expirado' quando o prazo do Pix acaba", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    const expiresInTwoSeconds = new Date(Date.now() + 2000).toISOString();
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchOnce({ ...PIX_RESPONSE, expiresAt: expiresInTwoSeconds })
    );
    // Evita que o polling de status dispare fetches extras durante o avanço do timer.
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockFetchOnce({ status: "pendente" }));

    render(
      <PixCheckout area="financeiro" areaName="Financeiro">
        Gerar Pix
      </PixCheckout>
    );
    await fillEmailAndSubmit(user);
    await screen.findByAltText(/qr code pix/i);

    expect(screen.getByText(/expira em/i)).toHaveTextContent("0:02");

    await vi.advanceTimersByTimeAsync(3000);

    expect(await screen.findByText(/esse pix expirou/i)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("o polling para quando o status muda para 'pago'", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFetchOnce(PIX_RESPONSE));

    render(
      <PixCheckout area="financeiro" areaName="Financeiro">
        Gerar Pix
      </PixCheckout>
    );
    await fillEmailAndSubmit(user);
    await screen.findByAltText(/qr code pix/i);

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFetchOnce({ status: "pago" }));
    await vi.advanceTimersByTimeAsync(5000);

    expect(await screen.findByRole("status")).toHaveTextContent(/pagamento aprovado/i);
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/obrigado\?area=.+&email=/));

    const callsAfterPaid = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await vi.advanceTimersByTimeAsync(30000);
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAfterPaid);

    vi.useRealTimers();
  });

  it("tela de pago: link para baixar agora e botão de reenviar e-mail (POST, sem corpo)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFetchOnce(PIX_RESPONSE));

    render(
      <PixCheckout area="financeiro" areaName="Financeiro">
        Gerar Pix
      </PixCheckout>
    );
    await fillEmailAndSubmit(user);
    await screen.findByAltText(/qr code pix/i);

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFetchOnce({ status: "pago" }));
    await vi.advanceTimersByTimeAsync(5000);
    await screen.findByRole("status");

    const link = screen.getByRole("link", { name: /baixar o guia agora/i });
    expect(link.getAttribute("href")).toBe(`/api/orders/${PIX_RESPONSE.pedidoId}/guia`);

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, status: 202, json: () => Promise.resolve({ ok: true }) });
    await user.click(screen.getByRole("button", { name: /reenviar e-mail/i }));
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
    expect(url).toBe(`/api/orders/${PIX_RESPONSE.pedidoId}/reenviar`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect(await screen.findByText(/pedimos o reenvio/i)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("o polling para quando o status muda para 'expirado'", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFetchOnce(PIX_RESPONSE));

    render(
      <PixCheckout area="financeiro" areaName="Financeiro">
        Gerar Pix
      </PixCheckout>
    );
    await fillEmailAndSubmit(user);
    await screen.findByAltText(/qr code pix/i);

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFetchOnce({ status: "expirado" }));
    await vi.advanceTimersByTimeAsync(5000);

    expect(await screen.findByText(/esse pix expirou/i)).toBeInTheDocument();

    const callsAfterExpired = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await vi.advanceTimersByTimeAsync(30000);
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAfterExpired);

    vi.useRealTimers();
  });
});
