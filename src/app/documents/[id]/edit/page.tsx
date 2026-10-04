import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FirearmEditForm } from "@/components/firearm-edit-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FirearmPayload } from "@/lib/document-types";

export const dynamic = "force-dynamic";

export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id } = await params;
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

  if (!document) notFound();

  const version = document.versions[0];
  if (
    !version ||
    version.signatures.length > 0 ||
    version.immutable ||
    ["FINALIZED", "AWAITING_EXTERNAL_STEP", "VOID"].includes(document.status)
  ) {
    redirect(`/documents/${id}`);
  }

  const payload = (version.payload ?? {}) as FirearmPayload;
  const transaction = payload.transaction ?? {};

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div>
            <Link className="brand" href="/">Docs</Link>
            <div className="muted">Edit draft</div>
          </div>
          <Link className="button secondary" href={`/documents/${id}`}>Cancel</Link>
        </div>
      </header>

      <main className="shell">
        <section className="hero">
          <span className="badge">Draft</span>
          <h1>Edit {document.title}</h1>
          <p>Shared sale terms can be changed by the draft creator until signing begins.</p>
        </section>

        <FirearmEditForm
          documentId={id}
          initial={{
            agreementDate: transaction.agreementDate ?? "",
            price: transaction.price ?? "",
            sellerState: transaction.sellerState ?? "AL",
            buyerState: transaction.buyerState ?? "AL",
          }}
        />
      </main>
    </>
  );
}
