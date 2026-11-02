import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createServerClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            // Rebuild response so cookies are set on it
            const newResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              newResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Rebuild response with session cookies baked in
      const finalResponse = NextResponse.redirect(`${origin}${next}`);
      // Copy all cookies from request (which now has the session) to final response
      for (const cookie of request.cookies.getAll()) {
        finalResponse.cookies.set(cookie.name, cookie.value, cookie);
      }
      return finalResponse;
    }
  }

  // Error — redirect back to login
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
