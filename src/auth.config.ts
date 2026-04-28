import type { NextAuthConfig } from "next-auth";

// Edge-safe NextAuth yapılandırması. Gerçek Credentials provider (bcrypt + Prisma)
// `src/auth.ts` içinde override ediliyor; burası yalnızca middleware için gereken
// callback'leri ve sayfa eşlemelerini tanımlar. Edge runtime'da Prisma/bcryptjs
// çalışmaz, bu nedenle providers listesi bilinçli olarak boş bırakıldı.

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = (auth?.user as { role?: "ADMIN" | "TEAM" | "CLIENT" } | undefined)?.role;
      const path = nextUrl.pathname;

      const isLoginPage = path === "/login" || path.startsWith("/login/");
      const isPortalPage = path === "/portal" || path.startsWith("/portal/");
      const isRoot = path === "/";

      const homeFor = (r?: string) => (r === "CLIENT" ? "/portal" : "/dashboard");

      // Kök dizin: rol bazlı yönlendirme
      if (isRoot) {
        if (!isLoggedIn) return Response.redirect(new URL("/login", nextUrl));
        return Response.redirect(new URL(homeFor(role), nextUrl));
      }

      // Login sayfası: zaten giriş yapmışsa ana sayfaya yönlendir
      if (isLoginPage) {
        return isLoggedIn ? Response.redirect(new URL(homeFor(role), nextUrl)) : true;
      }

      // Giriş yapmamış kullanıcı: login'e yönlendir
      if (!isLoggedIn) return false;

      // Rol bazlı bölge koruması
      // ADMIN/TEAM /portal adresine sadece imzalı önizleme token'ı ile girebilir.
      if (isPortalPage && role !== "CLIENT") {
        const hasPreview = nextUrl.searchParams.has("preview");
        if (!hasPreview) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
      }
      if (!isPortalPage && role === "CLIENT") {
        return Response.redirect(new URL("/portal", nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  providers: [],
};
