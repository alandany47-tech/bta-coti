import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { QuoteSnapshot } from "@/lib/quote-snapshot";

/**
 * Alta de cotizaciones con la service role: los usuarios ya no escriben `quotes` por REST (0016),
 * así los montos siempre salen del servidor. Quien llame debe haber validado sesión, membresía y
 * que el ítem y el cliente son del tenant. La cuota diaria y el número consecutivo los aplica
 * la base (trigger `quotes_quota_guard`).
 */
export type CreateQuoteResult =
  | { ok: true; number: number; shareToken: string }
  | { ok: false; code: "quote_quota_exceeded" | "error" };

export async function createQuote(input: {
  id: string;
  tenantId: string;
  createdBy: string;
  propertyId: string;
  clientId: string;
  snapshot: QuoteSnapshot;
  discountPct: number;
  downPaymentPct: number;
}): Promise<CreateQuoteResult> {
  const { snapshot } = input;
  const { data, error } = await createServiceRoleClient()
    .from("quotes")
    .insert({
      id: input.id,
      tenant_id: input.tenantId,
      created_by: input.createdBy,
      property_id: input.propertyId,
      client_id: input.clientId,
      client_name: snapshot.clientName,
      client_phone: snapshot.clientPhone,
      discount_pct: input.discountPct,
      down_payment_pct: input.downPaymentPct,
      down_payment_amount: snapshot.breakdown.downPaymentAmount,
      installments_count: snapshot.installmentsCount,
      monthly_payment_amount: snapshot.breakdown.monthlyPaymentAmount,
      final_payment_amount: snapshot.breakdown.finalPaymentAmount,
      total_amount: snapshot.breakdown.effectivePrice,
      notes: snapshot.notes,
      status: "sent",
      created_at: snapshot.createdAt,
      snapshot: JSON.parse(JSON.stringify(snapshot)),
    })
    .select("number, share_token")
    .single();

  if (error || !data) {
    if (error?.message.includes("quote_quota_exceeded")) return { ok: false, code: "quote_quota_exceeded" };
    console.error("createQuote falló", error?.message);
    return { ok: false, code: "error" };
  }
  return { ok: true, number: data.number, shareToken: data.share_token };
}
