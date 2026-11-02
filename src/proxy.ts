import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEV_ACCOUNTS } from "@/lib/demo/devAccounts";
import { canAccessRoute } from "@/lib/permissions";
import type { UserRole } from "@/types";

function getDevBypassUser(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_DEV_BYPASS !== "true") return null;
  const cookie = request.cookies.get("dev-bypass-user");
  if (!cookie) return null;
  try {
    return JSON.parse(cookie.value);
  } catch {
    return null;
  }
}

/** Redirect unauthorized roles before the page starts streaming. */
function guardRestrictedRoute(request: NextRequest, role: UserRole | null) {
  const { pathname } = request.nextUrl;
  // canAccessRoute treats unknown paths as open, so a null role only fails on
  // routes that carry an explicit role rule.
  if (canAccessRoute(pathname, null) || canAccessRoute(pathname, role)) {
    return null;
  }
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const isCallback = request.nextUrl.pathname.startsWith("/auth/callback");
  const isApi = request.nextUrl.pathname.startsWith("/api");
  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/register");

  // TEMPORARY: Auto-enable dev bypass to skip login
  if (process.env.NEXT_PUBLIC_DEV_BYPASS === "true") {
    const devUser = getDevBypassUser(request);
    if (!devUser) {
      // Auto-set dev bypass cookie
      const mockUser = {
        id: "dev-user-000",
        email: "dev@agnisuite.com",
        full_name: "Dev User",
        role: "owner",
        org_id: "00000000-0000-0000-0000-000000000001",
      };
      supabaseResponse.cookies.set("dev-bypass-user", JSON.stringify(mockUser), {
        // Not httpOnly: Topbar reads this cookie via document.cookie to skip
        // the Supabase browser client. Mock user data only — no session secrets.
        httpOnly: false,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
      });
    }
    // Dev bypass — skip Supabase entirely
    if (isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // The dev-bypass cookie stores the role resolved from the local store, so
    // respect it first. Fall back to the static demo account (or owner for the
    // cookie the proxy just auto-created).
    const devRole: UserRole =
      (devUser?.role as UserRole | undefined) ??
      DEV_ACCOUNTS.find((account) => account.id === devUser?.id)?.role ??
      "owner";
    const restricted = guardRestrictedRoute(request, devRole);
    if (restricted) return restricted;

    return supabaseResponse;
  }

  // API routes and callbacks — let through
  if (isCallback || isApi) return supabaseResponse;

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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && !isAuthPage && !canAccessRoute(request.nextUrl.pathname, null)) {
    const { data: membership } = await supabase
      .from("org_users")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const restricted = guardRestrictedRoute(
      request,
      (membership?.role as UserRole | undefined) ?? null
    );
    if (restricted) return restricted;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
