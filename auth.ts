import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [Google({ authorization: { params: { scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly", access_type: "offline", prompt: "consent" } } })],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile?.email) {
        token.id = profile.sub; token.accessToken = account.access_token; token.refreshToken = account.refresh_token; token.expiresAt = account.expires_at;
        await db.query(`INSERT INTO coaches(id,email,name,image,google_access_token,google_refresh_token,token_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(email) DO UPDATE SET name=$3,image=$4,google_access_token=$5,google_refresh_token=COALESCE($6,coaches.google_refresh_token),token_expires_at=$7`, [profile.sub, profile.email, profile.name, profile.picture, account.access_token, account.refresh_token, account.expires_at]);
      }
      return token;
    },
    session({ session, token }) { if (session.user) session.user.id = token.id as string; return session; }
  },
  pages: { signIn: "/" }
});
