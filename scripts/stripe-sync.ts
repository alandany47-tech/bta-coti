// Uso: node --env-file=.env.local scripts/stripe-sync.ts
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { syncPlansToStripe } from "../lib/stripe-sync.ts";

if (!process.env.STRIPE_SECRET_KEY) throw new Error("Falta STRIPE_SECRET_KEY en el entorno");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const updated = await syncPlansToStripe(stripe, supabase);
console.log(`Planes sincronizados con Stripe: ${updated} price(s) creado(s)/actualizado(s).`);
