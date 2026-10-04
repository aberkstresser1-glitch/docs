import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SellerFirearmForm } from "@/components/seller-firearm-form";
import { auth } from "@/lib/auth";
import type { FirearmPayload } from "@/lib/document-types";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SellerFirearmPage({
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
      participants: {
        some: {
          userId: session.user.id,
          role: "SELLER",
        },
      },
    },
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
  const firearm = payload.firearm ?? {};

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div>
            <Link className="brand" href="/">Docs</Link>
            <div className="muted">Seller firearm information</div>
          </div>
          <Link className="button secondary" href={`/documents/${id}`}>
            Cancel
          </Link>
        </div>
      </header>

      <main className="shell">
        <section className="hero">
          <span className="badge">Seller</span>
          <h1>Firearm information</h1>
          <p>
            The Seller is responsible for identifying the firearm included in this
            document.
          </p>
        </section>

        <SellerFirearmForm
          documentId={id}
          initial={{
            manufacturer: firearm.manufacturer ?? "",
            model: firearm.model ?? "",
            caliber: firearm.caliber ?? "",
            firearmType: firearm.firearmType ?? "HANDGUN",
            serialNumber: firearm.serialNumber ?? "",
            notes: firearm.notes ?? "",
          }}
        />
      </main>
    </>
  );
}
