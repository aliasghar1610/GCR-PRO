import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { issueExtensionToken, revokeExtensionToken } from "@/lib/extensionAuth";

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const token = await issueExtensionToken(userId);
  return NextResponse.json({ token });
}

/** Revokes the outstanding extension token — "Disconnect extension". */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  await revokeExtensionToken(userId);
  return NextResponse.json({ ok: true });
}
