import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

// Do not widen without updating the OAuth consent screen. Every scope here must
// back a shipped feature (Phase 6.5 audit):
// - classroom.profile.emails / .photos: Teacher.email / photoUrl on the
//   professors page and the email drafter's recipient list.
// - gmail.compose: /api/email/draft saves drafts only, never sends.
// No Drive scope is requested — the solver/quiz generator read Drive
// attachments via a client-side Google Picker flow scoped to drive.file on
// demand instead (see components/DriveAttachButton.tsx), which avoids the
// restricted drive.readonly scope entirely.
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
  "https://www.googleapis.com/auth/gmail.compose",
].join(" ");

export const authOptions: NextAuthOptions = {
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
            accessToken: account.access_token ?? undefined,
            refreshToken: account.refresh_token ?? undefined,
          },
          create: {
            email: profile.email,
            name: profile.name ?? null,
            image: (profile as { picture?: string }).picture ?? null,
            accessToken: account.access_token ?? null,
            refreshToken: account.refresh_token ?? null,
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
