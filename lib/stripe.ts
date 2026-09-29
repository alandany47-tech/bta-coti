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
