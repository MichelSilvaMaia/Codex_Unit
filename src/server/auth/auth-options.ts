import type { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
};
