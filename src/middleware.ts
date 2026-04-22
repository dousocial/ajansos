import { NextResponse, type NextRequest } from "next/server";

// Demo mod — NextAuth tam kurulduktan sonra auth() middleware'e geçilecek
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rol bazlı koruma (ileride NextAuth token'dan rol okunacak)
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};
