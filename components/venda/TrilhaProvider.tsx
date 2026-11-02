"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
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
 * Uses `useSearchParams`, so the consuming page must render this inside a
 * `<Suspense>` boundary to keep its routes statically generated (SSG).
 */
export function TrilhaProvider({
  areaSlug,
  children,
}: {
  areaSlug: string;
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const paramTrilha = searchParams.get("trilha");
  const [trilha, setTrilhaState] = useState<Trilha | null>(
    isTrilha(paramTrilha) ? paramTrilha : null
  );
  const trackedInitialRead = useRef(false);

  useEffect(() => {
    if (isTrilha(paramTrilha) && paramTrilha !== trilha) {
      setTrilhaState(paramTrilha);
    }
    if (isTrilha(paramTrilha) && !trackedInitialRead.current) {
      trackedInitialRead.current = true;
      track("select_trilha", { area: areaSlug, trilha: paramTrilha });
    }
    // only react to the URL param changing, not to local selection state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramTrilha]);

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
