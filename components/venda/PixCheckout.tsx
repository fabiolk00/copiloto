"use client";

import { useCallback, useEffect, useState } from "react";
import { track } from "@/lib/track";
import { useTrilha } from "./TrilhaProvider";

type Step = "idle" | "email" | "loading" | "waiting" | "paid" | "expired" | "error";

type PixData = {
  pedidoId: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string | null;
  expiresAt: string;
};

const POLL_MIN_MS = 5_000;
const POLL_MAX_MS = 30_000;

const SESSION_STORAGE_KEY = "pix-checkout-session";

type PersistedSession = { clientToken: string; email: string };

/**
 * Sobrevive a um F5 na mesma aba (mas não a uma aba nova) enquanto o Pix
 * ainda está pendente — sem isto, um reload trocaria o clientToken e o
 * servidor nunca saberia que já existe uma order em aberto para este pedido.
 */
function readPersistedSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    if (typeof parsed.clientToken === "string" && typeof parsed.email === "string") {
      return { clientToken: parsed.clientToken, email: parsed.email };
    }
  } catch {
    // sessionStorage indisponível (modo privado) ou valor corrompido — segue sem recuperar nada.
  }
  return null;
}

function persistSession(session: PersistedSession) {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // armazenamento indisponível — só significa que um refresh não vai recuperar o Pix atual.
  }
}

function clearPersistedSession() {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // nada a fazer.
  }
}

function emailLooksValid(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function PixCheckout({
  area,
  areaName,
  className,
  children,
}: {
  area: string;
  areaName: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { trilha } = useTrilha();
  const [clientToken] = useState(() => readPersistedSession()?.clientToken ?? crypto.randomUUID());
  // Captura, só na primeira renderização, se este mount começa retomando uma
  // sessão de uma aba que já tinha um Pix pendente (ver efeito de retomada abaixo).
  const [isResuming] = useState(() => readPersistedSession() !== null);

  const [step, setStep] = useState<Step>(() => (readPersistedSession() ? "loading" : "idle"));
  const [email, setEmail] = useState(() => readPersistedSession()?.email ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pix, setPix] = useState<PixData | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [copied, setCopied] = useState(false);
  const [resend, setResend] = useState<"idle" | "sending" | "sent" | "limit" | "error">("idle");

  const createPix = useCallback(async () => {
    setStep("loading");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/pix/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area,
          trilha,
          payerEmail: email,
          clientToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível gerar o Pix.");

      setPix(data);
      setStep("waiting");
      persistSession({ clientToken, email });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Não foi possível gerar o Pix.");
      setStep("error");
    }
  }, [area, email, trilha, clientToken]);

  // Retomada após F5: se a aba já tinha um clientToken salvo, repete a
  // mesma chamada de criação — o servidor reconhece o pedido pendente e
  // devolve o Pix já existente em vez de criar uma nova order (ver o branch
  // de replay em app/api/pix/create/route.ts), então o usuário não perde o
  // QR Code nem gera cobrança duplicada só por ter recarregado a página.
  useEffect(() => {
    if (!isResuming) return;
    // Adia para depois do commit do efeito: `createPix` seta estado já na
    // primeira linha (`setStep("loading")`), e chamar isso de forma síncrona
    // dentro do corpo do efeito é exatamente o que a regra
    // react-hooks/set-state-in-effect aponta como causa de cascading renders.
    queueMicrotask(() => {
      void createPix();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown — drives the UI independently of the backend poll, so expiry
  // feedback is instant instead of waiting for the next 5s tick.
  useEffect(() => {
    if (step !== "waiting" || !pix) return;
    const tick = () => {
      const ms = new Date(pix.expiresAt).getTime() - Date.now();
      setRemainingMs(ms);
      if (ms <= 0) setStep("expired");
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [step, pix]);

  // Polling with backoff, stopping on a terminal status or once locally expired.
  useEffect(() => {
    if (step !== "waiting" || !pix) return;
    let delay = POLL_MIN_MS;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${pix.pedidoId}/status`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;

        if (data.status === "pago") {
          setStep("paid");
          clearPersistedSession();
          return;
        }
        if (data.status === "expirado" || data.status === "cancelado" || data.status === "falhou") {
          setStep("expired");
          return;
        }
      } catch {
        // rede instável — mantém o polling, só aumenta o intervalo abaixo
      }
      if (cancelled) return;
      delay = Math.min(delay * 1.5, POLL_MAX_MS);
      timer = setTimeout(poll, delay);
    };

    timer = setTimeout(poll, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [step, pix]);

  const handleStart = () => {
    track("click_cta", { area, trilha: trilha ?? undefined, posicao: "closing" });
    setStep("email");
  };

  const handleResend = async () => {
    if (!pix || resend === "sending") return;
    setResend("sending");
    try {
      const res = await fetch(`/api/orders/${pix.pedidoId}/reenviar`, { method: "POST", cache: "no-store" });
      if (res.status === 202) setResend("sent");
      else if (res.status === 429 || res.status === 409) setResend("limit");
      else setResend("error");
    } catch {
      setResend("error");
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailLooksValid(email)) {
      setErrorMessage("Digite um e-mail válido — é para onde o PDF vai ser enviado.");
      return;
    }
    createPix();
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch {
        // nada mais a fazer — o campo abaixo já permite selecionar manualmente
      }
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === "idle") {
    // Sem trilha escolhida o pedido não pode ser entregue: o botao fica bloqueado até a escolha.
    if (!trilha) {
      return (
        <>
          <button type="button" disabled className={className}>
            {children}
          </button>
          <span className="mt-2 block text-center text-sm text-[#645950]">
            Escolha uma trilha acima para liberar o guia.
          </span>
        </>
      );
    }
    return (
      <button type="button" onClick={handleStart} className={className}>
        {children}
      </button>
    );
  }

  if (step === "email") {
    return (
      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-2">
        <label htmlFor="pix-email" className="text-sm text-[#4A403A]">
          Seu e-mail (é para onde o PDF vai)
        </label>
        <input
          id="pix-email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@email.com"
          className="min-h-12 rounded-xl border border-[#DCCFBD] px-4 text-base"
        />
        <button type="submit" className={className}>
          Gerar código Pix
        </button>
        {errorMessage && <p role="alert" className="text-sm text-red-700">{errorMessage}</p>}
      </form>
    );
  }

  if (step === "loading") {
    return (
      <button type="button" disabled aria-busy className={className}>
        Gerando o Pix…
      </button>
    );
  }

  if (step === "error") {
    return (
      <div className="flex flex-col gap-2">
        <p role="alert" className="text-sm text-red-700">{errorMessage}</p>
        <button type="button" onClick={createPix} className={className}>
          Tentar de novo
        </button>
      </div>
    );
  }

  if (step === "expired") {
    return (
      <div className="flex flex-col gap-2 items-center">
        <p className="text-sm text-[#4A403A]">Esse Pix expirou.</p>
        <button type="button" onClick={createPix} className={className}>
          Gerar novo Pix
        </button>
      </div>
    );
  }

  if (step === "paid") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-[#DCCFBD] bg-[#FBF8F2] p-6 flex flex-col gap-2 items-center text-center"
      >
        <span className="text-2xl">✅</span>
        <p className="font-semibold">Pagamento aprovado!</p>
        <p className="text-sm text-[#4A403A]">
          O PDF do guia de {areaName} chega no seu e-mail em poucos minutos.
        </p>
        {pix && (
          <div className="flex flex-col gap-2 items-center mt-2">
            <a
              href={`/api/orders/${pix.pedidoId}/guia`}
              className="rounded-lg bg-[#2B2420] px-4 py-2 text-sm text-white"
            >
              Baixar o guia agora
            </a>
            <button
              type="button"
              onClick={handleResend}
              disabled={resend === "sending" || resend === "sent"}
              className="text-sm underline text-[#4A403A] disabled:opacity-60"
            >
              Reenviar e-mail
            </button>
            {resend === "sent" && <p className="text-xs text-[#4A403A]">Pedimos o reenvio. Confira também o spam.</p>}
            {resend === "limit" && (
              <p className="text-xs text-[#4A403A]">Não é possível reenviar agora. Use o botão para baixar o guia.</p>
            )}
            {resend === "error" && <p className="text-xs text-[#4A403A]">Não foi possível reenviar agora. Tente de novo em instantes.</p>}
          </div>
        )}
      </div>
    );
  }

  // step === "waiting"
  return (
    <div className="rounded-2xl border border-[#DCCFBD] bg-[#FBF8F2] p-6 flex flex-col gap-4 items-center">
      <p className="text-sm text-[#4A403A]">Escaneie o QR Code ou copie o código Pix</p>
      {pix && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/png;base64,${pix.qrCodeBase64}`}
          alt="QR Code Pix para pagamento"
          width={220}
          height={220}
          className="rounded-lg border border-[#DCCFBD]"
        />
      )}
      <div className="w-full flex flex-col gap-2">
        <label htmlFor="pix-copia-cola" className="text-xs text-[#645950]">
          Pix copia e cola
        </label>
        <div className="flex gap-2">
          <input
            id="pix-copia-cola"
            type="text"
            readOnly
            value={pix?.qrCode ?? ""}
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-11 flex-1 rounded-xl border border-[#DCCFBD] px-3 text-xs"
          />
          <button
            type="button"
            onClick={() => pix && handleCopy(pix.qrCode)}
            className="min-h-11 px-4 rounded-xl bg-[#8C5E1E] text-[#FBF8F2] text-sm font-semibold whitespace-nowrap"
          >
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
      </div>
      <p className="text-sm text-[#645950]">Expira em {formatCountdown(remainingMs)}</p>
      {pix?.ticketUrl && (
        <a href={pix.ticketUrl} target="_blank" rel="noreferrer" className="text-sm underline">
          Abrir página de pagamento do Pix
        </a>
      )}
      <p className="text-xs text-[#7A6E64]">Aguardando confirmação do pagamento…</p>
    </div>
  );
}
