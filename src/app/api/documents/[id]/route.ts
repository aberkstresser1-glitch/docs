import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FirearmPayload } from "@/lib/document-types";

const sharedDraftSchema = z.object({
  agreementDate: z.string().min(1),
  price: z.coerce.number().min(0),
  sellerState: z.string().length(2),
  buyerState: z.string().length(2),
  manufacturer: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  caliber: z.string().trim().min(1).max(60),
  firearmType: z.enum(["HANDGUN", "RIFLE", "SHOTGUN", "OTHER"]),
  serialNumber: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(4000).optional().default(""),
});

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = sharedDraftSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Check the draft fields." }, { status: 400 });
  }

  const document = await prisma.document.findFirst({
    where: { id, creatorId: session.user.id },
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

  if (["FINALIZED", "VOID", "AWAITING_EXTERNAL_STEP"].includes(document.status)) {
    return Response.json(
      { error: "This document can no longer be edited as a draft." },
      { status: 409 },
    );
  }

  const latest = document.versions[0];
  if (!latest || latest.signatures.length > 0 || latest.immutable) {
    return Response.json(
      { error: "Signing has started. The document is locked." },
      { status: 409 },
    );
  }

  const data = parsed.data;
  const previous = (latest.payload ?? {}) as FirearmPayload;
  const interstate = data.sellerState !== data.buyerState;
  const nextVersion = document.currentVersion + 1;

  const payload: FirearmPayload = {
    ...previous,
    templateKey: document.templateKey,
    templateVersion: document.templateVersion,
    transaction: {
      ...(previous.transaction ?? {}),
      agreementDate: data.agreementDate,
      price: data.price,
      sellerState: data.sellerState,
      buyerState: data.buyerState,
      interstate,
      externalFflRequired: interstate,
    },
    firearm: {
      ...(previous.firearm ?? {}),
      manufacturer: data.manufacturer,
      model: data.model,
      caliber: data.caliber,
      firearmType: data.firearmType,
      serialNumber: data.serialNumber,
      notes: data.notes,
    },
  };

  await prisma.$transaction([
    prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version: nextVersion,
        payload,
        createdById: session.user.id,
      },
    }),
    prisma.document.update({
      where: { id: document.id },
      data: {
        title: `${data.manufacturer} ${data.model} Bill of Sale`,
        sellerJurisdiction: data.sellerState,
        buyerJurisdiction: data.buyerState,
        currentVersion: nextVersion,
      },
    }),
    prisma.auditEvent.create({
      data: {
        documentId: document.id,
        actorUserId: session.user.id,
        eventType: "SHARED_DRAFT_UPDATED",
        metadata: { version: nextVersion, interstate },
      },
    }),
  ]);

  return Response.json({ ok: true, version: nextVersion });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;

  const document = await prisma.document.findFirst({
    where: { id, creatorId: session.user.id },
    include: {
      versions: {
        include: { signatures: true },
      },
    },
  });

  if (!document) {
    return Response.json({ error: "Document not found." }, { status: 404 });
  }

  const signatureCount = document.versions.reduce(
    (count, version) => count + version.signatures.length,
    0,
  );

  if (
    signatureCount > 0 ||
    document.status === "FINALIZED" ||
    document.status === "AWAITING_EXTERNAL_STEP"
  ) {
    return Response.json(
      { error: "Signed or completed documents cannot be deleted." },
      { status: 409 },
    );
  }

  await prisma.document.delete({ where: { id: document.id } });
  return Response.json({ ok: true });
}
