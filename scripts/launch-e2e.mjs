/**
 * QA de lanzamiento (T34): recorre de punta a punta lo que vive un cliente nuevo, contra la base real y
 * Stripe en MODO PRUEBA, con negocios temporales que se borran al final.
 *
 *   Web de marketing y demos → registro (validaciones + alta con el enlace de confirmación) → bienvenida
 *   → catálogo y vitrina pública → cotizar (móvil) → página pública y PDF → equipo bloqueado en prueba
 *   → pago (Checkout + tarjeta de prueba por API) → equipo habilitado → prueba vencida → suspensión →
 *   pago → reactivación.
 *
 * Levanta solo `next dev` en :3199 (con un Resend falso en :4555) y `stripe listen`; mata ambos al terminar.
 * Requisitos: `.env.local` con llaves de PRUEBA (sk_test_), Stripe CLI instalado, ningún otro `next dev`
 * corriendo en este repo y un Chromium (`CHROMIUM_PATH`, o `npx playwright-core install chromium`).
 * No teclea tarjetas en el Checkout hospedado: el pago se simula por API con `pm_card_visa`.
 *
 *   npm run e2e:launch
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const Stripe = require("stripe");
const { createServerClient } = require("@supabase/ssr");

if (!String(process.env.STRIPE_SECRET_KEY).startsWith("sk_test_")) {
  console.error("Solo corre con una llave de prueba (sk_test_...).");
  process.exit(2);
}
const PORT = 3199;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const rest = (p, init = {}) => fetch(`${url}/rest/v1/${p}`, { ...init, headers: { ...H, Prefer: "return=representation", ...(init.headers ?? {}) } });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch {} await sleep(300); } return null; };
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "✔" : "✘ FALLA"} ${name}${extra ? " — " + extra : ""}`); };
const step = (title) => console.log(`\n== ${title} ==`);

// ---------------------------------------------------------------- infraestructura
const mails = [];
const mock = createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { mails.push(JSON.parse(b)); res.end("{}"); }); });
await new Promise((r) => mock.listen(4555, r));
const children = [];
const run = (cmd, args, env = {}) => { const c = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: "ignore" }); children.push(c); return c; };
run("npm", ["run", "dev", "--", "-p", String(PORT)], { RESEND_API_KEY: "test", RESEND_API_URL: "http://localhost:4555/emails" });
run("stripe", ["listen", "--events", "checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.finalized,invoice.paid,invoice.payment_failed,invoice.overdue", "--forward-to", `localhost:${PORT}/api/stripe/webhook`, "--api-key", process.env.STRIPE_SECRET_KEY]);
const ready = await until(async () => (await fetch(`http://localhost:${PORT}/api/health`)).ok, 90000);
if (!ready) { console.error("El servidor de desarrollo no arrancó."); children.forEach((c) => c.kill()); process.exit(2); }
await sleep(4000); // stripe listen necesita unos segundos para armarse

const exe = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const ROOT = `http://localhost:${PORT}`;
const at = (slug, path = "") => `http://${slug}.localhost:${PORT}${path}`;
const tag = randomBytes(2).toString("hex");
const pw = randomBytes(12).toString("hex") + "Aa1";
const made = { tenants: [], customers: [], subs: [] };
const work = mkdtempSync(join(tmpdir(), "launch-e2e-"));

async function sessionCookies(email) {
  const jar = [];
  const sb = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [], setAll: (l) => l.forEach((c) => jar.push(c)) } });
  const { error } = await sb.auth.signInWithPassword({ email, password: pw });
  if (error) throw error;
  return jar;
}
async function owner(email, slug, viewport = { width: 1100, height: 900 }) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  await ctx.route(/wa\.me|whatsapp\.com/, (r) => r.fulfill({ status: 200, body: "wa" }));
  await ctx.addCookies((await sessionCookies(email)).map((c) => ({ name: c.name, value: c.value, domain: `${slug}.localhost`, path: "/", httpOnly: false, secure: false, sameSite: "Lax" })));
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && !/status of (400|401|403|404|409|429|503)|Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 140)));
  return { ctx, page, errors };
}
async function mkOwnerTenant(slug, plan, status = "trialing") {
  const email = `${slug}@ayxco.test`;
  const u = await (await fetch(`${url}/auth/v1/admin/users`, { method: "POST", headers: H, body: JSON.stringify({ email, password: pw, email_confirm: true }) })).json();
  const r = await fetch(`${url}/rest/v1/rpc/provision_tenant`, { method: "POST", headers: H, body: JSON.stringify({ p_owner: u.id, p_name: `Negocio ${slug}`, p_slug: slug, p_plan_code: plan, p_status: status, p_trial_days: 7, p_source: "self_signup" }) });
  if (!r.ok) throw new Error(await r.text());
  const id = await r.json(); made.tenants.push(id);
  return { email, id };
}
const tenantRow = async (id) => (await (await rest(`tenants?id=eq.${id}&select=status,status_reason,plan_id,stripe_customer_id,stripe_subscription_id,trial_ends_at,brand_color,whatsapp`)).json())[0];
const plans = Object.fromEntries((await (await rest("plans?select=id,code,stripe_price_month")).json()).map((p) => [p.code, p]));
const planCode = (id) => Object.values(plans).find((p) => p.id === id)?.code;

async function pay(tenantId, email, planPrice) {
  // Simula completar el Checkout con 4242: cliente + tarjeta de prueba + suscripción con el mismo tenant_id.
  const t = await tenantRow(tenantId);
  const customer = t.stripe_customer_id ? { id: t.stripe_customer_id } : await stripe.customers.create({ email, metadata: { tenant_id: tenantId } });
  made.customers.push(customer.id);
  const pm = await stripe.paymentMethods.attach("pm_card_visa", { customer: customer.id });
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } });
  const sub = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: planPrice }], metadata: { tenant_id: tenantId } });
  made.subs.push(sub.id);
  return sub;
}

try {
  // ============================================================ 1. Web de marketing
  step("1. Web pública (escritorio y móvil)");
  for (const [vp, label] of [[{ width: 1280, height: 900 }, "escritorio"], [{ width: 390, height: 844 }, "móvil"]]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const errs = [];
    page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errs.push(m.text().slice(0, 120)));
    const bad = [];
    for (const path of ["/", "/precios", "/servicios", "/catalogo", "/brokers", "/ayuda", "/legal/terminos", "/legal/privacidad", "/registro", "/login"]) {
      const res = await page.goto(`${ROOT}${path}`, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (!res?.ok() || overflow) bad.push(`${path}${res?.ok() ? " (scroll horizontal)" : ` (${res?.status()})`}`);
    }
    check(`${label}: 10 páginas públicas cargan sin scroll horizontal`, bad.length === 0, bad.join(", "));
    check(`${label}: sin errores de consola`, errs.length === 0, errs[0] ?? "");
    await ctx.close();
  }
  check("/opengraph-image y /api/health responden", (await fetch(`${ROOT}/opengraph-image`)).ok && (await (await fetch(`${ROOT}/api/health`)).json()).ok !== false);
  check("el cron diario exige su secreto (401 sin él)", (await fetch(`${ROOT}/api/cron/daily`)).status === 401);

  // ============================================================ 2. Demos
  step("2. Demos");
  const expect = { "demo-broker": 200, "demo-esencial": 200, "demo-catalogo": 200, "demo-brokerpro": 200, "demo-prueba": 200, "demo-morosa": 200 };
  const demoRes = {};
  const dctx = await browser.newContext();
  const dpage = await dctx.newPage();
  for (const [slug, status] of Object.entries(expect)) { let r = await dpage.goto(at(slug), { waitUntil: "networkidle" }); if (r?.status() !== status) r = await dpage.goto(at(slug), { waitUntil: "networkidle" }); // el primer acceso en frío de `next dev` puede dar un 404 transitorio
    demoRes[slug] = r?.status() === status && !/Tenant no encontrado|Aún no hay nada/.test(await dpage.locator("body").innerText()); }
  check("6 demos operables muestran su vitrina", Object.values(demoRes).every(Boolean), Object.entries(demoRes).filter(([, ok]) => !ok).map(([s]) => s).join(","));
  await dpage.goto(at("demo-suspendida"), { waitUntil: "networkidle" });
  check("demo-suspendida redirige a /suspended", dpage.url().includes("/suspended"), dpage.url());
  check("demo-cancelada responde 404", (await dpage.goto(at("demo-cancelada")))?.status() === 404);
  await dctx.close();

  // ============================================================ 3. Registro
  step("3. Registro");
  const rctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const rp = await rctx.newPage();
  await rp.goto(`${ROOT}/registro`, { waitUntil: "networkidle" });
  await rp.getByLabel("Nombre de tu negocio").fill("Plomería QA");
  await rp.locator("#giro").selectOption({ index: 1 });
  const slugInput = rp.locator("#slug, input[name=slug]").first();
  await slugInput.fill("demo-broker");
  await rp.getByLabel("Tu nombre").fill("Ana QA");
  await rp.getByLabel("Correo").fill("ana@mailinator.com");
  await rp.getByLabel(/Contraseña/).fill(pw);
  await rp.getByRole("button", { name: /Crear|Empezar|Registr/ }).click();
  await rp.waitForTimeout(1500);
  const txt = await rp.locator("body").innerText();
  check("un subdominio ocupado o un correo desechable no pasan el formulario", /no está disponible|desechable|temporal|bloquead/i.test(txt), txt.match(/(no está disponible|desechable|temporal|bloquead)[^.]*/i)?.[0] ?? "");
  await rctx.close();

  // Alta real: el enlace de confirmación (el correo de Supabase no se manda en pruebas) provisiona el negocio.
  const slug = `zz-qa-${tag}`, email = `${slug}@ayxco.test`;
  const gen = await (await fetch(`${url}/auth/v1/admin/generate_link`, { method: "POST", headers: H, body: JSON.stringify({ type: "signup", email, password: pw, data: { full_name: "Ana QA", pending_tenant: { name: `Catálogo QA ${tag}`, slug, plan_code: "catalogo" } } }) })).json();
  const hashed = gen.hashed_token ?? gen.properties?.hashed_token;
  const cctx = await browser.newContext();
  const cp = await cctx.newPage();
  const redirected = cp.waitForRequest((r) => r.url().startsWith(at(slug, "/panel/bienvenida")), { timeout: 30000 }).then(() => true).catch(() => false);
  await cp.goto(`${ROOT}/auth/callback?token_hash=${hashed}&type=signup`, { waitUntil: "commit" }).catch(() => {});
  check("el enlace de confirmación lleva a /panel/bienvenida del subdominio nuevo", await redirected);
  await cctx.close();
  const tenant = (await (await rest(`tenants?slug=eq.${slug}&select=id,status,plan_id,trial_ends_at,is_demo`)).json())[0];
  made.tenants.push(tenant.id);
  const days = Math.round((new Date(tenant.trial_ends_at) - Date.now()) / 864e5);
  check("negocio creado en prueba de 7 días con el plan Catálogo", tenant.status === "trialing" && planCode(tenant.plan_id) === "catalogo" && days >= 6 && days <= 7, `${tenant.status}/${planCode(tenant.plan_id)}/${days} d`);
  check("el dueño tiene membresía y las plantillas de mensaje de su plan", (await (await rest(`tenant_members?tenant_id=eq.${tenant.id}&select=role`)).json())[0]?.role === "owner" && (await (await rest(`message_templates?tenant_id=eq.${tenant.id}&select=module`)).json()).length === 2);
  check("T25: correo de bienvenida al dueño", !!(await until(() => mails.find((m) => m.to[0] === email && /Bienvenido/.test(m.subject)), 15000)));

  // ============================================================ 4. Panel, catálogo y vitrina
  step("4. Onboarding, catálogo y vitrina");
  const o = await owner(email, slug);
  await o.page.goto(at(slug, "/panel/bienvenida"), { waitUntil: "networkidle" });
  check("bienvenida con los 3 pasos de Catálogo", (await o.page.locator("section h2").allInnerTexts()).join("|").includes("Agrega tus productos o servicios"));
  const api = (page, method, path, body) => page.evaluate(async ({ method, path, body }) => { const r = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; }, { method, path, body });
  check("WhatsApp y color de marca se guardan", (await api(o.page, "PATCH", `/api/${slug}/contact`, { whatsapp: "5512345678" })).status === 200 && (await api(o.page, "PATCH", `/api/${slug}/branding`, { brandColor: "#2f5d8a" })).status === 200);
  await o.page.goto(at(slug, "/panel/catalogo"), { waitUntil: "networkidle" });
  const services = [["Instalación de calentador", "1850"], ["Revisión de fugas", "450"], ["Mantenimiento anual", "1200"]];
  let created = 0;
  for (const [name, price] of services) {
    if (created > 0) await o.page.getByRole("button", { name: "Nuevo ítem" }).click();
    await o.page.getByLabel("Nombre", { exact: true }).fill(name);
    if (await o.page.getByLabel("Tipo").count()) await o.page.getByLabel("Tipo").selectOption("service");
    await o.page.getByLabel(/Precio/).fill(price);
    await o.page.getByLabel(/Unidad/).fill("servicio");
    await o.page.getByRole("button", { name: "Crear ítem" }).click();
    await o.page.getByText("Fotos", { exact: true }).waitFor({ timeout: 10000 });
    await o.page.getByRole("button", { name: "Cerrar", exact: true }).first().click();
    created++;
  }
  check("3 servicios dados de alta desde el panel", (await (await rest(`items?tenant_id=eq.${tenant.id}&select=id`)).json()).length === 3);
  const vctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const vp = await vctx.newPage();
  await vp.goto(at(slug), { waitUntil: "networkidle" });
  const shop = await vp.locator("main").innerText();
  check("vitrina pública (móvil) muestra los 3 servicios y el WhatsApp del negocio", services.every(([n]) => shop.includes(n)) && (await vp.locator('a[href*="wa.me/5255"]').count()) > 0);
  await vp.getByRole("button", { name: /Agregar/ }).first().click();
  check("'Mi cotización' junta ítems sin guardar nada en la base", /1/.test(await vp.locator("body").innerText()) && (await (await rest(`quotes?tenant_id=eq.${tenant.id}&select=id`)).json()).length === 0);
  check("vitrina móvil sin scroll horizontal", !(await vp.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
  await vctx.close();

  // ============================================================ 5. Cotizar
  step("5. Cotizar (móvil) y cliente final");
  await o.ctx.close();
  const m = await owner(email, slug, { width: 390, height: 844 });
  await rest("clients", { method: "POST", body: JSON.stringify({ tenant_id: tenant.id, full_name: "Laura Hernández", phone: "5598765432" }) });
  await m.page.goto(at(slug, "/panel"), { waitUntil: "networkidle" });
  check("/panel lleva a Cotizar", m.page.url().endsWith("/panel/cotizar"), m.page.url().replace(at(slug), ""));
  await m.page.locator('input[placeholder*="liente"], input[aria-label*="liente"]').first().click();
  await m.page.locator('input[placeholder*="liente"], input[aria-label*="liente"]').first().fill("Laura");
  await m.page.getByText("Laura Hernández").first().click();
  const chips = m.page.getByRole("list", { name: "Catálogo" }).getByRole("button");
  await chips.filter({ hasText: "Instalación de calentador" }).click();
  await chips.filter({ hasText: "Revisión de fugas" }).click();
  await chips.filter({ hasText: "Revisión de fugas" }).click(); // qty 2
  await m.page.getByTestId("line").nth(0).getByLabel(/Descuento/).fill("10");
  const expectedTotal = Math.round((1850 * 0.9 + 450 * 2) * 1.16 * 100) / 100;
  const shown = (await m.page.getByTestId("grand-total").innerText()).replace(/[^0-9.]/g, "");
  check("total en vivo con descuento por línea e IVA 16 %", Math.abs(Number(shown) - expectedTotal) < 0.005, `${shown} vs ${expectedTotal}`);
  const waUrls = [];
  m.ctx.on("request", (r) => /wa\.me/.test(r.url()) && waUrls.push(r.url()));
  await m.page.getByRole("button", { name: "Enviar por WhatsApp" }).click();
  await m.page.getByText(/Enviada por/).waitFor({ timeout: 15000 });
  const q = (await (await rest(`quotes?tenant_id=eq.${tenant.id}&select=number,total_amount,share_token,status,snapshot`)).json())[0];
  check("cotización guardada con el total del servidor y folio 1", q && Math.abs(Number(q.total_amount) - expectedTotal) < 0.005 && q.number === 1 && q.snapshot.kind === "services");
  await until(() => waUrls.length > 0, 8000);
  check("se abre WhatsApp al número del cliente con el enlace /q/", waUrls.some((u) => u.includes("wa.me/525598765432") && decodeURIComponent(u).includes(`/q/${q.share_token}`)), waUrls[0]?.slice(0, 60) ?? "sin petición");
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const pp = await pctx.newPage();
  await pp.goto(at(slug, `/q/${q.share_token}`), { waitUntil: "networkidle" });
  const pubTotal = (await pp.locator("article[aria-label=Cotización] p:has-text('Total')").first().innerText()).replace(/[^0-9.]/g, "");
  check("página pública (cliente final, móvil) con el mismo total", Math.abs(Number(pubTotal) - expectedTotal) < 0.005, pubTotal);
  const [dl] = await Promise.all([pp.waitForEvent("download", { timeout: 60000 }), pp.getByRole("button", { name: /Descargar PDF/ }).click()]);
  const pdfPath = join(work, "cotizacion.pdf"); await dl.saveAs(pdfPath);
  const pdf = readFileSync(pdfPath);
  check("el PDF descargado es un PDF real", pdf.subarray(0, 5).toString() === "%PDF-" && pdf.subarray(-16).toString().includes("%%EOF") && pdf.length > 1500, `${pdf.length} bytes`);
  check("la vista cuenta como vista", (await (await rest(`quotes?tenant_id=eq.${tenant.id}&select=views,status`)).json())[0].views >= 1);
  await pctx.close();

  // ============================================================ 6. Equipo en prueba
  step("6. Equipo durante la prueba");
  const team = await api(m.page, "POST", `/api/${slug}/team`, { email: `${slug}-vendedor@ayxco.test`, role: "viewer" });
  check("en prueba no se puede invitar (el equipo es solo el dueño)", team.status === 409, team.body.error);

  // ============================================================ 7. Pago
  step("7. Pago");
  await m.ctx.close();
  const b = await owner(email, slug);
  await b.page.goto(at(slug, "/panel/facturacion"), { waitUntil: "networkidle" });
  check("Facturación muestra los planes y la prueba", /Catálogo|Esencial|Broker/.test(await b.page.locator("main").innerText()));
  const ck = await api(b.page, "POST", `/api/${slug}/billing/checkout`, { plan_code: "catalogo", interval: "month", payment_method: "card" });
  check("Checkout con tarjeta crea la sesión de Stripe", ck.status === 200 && /checkout\.stripe\.com/.test(ck.body.url ?? ""), ck.body.error ?? "");
  const sub = await pay(tenant.id, email, plans.catalogo.stripe_price_month);
  const active = await until(async () => { const t = await tenantRow(tenant.id); return t.status === "active" && t.stripe_subscription_id === sub.id ? t : null; });
  check("tras el pago (tarjeta 4242) el negocio queda activo en el plan Catálogo", !!active && planCode(active.plan_id) === "catalogo");
  await b.page.reload({ waitUntil: "networkidle" });
  check("Facturación ya no ofrece pagar otra vez (hay suscripción)", (await api(b.page, "POST", `/api/${slug}/billing/checkout`, { plan_code: "broker", interval: "month", payment_method: "card" })).status === 409);
  check("el portal de facturación abre", /billing\.stripe\.com/.test((await api(b.page, "POST", `/api/${slug}/billing/portal`)).body.url ?? ""));
  const invite = await api(b.page, "POST", `/api/${slug}/team`, { email: `${slug}-vendedor@ayxco.test`, role: "viewer" });
  check("ya pagado: el equipo admite 2 personas y sale la invitación por correo", invite.status === 200 && !!(await until(() => mails.find((x) => /invitaron/i.test(x.subject)), 10000)), invite.body.error ?? "");
  await b.ctx.close();

  // ============================================================ 8. Prueba vencida → suspensión → pago → reactivación
  step("8. Prueba vencida, suspensión y reactivación");
  const slug2 = `zz-qa2-${tag}`;
  const t2 = await mkOwnerTenant(slug2, "esencial");
  await rest(`tenants?id=eq.${t2.id}`, { method: "PATCH", body: JSON.stringify({ trial_ends_at: new Date(Date.now() - 3600_000).toISOString() }) });
  const expired = await (await fetch(`${url}/rest/v1/rpc/expire_trials`, { method: "POST", headers: H, body: "{}" })).json();
  const st = await tenantRow(t2.id);
  check("expire_trials suspende la prueba vencida con motivo trial_expired", expired.includes(slug2) && st.status === "suspended" && st.status_reason === "trial_expired", `${st.status}/${st.status_reason}`);
  const sctx = await browser.newContext();
  const sp = await sctx.newPage();
  await sp.goto(at(slug2), { waitUntil: "networkidle" });
  check("su vitrina pública ya no se ve (va a /suspended)", sp.url().includes("/suspended"), sp.url());
  await sctx.close();
  const s = await owner(t2.email, slug2);
  const billing = await s.page.goto(at(slug2, "/panel/facturacion"), { waitUntil: "networkidle" });
  check("suspendido sí puede entrar a Facturación para pagar", billing?.status() === 200 && /\/panel\/facturacion/.test(s.page.url()));
  check("suspendido no puede cotizar ni editar (la API lo rechaza)", (await api(s.page, "POST", `/api/${slug2}/quotes/services`, { clientId: "x", lines: [] })).status >= 400);
  const ck2 = await api(s.page, "POST", `/api/${slug2}/billing/checkout`, { plan_code: "esencial", interval: "month", payment_method: "card" });
  check("puede iniciar el pago para reactivarse", ck2.status === 200, ck2.body.error ?? "");
  await pay(t2.id, t2.email, plans.esencial.stripe_price_month);
  const back = await until(async () => { const t = await tenantRow(t2.id); return t.status === "active" ? t : null; });
  check("el pago reactiva la cuenta suspendida por prueba vencida", !!back && back.status_reason === null);
  const sctx2 = await browser.newContext();
  const sp2 = await sctx2.newPage();
  const again = await sp2.goto(at(slug2), { waitUntil: "networkidle" });
  check("y su vitrina vuelve a verse", again?.status() === 200 && !sp2.url().includes("/suspended"));
  await sctx2.close(); await s.ctx.close();
} catch (error) {
  console.error("ERROR del guion:", error);
  results.push(false);
} finally {
  step("Limpieza");
  for (const sId of made.subs) await stripe.subscriptions.cancel(sId).catch(() => {});
  for (const c of new Set(made.customers)) await stripe.customers.del(c).catch(() => {});
  for (const t of made.tenants) {
    for (const tb of ["tenant_invitations", "tenant_members", "email_log", "quotes", "clients", "media", "items"]) await rest(`${tb}?tenant_id=eq.${t}`, { method: "DELETE" });
    await rest(`tenants?id=eq.${t}`, { method: "DELETE" });
  }
  const list = await (await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers: H })).json();
  for (const u of list.users ?? []) if (u.email?.startsWith(`zz-qa-${tag}`) || u.email?.startsWith(`zz-qa2-${tag}`)) await fetch(`${url}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: H });
  await browser.close();
  mock.close();
  children.forEach((c) => c.kill());
  const failed = results.filter((ok) => !ok).length;
  console.log(`\nRESULTADO ${results.length - failed}/${results.length}${failed ? " — hay fallas" : ""}`);
  process.exit(failed ? 1 : 0);
}
