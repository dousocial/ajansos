import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          console.warn("[auth] Credentials schema reddetti");
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: parsed.data.email, deletedAt: null },
            select: { id: true, name: true, email: true, image: true, role: true, passwordHash: true },
          });

          if (!user || !user.passwordHash) {
            console.warn(`[auth] Kullanıcı bulunamadı veya passwordHash eksik: ${parsed.data.email}`);
            return null;
          }

          const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
          if (!valid) {
            console.warn(`[auth] Şifre eşleşmedi: ${parsed.data.email}`);
            return null;
          }

          return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role };
        } catch (e) {
          // Genelde DB erişilemez (ENOTFOUND, ECONNREFUSED, IPv6-only Supabase direct) veya
          // Prisma migration eksik olduğunda buraya düşer. Kullanıcıya "email/şifre hatalı"
          // göstermek yanıltıcı olur — ama NextAuth v5 authorize dönüşünü ayırt etmez,
          // bu yüzden en azından sunucu loguna temiz bir tanı bırakıyoruz.
          const msg = e instanceof Error ? e.message : String(e);
          console.error(
            "[auth] authorize sırasında DB/hash hatası — kullanıcıya 'hatalı giriş' dönüldü:",
            msg
          );
          return null;
        }
      },
    }),
  ],
});
