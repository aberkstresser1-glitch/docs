import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Sign in before accepting this invitation." }, { status: 401 });
  }

  const { token } = await context.params;
  const tokenHash = hashToken(token);

  const participant = await prisma.documentParticipant.findUnique({
    where: { inviteTokenHash: tokenHash },
    include: {
      document: {
        include: { participants: true },
      },
    },
  });

  if (!participant || !participant.inviteExpiresAt) {
    return Response.json({ error: "Invitation not found." }, { status: 404 });
  }

  if (participant.inviteExpiresAt.getTime() < Date.now()) {
    return Response.json({ error: "This invitation has expired." }, { status: 410 });
  }

  if (participant.userId && participant.userId !== session.user.id) {
    return Response.json(
      { error: "This invitation has already been accepted by another account." },
      { status: 409 },
    );
  }

  const alreadyParticipant = participant.document.participants.some(
    (item) => item.userId === session.user.id && item.id !== participant.id,
  );

  if (alreadyParticipant) {
    return Response.json(
      { error: "Your account is already attached to the other role." },
      { status: 409 },
    );
  }

  await prisma.$transaction([
    prisma.documentParticipant.update({
      where: { id: participant.id },
      data: {
        userId: session.user.id,
        email: session.user.email,
        displayName: session.user.name,
        acceptedAt: new Date(),
        inviteTokenHash: null,
        inviteExpiresAt: null,
      },
    }),
    prisma.auditEvent.create({
      data: {
        documentId: participant.documentId,
        actorUserId: session.user.id,
        eventType: "PARTICIPANT_ACCEPTED",
        metadata: { role: participant.role },
      },
    }),
  ]);

  return Response.json({
    ok: true,
    documentId: participant.documentId,
  });
}
