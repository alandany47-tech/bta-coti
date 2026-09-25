import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function isDisposableEmail(email: string): Promise<boolean> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.rpc("is_disposable_email", { p_email: email });
  return data === true;
}
