import "server-only";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { encryptOptionalToken } from "@/lib/tokenCrypto";

// Do not widen without updating the OAuth consent screen. Every scope here must
// back a shipped feature, and every one is read-only:
// - classroom.profile.emails / .photos: Teacher.email / photoUrl on the
//   professors page and the email writer's recipient list.
//
// Two restricted scopes are deliberately NOT requested, because a restricted
// scope widens what a breach of this app costs its users:
// - No Drive scope. The solver and quiz generator read Drive attachments
//   through a client-side Picker flow that mints a drive.file token for the
//   one file the user picked (components/DriveAttachButton.tsx), so the server
//   never holds a credential that can read a user's Drive.
// - No Gmail scope. The email writer generates text and hands it to Gmail's
//   compose URL for the user to send; the app cannot read, write, or send
//   mail on anyone's behalf.
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.announcements.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
  "https://www.googleapis.com/auth/classroom.profile.emails",
  "https://www.googleapis.com/auth/classroom.profile.photos",
].join(" ");

export const authOptions: NextAuthOptions = {
  // Stated explicitly rather than inherited: sessions expire, they don't live
  // forever. NextAuth's cookie is httpOnly + sameSite=lax by default and gains
  // the __Secure- prefix (secure: true) automatically when NEXTAUTH_URL is
  // https, which it must be in production.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  // Our sign-in UI lives at "/" (see app/page.tsx) — route both the sign-in
  // entry point and OAuth failures back there instead of NextAuth's default
  // built-in pages, so a cancelled/failed Google login lands on our own
  // error state rather than an unstyled NextAuth screen.
  pages: {
    signIn: "/",
    error: "/",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: SCOPES,
          // Forces Google to return a refresh_token so we can call the
          // Classroom API on the user's behalf outside the login flow.
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile?.email) {
        const user = await prisma.user.upsert({
          where: { email: profile.email },
          update: {
            name: profile.name ?? undefined,
            image: (profile as { picture?: string }).picture ?? undefined,
            accessToken: encryptOptionalToken(account.access_token),
            refreshToken: encryptOptionalToken(account.refresh_token),
          },
          create: {
            email: profile.email,
            name: profile.name ?? null,
            image: (profile as { picture?: string }).picture ?? null,
            accessToken: encryptOptionalToken(account.access_token) ?? null,
            refreshToken: encryptOptionalToken(account.refresh_token) ?? null,
          },
        });
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId;
      }
      return session;
    },
  },
};
