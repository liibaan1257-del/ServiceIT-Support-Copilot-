import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { ADMIN_HOME, LOGIN_PATH } from "@/lib/auth/redirect";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Keeps the Supabase session fresh and redirects signed-out visitors away from
 * /admin. A UX layer only: the admin layout re-checks the user and their role
 * on the server (lib/auth/session.ts).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");

  if (!isSupabaseConfigured()) return NextResponse.next();

  let session: Awaited<ReturnType<typeof updateSession>>;
  try {
    session = await updateSession(request);
  } catch (error) {
    console.error(JSON.stringify({ level: "error", message: "session_refresh_failed", error: String(error) }));
    return NextResponse.next();
  }

  if (isAdminPath && !session.isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return withCookies(NextResponse.redirect(url), session.response);
  }

  if (pathname === LOGIN_PATH && session.isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = ADMIN_HOME;
    url.search = "";
    return withCookies(NextResponse.redirect(url), session.response);
  }

  return session.response;
}

function withCookies(redirect: NextResponse, from: NextResponse) {
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  redirect.headers.set("Cache-Control", "private, no-store");
  return redirect;
}

export const config = {
  // Pages only: skip API routes (they use API keys), static files and images.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
