import { useSyncExternalStore } from "react";

/** Nunca cambia después del mount: alcanza con un subscribe no-op. */
function subscribeToNothing() {
  return () => {};
}

/**
 * Refleja el host actual (protocolo + puerto) en local; usa el dominio raíz
 * en prod. Vía useSyncExternalStore (con getServerSnapshot) en vez de
 * useState+useEffect: leer `window.location` durante el render causaría un
 * hydration mismatch (SSR no tiene `window`), y "corregirlo" con setState
 * dentro de un efecto es el anti-patrón que react-hooks/set-state-in-effect
 * marca como error — este hook es la vía que React sí sanciona para valores
 * que legítimamente difieren entre servidor y cliente.
 */
export function useTenantUrl(slug: string, rootDomain: string) {
  return useSyncExternalStore(
    subscribeToNothing,
    () => {
      const { protocol, hostname, port } = window.location;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return `${protocol}//${slug}.localhost${port ? `:${port}` : ""}`;
      }
      return `${protocol}//${slug}.${rootDomain}`;
    },
    () => `https://${slug}.${rootDomain}`,
  );
}
