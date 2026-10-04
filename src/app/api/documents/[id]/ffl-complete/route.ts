import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import type { FirearmPayload } from "@/lib/document-types";
import { generateStoredPdf } from "@/lib/pdf";
import { prisma } from "@/lib/prisma";

const completionSchema = z.object({
  dealerName: z.string().trim().min(2).max(200),
  dealerAddress: z.string().trim().min(2).max(250),
  dealerCity: z.string().trim().min(1).max(120),
  dealerState: z.string().trim().length(2),
  dealerZip: z.string().trim().min(5).max(12),
  dealerLicenseNumber: z.string().trim().max(80).optional().default(""),
  transferDate: z.string().min(1),
  notes: z.string().trim().max(3000).optional().default(""),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = completionSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Check the receiving FFL details." }, { status: 400 });
  }

  const document = await prisma.document.findFirst({
    where: {
      id,
      creatorId: session.user.id,
      status: "AWAITING_EXTERNAL_STEP",
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
    return Response.json(
      { error: "No pending interstate transfer was found." },
      { status: 404 },
    );
  }

  const latest = document.versions[0];
  const payload = (latest?.payload ?? {}) as FirearmPayload;

  if (
    !latest ||
    latest.signatures.length < 2 ||
    !payload.transaction?.interstate
  ) {
    return Response.json(
      { error: "The signed interstate agreement is not ready for completion." },
      { status: 409 },
    );
  }

  if (
    payload.transaction?.buyerState &&
    parsed.data.dealerState !== payload.transaction.buyerState
  ) {
    return Response.json(
      {
        error: "For this interstate workflow, the receiving FFL state must match the buyer state on the document.",
      },
      { status: 400 },
    );
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.document.update({
      where: { id: document.id },
      data: {
        status: "FINALIZED",
        externalCompletion: parsed.data,
        completedAt: now,
        finalizedAt: now,
      },
    }),
    prisma.auditEvent.create({
      data: {
        documentId: document.id,
        actorUserId: session.user.id,
        eventType: "EXTERNAL_FFL_TRANSFER_RECORDED",
        metadata: {
          dealerName: parsed.data.dealerName,
          dealerState: parsed.data.dealerState,
          transferDate: parsed.data.transferDate,
        },
      },
    }),
  ]);

  try {
    await generateStoredPdf(document.id);
  } catch {
    // Download endpoint can regenerate it later.
  }

  return Response.json({ ok: true, status: "FINALIZED" });
}
