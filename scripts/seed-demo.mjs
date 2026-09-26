// Crea (o recrea) los tenants y usuarios de demo en el proyecto de Supabase enlazado.
//   node scripts/seed-demo.mjs               → aplica y muestra las credenciales
//   node scripts/seed-demo.mjs --rollback    → ejecuta todo y lo revierte (validación en seco)
//   DEMO_PASSWORD=... node scripts/seed-demo.mjs   → usa esa contraseña en vez de una aleatoria
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rollback = process.argv.includes("--rollback");
const password = process.env.DEMO_PASSWORD ?? randomBytes(9).toString("base64url");
if (!/^[A-Za-z0-9_.-]{10,}$/.test(password)) {
  throw new Error("DEMO_PASSWORD: mínimo 10 caracteres, solo letras, números, _ . -");
}

const root = fileURLToPath(new URL("..", import.meta.url));
let sql = readFileSync(join(root, "supabase/seed/demo.sql"), "utf8").replaceAll("__DEMO_PASSWORD__", password);
if (rollback) sql += "\ndo $$ begin raise exception 'ROLLBACK_OK'; end $$;\n";

const dir = mkdtempSync(join(tmpdir(), "seed-demo-"));
const file = join(dir, "demo.sql");
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
console.log(`Contraseña de todos los usuarios: ${password}\n`);
for (const tenant of accounts) {
  console.log(`${tenant.name}  [${tenant.plan} · ${tenant.status}]`);
  console.log(`  http://${tenant.slug}.localhost:3100  |  https://${tenant.slug}.${domain}`);
  for (const [role, email] of tenant.emails) console.log(`  ${role.padEnd(6)} ${email}`);
}
