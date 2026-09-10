import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractPdfText } from "@/lib/drive";
import { truncate } from "@/lib/text";

// The browser already downloaded these bytes from Drive using its own
// short-lived drive.file token (see components/DriveAttachButton.tsx) — this
// route never talks to Google, it just parses bytes the user already fetched.
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_EXTRACTED_CHARS = 50_000;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File is too large" }, { status: 413 });
  }

  const arrayBuffer = await req.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File is too large" }, { status: 413 });
  }

  try {
    const text = await extractPdfText(Buffer.from(arrayBuffer));
    return NextResponse.json({ text: truncate(text, MAX_EXTRACTED_CHARS) });
  } catch (err) {
    console.error("PDF extraction failed:", err);
    return NextResponse.json({ error: "Could not read that PDF" }, { status: 400 });
  }
}
