import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

type FirearmPayload = {
  transaction?: {
    agreementDate?: string;
    price?: number;
    sellerState?: string;
    buyerState?: string;
    interstate?: boolean;
    externalFflRequired?: boolean;
  };
  firearm?: {
    manufacturer?: string;
    model?: string;
    caliber?: string;
    firearmType?: string;
    serialNumber?: string;
    notes?: string;
  };
};

export default async function DocumentPage({ params }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id } = await params;

  const document = await prisma.document.findFirst({
    where: {
      id,
      participants: {
        some: {
          userId: session.user.id,
        },
      },
    },
    include: {
      participants: {
        orderBy: [{ role: "asc" }, { roleIndex: "asc" }],
      },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!document) notFound();

  const payload = (document.versions[0]?.payload ?? {}) as FirearmPayload;
  const transaction = payload.transaction ?? {};
  const firearm = payload.firearm ?? {};
  const myParticipant = document.participants.find(
    (participant) => participant.userId === session.user.id,
  );

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div>
            <Link className="brand" href="/">Docs</Link>
            <div className="muted">Document</div>
          </div>
          <Link className="button secondary" href="/">My documents</Link>
        </div>
      </header>

      <main className="shell">
        <section className="hero">
          <span className="badge">{document.status.replaceAll("_", " ")}</span>
          <h1>{document.title}</h1>
          <p>
            Your role: <strong>{myParticipant?.role ?? "Participant"}</strong>
          </p>
        </section>

        {transaction.interstate ? (
          <section className="notice warning" style={{ marginBottom: "1rem" }}>
            <strong>Interstate / external FFL step required</strong>
            <div>
              Buyer and seller states differ. This document cannot represent
              the firearm as transferred/completed solely because the parties
              sign it. The receiving FFL step will be tracked separately.
            </div>
          </section>
        ) : null}

        <section className="grid">
          <article className="card">
            <h2>Firearm</h2>
            <dl className="detail-list">
              <div><dt>Manufacturer</dt><dd>{firearm.manufacturer ?? "—"}</dd></div>
              <div><dt>Model</dt><dd>{firearm.model ?? "—"}</dd></div>
              <div><dt>Caliber / gauge</dt><dd>{firearm.caliber ?? "—"}</dd></div>
              <div><dt>Type</dt><dd>{firearm.firearmType ?? "—"}</dd></div>
              <div><dt>Serial number</dt><dd>{firearm.serialNumber ?? "—"}</dd></div>
            </dl>
          </article>

          <article className="card">
            <h2>Sale</h2>
            <dl className="detail-list">
              <div><dt>Agreement date</dt><dd>{transaction.agreementDate ?? "—"}</dd></div>
              <div>
                <dt>Price</dt>
                <dd>
                  {typeof transaction.price === "number"
                    ? transaction.price.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })
                    : "—"}
                </dd>
              </div>
              <div><dt>Seller state</dt><dd>{transaction.sellerState ?? "—"}</dd></div>
              <div><dt>Buyer state</dt><dd>{transaction.buyerState ?? "—"}</dd></div>
            </dl>
          </article>

          <article className="card">
            <h2>Parties</h2>
            <div className="list">
              {document.participants.map((participant) => (
                <div className="document-row" key={participant.id}>
                  <strong>{participant.role}</strong>
                  <span className="muted">
                    {participant.displayName ??
                      participant.email ??
                      "Waiting for participant"}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="card">
            <h2>Next step</h2>
            <p className="muted">
              Secure invitations, party details, signature adoption, and PDF
              finalization are the next workflow layer.
            </p>
            <button type="button" disabled>
              Invite other party — coming next
            </button>
          </article>
        </section>

        {firearm.notes ? (
          <section className="card" style={{ marginTop: "1rem" }}>
            <h2>Condition / notes</h2>
            <p className="prewrap">{firearm.notes}</p>
          </section>
        ) : null}
      </main>
    </>
  );
}
