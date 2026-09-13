import { NextResponse } from "next/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSessionSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/admin/login", request.url));
}
