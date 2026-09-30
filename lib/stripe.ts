import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

/** Único cliente de Stripe del servidor; usa la versión de API fija que trae el SDK. */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe no está configurado");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

/** Link al dashboard de Stripe para un customer/subscription (Cliente-detalle, T24b). */
export function stripeDashboardUrl(kind: "customers" | "subscriptions", id: string): string {
  const test = process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ? "/test" : "";
  return `https://dashboard.stripe.com${test}/${kind}/${id}`;
}
