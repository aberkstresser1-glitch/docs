import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  partyDetailsComplete,
  type FirearmPayload,
  type PartyDetails,
} from "@/lib/document-types";

const partySchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  street: z.string().trim().min(2).max(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().length(2),
  zip: z.string().trim().min(5).max(12),
  phone: z.string().trim().max(40).optional().default(""),
  email: z.string().trim().email().max(200),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = partySchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Check your party information." }, { status: 400 });
  }

  const document = await prisma.document.findFirst({
    where: {
      id,
      participants: { some: { userId: session.user.id } },
    },
    include: {
      participants: true,
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

  const participant = document.participants.find(
    (item) => item.userId === session.user.id,
  );

  if (!participant || !["BUYER", "SELLER"].includes(participant.role)) {
    return Response.json({ error: "No editable party role found." }, { status: 403 });
  }

  const latest = document.versions[0];
  if (
    !latest ||
    latest.signatures.length > 0 ||
    latest.immutable ||
    ["FINALIZED", "VOID", "AWAITING_EXTERNAL_STEP"].includes(document.status)
  ) {
    return Response.json(
      { error: "The document is locked because signing has started." },
      { status: 409 },
    );
  }

  const previous = (latest.payload ?? {}) as FirearmPayload;
  const role = participant.role as "BUYER" | "SELLER";
  const details: PartyDetails = parsed.data;
  const parties = {
    ...(previous.parties ?? {}),
    [role]: details,
  };

  const nextPayload: FirearmPayload = {
    ...previous,
    parties,
  };

  const nextVersion = document.currentVersion + 1;

  const buyerComplete = partyDetailsComplete(parties.BUYER);
  const sellerComplete = partyDetailsComplete(parties.SELLER);
  const bothLinked = document.participants
    .filter((item) => ["BUYER", "SELLER"].includes(item.role))
    .every((item) => Boolean(item.userId));

  const nextStatus =
    bothLinked && buyerComplete && sellerComplete ? "READY_TO_SIGN" : "AWAITING_PARTIES";

  await prisma.$transaction([
    prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version: nextVersion,
        payload: nextPayload,
        createdById: session.user.id,
      },
    }),
    prisma.document.update({
      where: { id: document.id },
      data: {
        currentVersion: nextVersion,
        status: nextStatus,
      },
    }),
    prisma.documentParticipant.update({
      where: { id: participant.id },
      data: {
        displayName: details.fullName,
        email: details.email,
        completedAt: new Date(),
      },
    }),
    prisma.auditEvent.create({
      data: {
        documentId: document.id,
        actorUserId: session.user.id,
        eventType: "PARTY_DETAILS_UPDATED",
        metadata: { role, version: nextVersion },
      },
    }),
  ]);

  return Response.json({ ok: true, status: nextStatus, version: nextVersion });
}
