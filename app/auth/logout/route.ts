import { NextResponse } from "next/server";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { originFromHeaders } from "@/lib/auth/redirects";

export async function POST(request: Request) {
  const supabase = await createSessionSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", originFromHeaders(request.headers)), 303);
}
