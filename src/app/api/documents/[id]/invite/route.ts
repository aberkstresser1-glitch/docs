import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const inviteSchema = z.object({
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
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
  const body = await request.json().catch(() => ({}));
  const parsed = inviteSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Enter a valid email or leave it blank." }, { status: 400 });
  }

  const document = await prisma.document.findFirst({
    where: { id, creatorId: session.user.id },
    include: { participants: true, versions: { include: { signatures: true } } },
  });

  if (!document) {
    return Response.json({ error: "Document not found." }, { status: 404 });
  }

  if (
    document.status === "FINALIZED" ||
    document.status === "VOID" ||
    document.status === "AWAITING_EXTERNAL_STEP" ||
    document.versions.some((version) => version.signatures.length > 0)
  ) {
    return Response.json({ error: "This document can no longer be invited." }, { status: 409 });
  }

  const target = document.participants.find((participant) => !participant.userId);
  if (!target) {
    return Response.json({ error: "The other party is already connected." }, { status: 409 });
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const email = parsed.data.email || target.email || null;

  await prisma.$transaction([
    prisma.documentParticipant.update({
      where: { id: target.id },
      data: {
        email,
        invitedAt: new Date(),
        inviteTokenHash: tokenHash,
        inviteExpiresAt,
      },
    }),
    prisma.document.update({
      where: { id: document.id },
      data: { status: "AWAITING_PARTIES" },
    }),
    prisma.auditEvent.create({
      data: {
        documentId: document.id,
        actorUserId: session.user.id,
        eventType: "PARTICIPANT_INVITED",
        metadata: {
          role: target.role,
          email,
          expiresAt: inviteExpiresAt.toISOString(),
        },
      },
    }),
  ]);

  const baseUrl =
    process.env.APP_URL ??
    process.env.BETTER_AUTH_URL ??
    new URL(request.url).origin;

  return Response.json({
    url: `${baseUrl.replace(/\/$/, "")}/invite/${token}`,
    expiresAt: inviteExpiresAt.toISOString(),
    role: target.role,
  });
}
