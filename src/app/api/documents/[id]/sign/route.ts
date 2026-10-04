import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { hashDocumentPayload } from "@/lib/document-hash";
import {
  firearmDetailsComplete,
  partyDetailsComplete,
  type FirearmPayload,
} from "@/lib/document-types";
import { generateStoredPdf } from "@/lib/pdf";
import { prisma } from "@/lib/prisma";
import { requestMetadata } from "@/lib/request-meta";

const signSchema = z.object({
  typedName: z.string().trim().min(2).max(150),
  consent: z.literal(true),
  signatureImage: z
    .string()
    .max(500_000)
    .refine(
      (value) => value.startsWith("data:image/png;base64,"),
      "Signature image must be a PNG data URL.",
    ),
});

const CONSENT_TEXT =
  "I adopt the signature above as my electronic signature and intend to sign this document. This signature does not replace any transfer process required by law.";

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

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
  const parsed = signSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Confirm the signature consent and enter your legal name." },
      { status: 400 },
    );
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

  if (["FINALIZED", "VOID", "AWAITING_EXTERNAL_STEP"].includes(document.status)) {
    return Response.json({ error: "This document is not open for signing." }, { status: 409 });
  }

  const participant = document.participants.find(
    (item) => item.userId === session.user.id,
  );
  const latest = document.versions[0];

  if (!participant || !latest || !["BUYER", "SELLER"].includes(participant.role)) {
    return Response.json({ error: "No signing role found." }, { status: 403 });
  }

  if (latest.signatures.some((signature) => signature.participantId === participant.id)) {
    return Response.json({ error: "You have already signed this version." }, { status: 409 });
  }

  const payload = (latest.payload ?? {}) as FirearmPayload;
  const buyerComplete = partyDetailsComplete(payload.parties?.BUYER);
  const sellerComplete = partyDetailsComplete(payload.parties?.SELLER);
  const bothLinked = document.participants
    .filter((item) => ["BUYER", "SELLER"].includes(item.role))
    .every((item) => Boolean(item.userId));

  const firearmComplete = firearmDetailsComplete(payload.firearm);
  const partyStatesMatch =
    payload.parties?.BUYER?.state === payload.transaction?.buyerState &&
    payload.parties?.SELLER?.state === payload.transaction?.sellerState;

  if (
    !buyerComplete ||
    !sellerComplete ||
    !bothLinked ||
    !firearmComplete ||
    !partyStatesMatch
  ) {
    return Response.json(
      {
        error:
          "Both parties must join, complete their information with states matching the sale terms, and the Seller must complete the firearm information before signing.",
      },
      { status: 409 },
    );
  }

  const role = participant.role as "BUYER" | "SELLER";
  const expectedName = payload.parties?.[role]?.fullName ?? "";

  if (normalizeName(parsed.data.typedName) !== normalizeName(expectedName)) {
    return Response.json(
      { error: "Type the same full legal name saved in your party information." },
      { status: 400 },
    );
  }

  const documentHash = hashDocumentPayload(payload);
  if (latest.hash && latest.hash !== documentHash) {
    return Response.json(
      { error: "The document changed unexpectedly. Reload before signing." },
      { status: 409 },
    );
  }

  const metadata = await requestMetadata();

  await prisma.$transaction([
    prisma.documentVersion.update({
      where: { id: latest.id },
      data: {
        hash: documentHash,
        immutable: true,
      },
    }),
    prisma.signature.create({
      data: {
        documentVersionId: latest.id,
        participantId: participant.id,
        signerUserId: session.user.id,
        typedName: parsed.data.typedName,
        signatureStyle: JSON.stringify({
          kind: "typed-cursive-png-v1",
          dataUrl: parsed.data.signatureImage,
        }),
        consentText: CONSENT_TEXT,
        documentHash,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    }),
    prisma.auditEvent.create({
      data: {
        documentId: document.id,
        actorUserId: session.user.id,
        eventType: "DOCUMENT_SIGNED",
        metadata: {
          role,
          version: latest.version,
          documentHash,
        },
      },
    }),
  ]);

  const signed = await prisma.signature.count({
    where: { documentVersionId: latest.id },
  });

  let nextStatus = "READY_TO_SIGN";

  if (signed >= 2) {
    const interstate = Boolean(payload.transaction?.interstate);
    const now = new Date();

    if (interstate) {
      nextStatus = "AWAITING_EXTERNAL_STEP";
      await prisma.document.update({
        where: { id: document.id },
        data: { status: "AWAITING_EXTERNAL_STEP" },
      });
    } else {
      nextStatus = "FINALIZED";
      await prisma.document.update({
        where: { id: document.id },
        data: {
          status: "FINALIZED",
          finalizedAt: now,
          completedAt: now,
        },
      });
    }

    try {
      await generateStoredPdf(document.id);
    } catch {
      // Download endpoint can regenerate the private PDF if file creation failed.
    }
  } else if (document.status !== "READY_TO_SIGN") {
    await prisma.document.update({
      where: { id: document.id },
      data: { status: "READY_TO_SIGN" },
    });
  }

  return Response.json({
    ok: true,
    status: nextStatus,
    documentHash,
  });
}
