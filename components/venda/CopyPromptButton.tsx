"use client";

import { useEffect, useRef, useState } from "react";

export default function CopyPromptButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard access denied or unavailable; the button still gives visual feedback
    }
    setCopied(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="w-full min-h-12 rounded-xl border border-[#6A5E55] text-[15px] font-semibold cursor-pointer"
      style={{
        background: copied ? "#F5EFE6" : "transparent",
        color: copied ? "#2A2420" : "#F5EFE6",
      }}
    >
      {copied ? "Copiado ✓" : "Copiar prompt"}
    </button>
  );
}
