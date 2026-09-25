"use client";

import { useEffect, useState } from "react";
import { Search, UserPlus, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Client } from "@/lib/types";

export function ClientCombobox({
  tenantSlug,
  selected,
  onSelect,
}: {
  tenantSlug: string;
  selected: Client | null;
  onSelect: (client: Client | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Client[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newPhone, setNewPhone] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/${tenantSlug}/clients?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        setResults(res.ok ? data.clients ?? [] : []);
      } catch {
        // abortado o error de red: se ignora, el usuario puede reintentar
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, isOpen, tenantSlug]);

  async function handleCreate() {
    const fullName = query.trim();
    const phone = newPhone.trim();
    if (!fullName || !phone) {
      setCreateError("Nombre y teléfono son obligatorios.");
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`/api/${tenantSlug}/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "No se pudo crear el cliente.");
        return;
      }
      onSelect(data.client as Client);
      setQuery("");
      setNewPhone("");
      setIsOpen(false);
    } catch {
      setCreateError("Error de red al crear el cliente.");
    } finally {
      setIsCreating(false);
    }
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-md border border-border-subtle bg-surface px-3 py-2.5">
        <div className="flex flex-col">
          <span className="text-sm text-foreground">{selected.full_name}</span>
          <span className="text-xs text-muted">{selected.phone}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setQuery("");
          }}
          className="text-muted hover:text-foreground"
          aria-label="Cambiar cliente"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const exactMatch = results.some(
    (c) => c.full_name.toLowerCase() === query.trim().toLowerCase(),
  );

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsOpen(false);
        }
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setCreateError(null);
          }}
          placeholder="Buscar cliente por nombre o teléfono…"
          className="pl-9"
        />
      </div>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border-subtle bg-surface shadow-lg">
          {isSearching && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted">
              <Loader2 className="h-3 w-3 animate-spin" />
              Buscando…
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <ul className="max-h-56 overflow-auto">
              {results.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSelect(client);
                      setQuery("");
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-surface-hover",
                    )}
                  >
                    <span className="text-foreground">{client.full_name}</span>
                    <span className="text-xs text-muted">{client.phone}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!isSearching && query.trim() && !exactMatch && (
            <div className="border-t border-border-subtle p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs text-muted">
                <UserPlus className="h-3.5 w-3.5" />
                Crear cliente nuevo: <span className="text-foreground">{query.trim()}</span>
              </p>
              <div className="flex gap-2">
                <Input
                  value={newPhone}
                  onChange={(e) =>
                    setNewPhone(e.target.value.replace(/[^\d+]/g, ""))
                  }
                  placeholder="Teléfono (+52...)"
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={isCreating}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleCreate}
                >
                  {isCreating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Crear"
                  )}
                </Button>
              </div>
              {createError && (
                <p className="mt-1.5 text-xs text-danger">{createError}</p>
              )}
            </div>
          )}

          {!isSearching && !query.trim() && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted">
              Escribe para buscar en tu cartera de clientes.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
