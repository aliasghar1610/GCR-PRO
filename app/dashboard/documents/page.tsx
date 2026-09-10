import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DocumentsClient, type DocStatus } from "./DocumentsClient";

export default async function DocumentsPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const documents = await prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
      status: true,
      wordCount: true,
      pageCount: true,
      createdAt: true,
    },
  });

  return (
    <DocumentsClient
      initialDocuments={documents.map((d) => ({
        ...d,
        status: d.status as DocStatus,
        createdAt: d.createdAt.toISOString(),
      }))}
    />
  );
}
