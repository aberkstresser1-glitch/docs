import { createHash } from "node:crypto";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InviteAccept } from "@/components/invite-accept";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const participant = await prisma.documentParticipant.findUnique({
    where: { inviteTokenHash: hashToken(token) },
    include: { document: true },
  });

  if (!participant) notFound();

  const expired =
    !participant.inviteExpiresAt ||
    participant.inviteExpiresAt.getTime() < Date.now();

  const session = await auth.api.getSession({ headers: await headers() });
  const next = `/invite/${token}`;

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <div className="brand">Docs</div>
        <span className="badge">Document invitation</span>
        <h1>{participant.document.title}</h1>
        <p className="muted">
          You have been invited to join this document as the{" "}
          <strong>{participant.role}</strong>.
        </p>

        {expired ? (
          <p className="error">
            This invitation has expired. Ask the document creator for a new link.
          </p>
        ) : session ? (
          <>
            <p>
              Signed in as <strong>{session.user.name}</strong> (
              {session.user.email}).
            </p>
            <InviteAccept token={token} />
          </>
        ) : (
          <>
            <p>
              Sign in or create an account to attach your copy of the document
              to your private library.
            </p>
            <div className="actions">
              <Link
                className="button"
                href={`/login?next=${encodeURIComponent(next)}`}
              >
                Sign in
              </Link>
              <Link
                className="button secondary"
                href={`/signup?next=${encodeURIComponent(next)}`}
              >
                Create account
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
