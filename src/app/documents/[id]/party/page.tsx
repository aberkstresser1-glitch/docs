import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PartyDetailsForm } from "@/components/party-details-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FirearmPayload, PartyDetails } from "@/lib/document-types";

export const dynamic = "force-dynamic";

export default async function PartyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id } = await params;
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

  if (!document) notFound();

  const participant = document.participants.find(
    (item) => item.userId === session.user.id,
  );
  const version = document.versions[0];

  if (
    !participant ||
    !["BUYER", "SELLER"].includes(participant.role) ||
    !version ||
    version.signatures.length > 0 ||
    version.immutable ||
    ["FINALIZED", "AWAITING_EXTERNAL_STEP", "VOID"].includes(document.status)
  ) {
    redirect(`/documents/${id}`);
  }

  const payload = (version.payload ?? {}) as FirearmPayload;
  const role = participant.role as "BUYER" | "SELLER";
  const initial: PartyDetails = payload.parties?.[role] ?? {
    fullName: participant.displayName ?? session.user.name,
    email: participant.email ?? session.user.email,
    state:
      role === "BUYER"
        ? payload.transaction?.buyerState
        : payload.transaction?.sellerState,
  };

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div>
            <Link className="brand" href="/">Docs</Link>
            <div className="muted">My information</div>
          </div>
          <Link className="button secondary" href={`/documents/${id}`}>Cancel</Link>
        </div>
      </header>

      <main className="shell">
        <section className="hero">
          <span className="badge">{role}</span>
          <h1>Complete your information</h1>
          <p>This information becomes part of the exact version both parties sign.</p>
        </section>

        <PartyDetailsForm documentId={id} role={role} initial={initial} />
      </main>
    </>
  );
}
