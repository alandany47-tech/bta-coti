export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/stripe-webhook";

/** docs/STRIPE.md §6: firma verificada con STRIPE_WEBHOOK_SECRET; sin eso no hay forma de confiar en el body. */
export async function POST(request: Request) {
  if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe no está configurado." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();
  if (!signature) return NextResponse.json({ error: "Falta la firma." }, { status: 400 });

  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (error) {
    console.error("stripe webhook falló", event.id, event.type, error);
    return NextResponse.json({ error: "No se pudo procesar el evento." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
