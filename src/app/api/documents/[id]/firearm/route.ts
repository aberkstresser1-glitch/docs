import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  firearmDetailsComplete,
  partyDetailsComplete,
  type FirearmPayload,
} from "@/lib/document-types";
import { prisma } from "@/lib/prisma";

const firearmSchema = z.object({
  manufacturer: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  caliber: z.string().trim().min(1).max(60),
  firearmType: z.enum(["HANDGUN", "RIFLE", "SHOTGUN", "OTHER"]),
  serialNumber: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(4000).optional().default(""),
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
  const parsed = firearmSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Check the required firearm information." },
      { status: 400 },
    );
  }

  const document = await prisma.document.findFirst({
    where: {
      id,
      participants: {
        some: {
          userId: session.user.id,
          role: "SELLER",
        },
      },
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
    return Response.json(
      { error: "Only the Seller can edit firearm information." },
      { status: 403 },
    );
  }

  const latest = document.versions[0];
  if (
    !latest ||
    latest.signatures.length > 0 ||
    latest.immutable ||
    ["FINALIZED", "AWAITING_EXTERNAL_STEP", "VOID"].includes(document.status)
  ) {
    return Response.json(
      { error: "The firearm information is locked because signing has started." },
      { status: 409 },
    );
  }

  const previous = (latest.payload ?? {}) as FirearmPayload;
  const firearm = parsed.data;
  const nextPayload: FirearmPayload = {
    ...previous,
    firearm,
  };
  const nextVersion = document.currentVersion + 1;

  const buyerComplete = partyDetailsComplete(previous.parties?.BUYER);
  const sellerComplete = partyDetailsComplete(previous.parties?.SELLER);
  const bothLinked = document.participants
    .filter((item) => ["BUYER", "SELLER"].includes(item.role))
    .every((item) => Boolean(item.userId));

  const nextStatus =
    bothLinked &&
    buyerComplete &&
    sellerComplete &&
    firearmDetailsComplete(firearm)
      ? "READY_TO_SIGN"
      : "AWAITING_PARTIES";

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
        title: `${firearm.manufacturer} ${firearm.model} Bill of Sale`,
        currentVersion: nextVersion,
        status: nextStatus,
      },
    }),
    prisma.auditEvent.create({
      data: {
        documentId: document.id,
        actorUserId: session.user.id,
        eventType: "SELLER_FIREARM_DETAILS_UPDATED",
        metadata: { version: nextVersion },
      },
    }),
  ]);

  return Response.json({ ok: true, status: nextStatus, version: nextVersion });
}
