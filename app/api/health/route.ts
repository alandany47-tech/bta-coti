import { NextResponse } from "next/server";
import packageJson from "@/package.json";

export const runtime = "nodejs";

/** Monitor de uptime (docs/MONITORING.md §1): solo confirma que la app responde, sin tocar nada. */
export async function GET() {
  return NextResponse.json({ ok: true, version: packageJson.version });
}
