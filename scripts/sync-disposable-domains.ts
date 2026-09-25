// Uso: node --env-file=.env.local scripts/sync-disposable-domains.ts
import { createClient } from "@supabase/supabase-js";
import { syncDisposableDomains } from "../lib/disposable-domains.ts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const total = await syncDisposableDomains(supabase);
console.log(`Dominios desechables sincronizados: ${total}`);
