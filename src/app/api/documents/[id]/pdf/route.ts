import { promises as fs } from "node:fs";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { generateStoredPdf } from "@/lib/pdf";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const document = await prisma.document.findFirst({
    where: {
      id,
      participants: { some: { userId: session.user.id } },
    },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: { signatures: true },
      },
    },
  });

  if (!document) {
    return Response.json({ error: "Document not found." }, { status: 404 });
  }

  const latest = document.versions[0];
  if (!latest || latest.signatures.length < 2) {
    return Response.json(
      { error: "Both parties must sign before a PDF is available." },
      { status: 409 },
    );
  }

  let bytes: Buffer;
  let filename: string;

  try {
    if (latest.pdfPath) {
      bytes = await fs.readFile(latest.pdfPath);
      filename = latest.pdfPath.split(/[\\/]/).pop() || "document.pdf";
    } else {
      const generated = await generateStoredPdf(document.id);
      bytes = generated.bytes;
      filename = generated.filename;
    }
  } catch {
    const generated = await generateStoredPdf(document.id);
    bytes = generated.bytes;
    filename = generated.filename;
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
