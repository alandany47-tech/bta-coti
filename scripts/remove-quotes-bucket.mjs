// Retira el bucket `quotes` de Supabase Storage (T15: el PDF ya no se guarda en el servidor).
// Uso: node --env-file=.env.local scripts/remove-quotes-bucket.mjs
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const empty = await supabase.storage.emptyBucket("quotes");
if (empty.error && !/not found/i.test(empty.error.message)) throw empty.error;
const removed = await supabase.storage.deleteBucket("quotes");
if (removed.error && !/not found/i.test(removed.error.message)) throw removed.error;
console.log("Bucket quotes retirado.");
