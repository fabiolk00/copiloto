"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Trilha } from "@/lib/guias";
import { track } from "@/lib/track";

type TrilhaContextValue = {
  trilha: Trilha | null;
  /** Pass `null` to clear the selection (e.g. clicking the already-selected option again). */
  setTrilha: (trilha: Trilha | null) => void;
};

const TrilhaContext = createContext<TrilhaContextValue | null>(null);

function isTrilha(value: string | null): value is Trilha {
  return value === "crescer" || value === "mudar";
}

/**
 * Reads the `trilha` track from `?trilha=` on mount and keeps the URL in sync
 * when the user picks one, without triggering a navigation or losing scroll.
 * NÃO usa `useSearchParams`: esse hook dentro de <Suspense> faz o Next
 * abandonar a renderização no servidor e entregar a página inteira só pelo
 * cliente (sem <main>/<h1> no HTML bruto, o que quebra a indexação). O
 * parâmetro é lido de `window.location` após a hidratação; o HTML estático
 * sai no estado "sem trilha" e é ajustado no cliente.
 */
export function TrilhaProvider({
  areaSlug,
  children,
}: {
  areaSlug: string;
  children: ReactNode;
}) {
  const [trilha, setTrilhaState] = useState<Trilha | null>(null);

  useEffect(() => {
    // Leitura única do parâmetro após a hidratação. Adiado em microtask para
    // não setar estado de forma síncrona no efeito (react-hooks/set-state-in-effect).
    const param = new URLSearchParams(window.location.search).get("trilha");
    if (!isTrilha(param)) return;
    queueMicrotask(() => {
      setTrilhaState(param);
      track("select_trilha", { area: areaSlug, trilha: param });
    });
  }, [areaSlug]);

  const setTrilha = (next: Trilha | null) => {
    setTrilhaState(next);
    const url = new URL(window.location.href);
    if (next) {
      url.searchParams.set("trilha", next);
    } else {
      url.searchParams.delete("trilha");
    }
    window.history.replaceState(window.history.state, "", url);
    if (next) track("select_trilha", { area: areaSlug, trilha: next });
  };

  return (
    <TrilhaContext.Provider value={{ trilha, setTrilha }}>
      {children}
    </TrilhaContext.Provider>
  );
}

export function useTrilha(): TrilhaContextValue {
  const ctx = useContext(TrilhaContext);
  if (!ctx) {
    throw new Error("useTrilha deve ser usado dentro de <TrilhaProvider>");
  }
  return ctx;
}
