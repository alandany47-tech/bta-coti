// Reset de los tenants y usuarios de demo (docs/DEMO.md §3): llama a `reset_demo_data` en la base
// (migración 0020), la misma función que usan el cron nocturno y el botón "Resetear demo" del
// admin. DEMO_PASSWORD debe ser la misma que usa la app en /demo/entrar (.env.local / Vercel).
//   node scripts/seed-demo.mjs               → aplica de verdad
//   node scripts/seed-demo.mjs --rollback    → corre todo y lo revierte, para validar sin dejar nada
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rollback = process.argv.includes("--rollback");
const password = process.env.DEMO_PASSWORD;
if (!password) {
  throw new Error(
    "Falta DEMO_PASSWORD en el entorno. Debe ser la misma contraseña que la app lee en /demo/entrar (ponla en .env.local y en Vercel).",
  );
}
if (!/^[A-Za-z0-9_.-]{10,}$/.test(password)) {
  throw new Error("DEMO_PASSWORD: mínimo 10 caracteres, solo letras, números, _ . -");
}

const root = fileURLToPath(new URL("..", import.meta.url));
let sql = `select public.reset_demo_data('${password}');\n`;
if (rollback) sql = `begin;\n${sql}do $$ begin raise exception 'ROLLBACK_OK'; end $$;\n`;

const dir = mkdtempSync(join(tmpdir(), "seed-demo-"));
const file = join(dir, "reset.sql");
writeFileSync(file, sql);
const run = spawnSync("supabase", ["db", "query", "--linked", "-f", file], { cwd: root, encoding: "utf8" });
rmSync(dir, { recursive: true, force: true });

const output = `${run.stdout}${run.stderr}`;
if (rollback ? !output.includes("ROLLBACK_OK") : run.status !== 0) {
  console.error(output.slice(-1500));
  process.exit(1);
}

const accounts = JSON.parse(readFileSync(join(root, "supabase/seed/demo-accounts.json"), "utf8"));
const domain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "ayx.solutions";
console.log(rollback ? "Validación en seco correcta (todo revertido).\n" : "Demo lista.\n");
for (const tenant of accounts) {
  console.log(`${tenant.name}  [${tenant.plan} · ${tenant.status}]`);
  console.log(`  http://${tenant.slug}.localhost:3100  |  https://${tenant.slug}.${domain}`);
  for (const [role, email] of tenant.emails) console.log(`  ${role.padEnd(6)} ${email}`);
}
