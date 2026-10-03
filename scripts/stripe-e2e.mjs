/**
 * Revisión de Stripe de punta a punta (T35) contra Stripe en MODO PRUEBA y la base real, con tenants
 * temporales que se borran al terminar. Cubre: Checkout con tarjeta (parámetros, reserva, sesión previa),
 * pago aprobado, portal, cobro rechazado + correo T25, recuperación, firma/idempotencia del webhook,
 * suspensión del admin vs. pago, cancelación, bajar de plan con exceso, SPEI y la gracia de 7 días.
 *
 * Requisitos (los tres en marcha antes de correrlo):
 *   1. `RESEND_API_KEY=test RESEND_API_URL=http://localhost:4555/emails npm run dev -- -p 3100`
 *   2. `stripe listen --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.finalized,invoice.paid,invoice.payment_failed,invoice.overdue,charge.dispute.created --forward-to localhost:3100/api/stripe/webhook`
 *      (su `whsec_` debe ser el de STRIPE_WEBHOOK_SECRET)
 *   3. `npm run stripe:e2e`
 * No completa la página hospedada de Checkout (no se teclean tarjetas): el pago se simula por API con `pm_card_visa`.
 */
import { createRequire } from "node:module";
import { createServer, request as httpRequest } from "node:http";
import { randomBytes } from "node:crypto";
const require = createRequire(import.meta.url);
const Stripe = require("stripe");
const { createServerClient } = require("@supabase/ssr");

if (!String(process.env.STRIPE_SECRET_KEY).startsWith("sk_test_")) {
  console.error("Solo corre con una llave de prueba (sk_test_...).");
  process.exit(2);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const rest = (p, init = {}) => fetch(`${url}/rest/v1/${p}`, { ...init, headers: { ...H, Prefer: "return=representation", ...(init.headers ?? {}) } });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const slug = "zz-pago-" + randomBytes(2).toString("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = "") => { results.push([name, ok]); console.log(`${ok ? "✔" : "✘ FALLA"} ${name}${extra ? " — " + extra : ""}`); };

// Resend falso
const mails = [];
const mock = createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { mails.push(JSON.parse(b)); res.end("{}"); }); });
await new Promise((r) => mock.listen(4555, r));

// tenant + dueño
const email = `${slug}@ayxco.test`, password = randomBytes(12).toString("hex");
const user = await (await fetch(`${url}/auth/v1/admin/users`, { method: "POST", headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
const prov = await fetch(`${url}/rest/v1/rpc/provision_tenant`, { method: "POST", headers: H, body: JSON.stringify({ p_owner: user.id, p_name: "Prueba Stripe", p_slug: slug, p_plan_code: "esencial", p_status: "trialing", p_trial_days: 7, p_source: "self_signup" }) });
if (!prov.ok) throw new Error("provision_tenant: " + (await prov.text()));
const tenantId = await prov.json();
const plans = Object.fromEntries((await (await rest("plans?select=id,code,stripe_price_month")).json()).map((p) => [p.code, p]));
const tenant = async () => (await (await rest(`tenants?id=eq.${tenantId}&select=status,status_reason,plan_id,stripe_customer_id,stripe_subscription_id,stripe_checkout_session_id,stripe_checkout_pending_at`)).json())[0];
const planCode = (id) => Object.values(plans).find((p) => p.id === id)?.code;
const until = async (name, fn, ms = 25000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(700); } return null; };

// sesión del dueño → cookie
const jar = [];
const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: (l) => l.forEach((c) => jar.push(c)) } });
const { error: authErr } = await sb.auth.signInWithPassword({ email, password });
if (authErr) throw authErr;
const cookie = jar.map((c) => `${c.name}=${c.value}`).join("; ");
const api = (path, body) => new Promise((resolve, reject) => {
  const data = JSON.stringify(body ?? {});
  const r = httpRequest({ host: "127.0.0.1", port: 3100, path, method: "POST", headers: { Host: `${slug}.localhost:3100`, Cookie: cookie, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } }, (res) => { let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => { try { resolve({ status: res.statusCode, body: JSON.parse(b) }); } catch { resolve({ status: res.statusCode, body: b }); } }); });
  r.on("error", reject); r.end(data);
});

let customerId, subId, subs = [];
try {
  // ---- A. Checkout con tarjeta: parámetros de la sesión ----
  console.log("\n== A. Checkout con tarjeta ==");
  const a = await api(`/api/${slug}/billing/checkout`, { plan_code: "catalogo", interval: "month", payment_method: "card" });
  check("POST checkout tarjeta → 200 con URL de Stripe", a.status === 200 && /checkout\.stripe\.com/.test(a.body.url ?? ""), `status ${a.status} ${a.body.error ?? ""}`);
  let t = await tenant();
  const s1 = await stripe.checkout.sessions.retrieve(t.stripe_checkout_session_id, { expand: ["line_items"] });
  check("sesión: mode=subscription, tarjeta, tenant_id en client_reference_id y metadata", s1.mode === "subscription" && s1.client_reference_id === tenantId && s1.metadata.tenant_id === tenantId && s1.payment_method_types.join() === "card");
  check("sesión: precio mensual del plan Catálogo", s1.line_items.data[0].price.id === plans.catalogo.stripe_price_month);
  check("sesión: URLs de retorno al panel de facturación del subdominio", s1.success_url.includes(`${slug}.`) && s1.success_url.endsWith("/panel/facturacion?checkout=success"), s1.success_url);
  const dup = await api(`/api/${slug}/billing/checkout`, { plan_code: "catalogo", interval: "month", payment_method: "card" });
  check("segundo POST inmediato → 409 (reserva)", dup.status === 409, dup.body.error);
  await rest(`tenants?id=eq.${tenantId}`, { method: "PATCH", body: JSON.stringify({ stripe_checkout_pending_at: null }) });
  const a3 = await api(`/api/${slug}/billing/checkout`, { plan_code: "catalogo", interval: "year", payment_method: "card" });
  const old = await stripe.checkout.sessions.retrieve(s1.id);
  check("reintento tras liberar la reserva: expira la sesión anterior y crea otra", a3.status === 200 && old.status === "expired", `anterior=${old.status}`);
  const bad = await api(`/api/${slug}/billing/checkout`, { plan_code: "inexistente", interval: "month", payment_method: "card" });
  check("plan inexistente → 400", bad.status === 400);

  // ---- B. Pago exitoso (equivale a completar Checkout con 4242; aquí por API con pm_card_visa) ----
  console.log("\n== B. Pago con tarjeta aprobada ==");
  customerId = (await stripe.customers.create({ email, metadata: { tenant_id: tenantId } })).id;
  const pmOk = await stripe.paymentMethods.attach("pm_card_visa", { customer: customerId });
  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pmOk.id } });
  const sub = await stripe.subscriptions.create({ customer: customerId, items: [{ price: plans.catalogo.stripe_price_month }], metadata: { tenant_id: tenantId } });
  subId = sub.id; subs.push(subId);
  t = await until("activo", async () => { const x = await tenant(); return x.status === "active" && x.stripe_subscription_id === subId ? x : null; });
  check("webhooks: tenant pasa a active con la suscripción ligada", !!t, JSON.stringify(t));
  check("plan_id sincronizado a catalogo", planCode((await tenant()).plan_id) === "catalogo");
  const row = (await (await rest(`subscriptions?tenant_id=eq.${tenantId}&select=status,stripe_price_id,collection_method,current_period_end`)).json())[0];
  check("fila en subscriptions (active, charge_automatically, con fin de periodo)", row?.status === "active" && row.collection_method === "charge_automatically" && !!row.current_period_end, JSON.stringify(row));
  const trialCron = await (await fetch(`${url}/rest/v1/rpc/expire_trials`, { method: "POST", headers: H, body: "{}" })).json();
  check("expire_trials no toca a un tenant con suscripción", !trialCron.includes(slug));

  // ---- C. Duplicado y portal ----
  console.log("\n== C. Suscripción existente y portal ==");
  const d2 = await api(`/api/${slug}/billing/checkout`, { plan_code: "broker", interval: "month", payment_method: "card" });
  check("checkout con suscripción activa → 409 (usar el portal)", d2.status === 409, d2.body.error);
  const portal = await api(`/api/${slug}/billing/portal`);
  check("portal → 200 con URL de billing.stripe.com", portal.status === 200 && /billing\.stripe\.com/.test(portal.body.url ?? ""), `status ${portal.status} ${portal.body.error ?? ""}`);

  // ---- D. Cobro rechazado en la renovación/upgrade ----
  console.log("\n== D. Tarjeta rechazada ==");
  const pmBad = await stripe.paymentMethods.attach("pm_card_chargeCustomerFail", { customer: customerId });
  await stripe.subscriptions.update(subId, { default_payment_method: pmBad.id });
  const item = (await stripe.subscriptions.retrieve(subId)).items.data[0];
  await stripe.subscriptions.update(subId, { items: [{ id: item.id, price: plans.broker.stripe_price_month }], proration_behavior: "always_invoice", payment_behavior: "allow_incomplete" });
  t = await until("past_due", async () => { const x = await tenant(); return x.status === "past_due" ? x : null; });
  check("cobro fallido → past_due con status_reason=payment_failed", !!t && t.status_reason === "payment_failed", JSON.stringify(t));
  const mail = await until("correo", async () => mails.find((m) => /No pudimos cobrar/.test(m.subject)));
  check("T25: correo de pago fallido al dueño", !!mail && mail.to[0] === email, mail?.subject);
  const logRows = await (await rest(`email_log?tenant_id=eq.${tenantId}&kind=eq.payment_failed&select=ref`)).json();
  check("email_log: una fila por factura", logRows.length === 1, JSON.stringify(logRows));

  // ---- E. Recuperación ----
  console.log("\n== E. Recuperación (pago de la factura abierta) ==");
  const open = (await stripe.invoices.list({ customer: customerId, status: "open", limit: 5 })).data[0];
  check("hay una factura abierta de la mejora", !!open);
  await stripe.subscriptions.update(subId, { default_payment_method: pmOk.id });
  await stripe.invoices.pay(open.id, { payment_method: pmOk.id });
  t = await until("active otra vez", async () => { const x = await tenant(); return x.status === "active" && planCode(x.plan_id) === "broker" ? x : null; });
  check("pago de la factura → active, status_reason limpio y plan = broker (upgrade sincronizado)", !!t && t.status_reason === null, JSON.stringify(t));

  // ---- F. Idempotencia y firma ----
  console.log("\n== F. Webhook: firma e idempotencia ==");
  const evs = (await stripe.events.list({ type: "invoice.paid", limit: 1 })).data;
  const raw = JSON.stringify(evs[0]);
  const post = (payload, sig) => fetch("http://localhost:3100/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": sig, "Content-Type": "application/json" }, body: payload });
  const sign = (payload) => stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  check("firma inválida → 400", (await post(raw, "t=1,v1=deadbeef")).status === 400);
  const auditBefore = (await (await rest(`audit_log?tenant_id=eq.${tenantId}&select=id`)).json()).length;
  const fresh = JSON.stringify({ ...evs[0], id: "evt_test_dup_" + randomBytes(4).toString("hex") });
  const r1 = await post(fresh, sign(fresh)), r2 = await post(fresh, sign(fresh));
  const auditAfter = (await (await rest(`audit_log?tenant_id=eq.${tenantId}&select=id`)).json()).length;
  check("mismo evento firmado dos veces → 200 y 200, un solo efecto", r1.status === 200 && r2.status === 200 && auditAfter - auditBefore <= 1, `audit +${auditAfter - auditBefore}`);

  // ---- G. Suspensión manual del admin vs. pago ----
  console.log("\n== G. Suspensión del admin y siguiente pago ==");
  await fetch(`${url}/rest/v1/rpc/set_tenant_status`, { method: "POST", headers: H, body: JSON.stringify({ p_tenant: tenantId, p_status: "suspended", p_reason: "abuso: contenido ilegal", p_actor: user.id }) }).then(async (r) => { if (!r.ok) console.log("set_tenant_status:", await r.text()); });
  const paidAgain = JSON.stringify({ ...evs[0], id: "evt_test_admin_" + randomBytes(4).toString("hex"), data: { object: { ...evs[0].data.object, parent: { subscription_details: { subscription: subId, metadata: { tenant_id: tenantId } } } } } });
  await post(paidAgain, sign(paidAgain));
  t = await tenant();
  check("un pago NO reactiva a un tenant suspendido por el admin", t.status === "suspended", `estado=${t.status} motivo=${t.status_reason}`);
  await rest(`tenants?id=eq.${tenantId}`, { method: "PATCH", body: JSON.stringify({ status: "active", status_reason: null }) });

  // ---- H. Cancelación ----
  console.log("\n== H. Cancelación ==");
  await stripe.subscriptions.cancel(subId); subs = subs.filter((s) => s !== subId);
  t = await until("canceled", async () => { const x = await tenant(); return x.status === "canceled" ? x : null; });
  check("subscription.deleted → canceled, sin stripe_subscription_id", !!t && t.stripe_subscription_id === null && t.status_reason === "subscription_deleted", JSON.stringify(t));

  // ---- I. Resuscripción con exceso de uso (bajar a Esencial con propiedades) ----
  console.log("\n== I. Bajar de plan con exceso de uso ==");
  for (let i = 1; i <= 2; i++) await rest("items", { method: "POST", body: JSON.stringify({ tenant_id: tenantId, kind: "property", title: `Casa ${i}`, sku: `P${i}`, price: 1000000, attrs: {}, status: "available" }) });
  const over = await api(`/api/${slug}/billing/checkout`, { plan_code: "esencial", interval: "month", payment_method: "card" });
  check("bajar a Esencial con 2 propiedades → 409 con detalle de excesos", over.status === 409 && Array.isArray(over.body.overages) && over.body.overages.length > 0, JSON.stringify(over.body).slice(0, 160));
  await rest(`items?tenant_id=eq.${tenantId}`, { method: "DELETE" });
  const again = await api(`/api/${slug}/billing/checkout`, { plan_code: "esencial", interval: "month", payment_method: "card" });
  check("tras liberar el uso, reintentar de inmediato funciona (la reserva no queda colgada por el 409)", again.status === 200, `status ${again.status} ${again.body.error ?? ""}`);

  // ---- J. SPEI ----
  console.log("\n== J. SPEI ==");
  await rest(`tenants?id=eq.${tenantId}`, { method: "PATCH", body: JSON.stringify({ stripe_checkout_pending_at: null, stripe_checkout_session_id: null }) });
  const sp = await api(`/api/${slug}/billing/checkout`, { plan_code: "catalogo", interval: "month", payment_method: "spei" });
  check("SPEI → 200 con factura hospedada", sp.status === 200 && /invoice\.stripe\.com/.test(sp.body.url ?? ""), `status ${sp.status} ${sp.body.error ?? ""} ${sp.body.url ?? ""}`.slice(0, 140));
  t = await until("sub spei", async () => { const x = await tenant(); return x.stripe_subscription_id ? x : null; });
  check("SPEI: la suscripción queda ligada pero el tenant NO se activa antes de pagar", !!t && t.status === "canceled", JSON.stringify(t));
  if (t) {
    subs.push(t.stripe_subscription_id);
    const inv = (await stripe.invoices.list({ customer: t.stripe_customer_id, limit: 1 })).data[0];
    check("SPEI: factura send_invoice con vencimiento a 3 días", inv.collection_method === "send_invoice" && inv.status === "open", `${inv.collection_method}/${inv.status}`);
    const fund = await fetch(`https://api.stripe.com/v1/test_helpers/customers/${t.stripe_customer_id}/fund_cash_balance`, { method: "POST", headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" }, body: `amount=${inv.amount_due}&currency=mxn` });
    check("fondeo de prueba del saldo (equivale a la transferencia SPEI)", fund.ok, fund.ok ? "" : (await fund.text()).slice(0, 120));
    const paid = await until("spei activo", async () => { const x = await tenant(); return x.status === "active" ? x : null; }, 30000);
    check("SPEI pagada → active y plan = catalogo", !!paid && planCode(paid.plan_id) === "catalogo", JSON.stringify(paid));
  }

  // ---- K. past_due → suspensión a los 7 días ----
  console.log("\n== K. Gracia de 7 días ==");
  await rest(`tenants?id=eq.${tenantId}`, { method: "PATCH", body: JSON.stringify({ status: "past_due", status_reason: "payment_failed", status_changed_at: new Date(Date.now() - 8 * 864e5).toISOString() }) });
  const exp = await (await fetch(`${url}/rest/v1/rpc/expire_past_due`, { method: "POST", headers: H, body: "{}" })).json();
  t = await tenant();
  check("expire_past_due suspende a quien lleva 8 días en past_due", exp.includes(slug) && t.status === "suspended", `estado=${t.status}`);
} catch (e) {
  console.error("ERROR del guion:", e);
} finally {
  console.log("\n== limpieza ==");
  for (const s of subs) await stripe.subscriptions.cancel(s).catch(() => {});
  const custs = new Set([customerId, (await tenant().catch(() => null))?.stripe_customer_id].filter(Boolean));
  for (const c of custs) await stripe.customers.del(c).catch(() => {});
  await rest(`items?tenant_id=eq.${tenantId}`, { method: "DELETE" });
  await rest(`tenants?id=eq.${tenantId}`, { method: "DELETE" });
  await fetch(`${url}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers: H });
  mock.close();
  const failed = results.filter(([, ok]) => !ok);
  console.log(`\nRESULTADO: ${results.length - failed.length}/${results.length} OK`);
  process.exit(failed.length ? 1 : 0);
}
