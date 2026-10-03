"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareButton({ url, title, label = "Compartir" }: { url: string; title: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
      } catch {
        // El visitante cerró la hoja de compartir: no es un error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copia este enlace", url);
    }
  }

  return (
    <Button variant="secondary" onClick={handleShare}>
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Share2 className="h-4 w-4" aria-hidden />}
      <span role="status">{copied ? "Enlace copiado" : label}</span>
    </Button>
  );
}
