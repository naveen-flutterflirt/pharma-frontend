import { NextResponse, type NextRequest } from "next/server";

// Public paths that do not require authentication
const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("pharma_token")?.value;

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  // If user is already logged in and navigates to /login, redirect to Dashboard
  if (isPublicPath && token) {
    const redirectUrl = new URL("/", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // If user is not logged in and tries to access a protected route, redirect to /login
  if (!isPublicPath && !token) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, icons)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
