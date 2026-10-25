import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const intl = createIntlMiddleware(routing);

// Pages that need a signed-in user (path without the locale prefix).
const PROTECTED = [
  /^\/dashboard/,
  /^\/onboarding/,
  /^\/settings/,
  /^\/calendar/,
  /^\/clients/,
  /^\/services/,
  /^\/staff/,
  /^\/more/,
  /^\/my-day/,
  /^\/cash/,
];

export async function proxy(request: NextRequest) {
  const response = intl(request);
  if (response.headers.has("location")) return response;

  // Refresh the Supabase session cookie on every page request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );
  const { data } = await supabase.auth.getClaims();

  // Optimistic redirect for page visits only. Server actions are POSTs to the
  // page URL; redirecting them returns a login page where the client expects
  // an action result. Actions check the session themselves (requireUser).
  const isPageVisit = request.method === "GET" || request.method === "HEAD";
  const [, locale, ...rest] = request.nextUrl.pathname.split("/");
  const path = `/${rest.join("/")}`;
  if (isPageVisit && !data?.claims && PROTECTED.some((re) => re.test(path))) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
