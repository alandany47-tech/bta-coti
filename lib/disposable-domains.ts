import type { SupabaseClient } from "@supabase/supabase-js";

const SOURCE_URL =
  "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf";

const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export async function fetchDisposableDomains(): Promise<string[]> {
  const response = await fetch(SOURCE_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`No se pudo bajar la lista de dominios (${response.status})`);
  }
  const text = await response.text();
  const domains = text
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line && !line.startsWith("#") && DOMAIN_PATTERN.test(line));
  return [...new Set(domains)];
}

export async function syncDisposableDomains(supabase: SupabaseClient): Promise<number> {
  const domains = await fetchDisposableDomains();
  if (domains.length < 100) {
    throw new Error(`Lista sospechosamente corta (${domains.length}); no se sincroniza`);
  }
  for (let i = 0; i < domains.length; i += 1000) {
    const rows = domains.slice(i, i + 1000).map((domain) => ({ domain }));
    const { error } = await supabase
      .from("disposable_email_domains")
      .upsert(rows, { onConflict: "domain", ignoreDuplicates: true });
    if (error) throw error;
  }
  return domains.length;
}
