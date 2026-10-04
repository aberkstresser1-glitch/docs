import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeleteDocumentButton } from "@/components/delete-document-button";
import { DocumentFileActions } from "@/components/document-file-actions";
import { FflCompletionForm } from "@/components/ffl-completion-form";
import { InvitePartyPanel } from "@/components/invite-party-panel";
import { SignaturePanel } from "@/components/signature-panel";
import { auth } from "@/lib/auth";
import {
  partyDetailsComplete,
  type FirearmPayload,
} from "@/lib/document-types";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
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
        include: {
          signatures: {
            orderBy: { signedAt: "asc" },
          },
        },
      },
    },
  });

  if (!document) notFound();

  const version = document.versions[0];
  const payload = (version?.payload ?? {}) as FirearmPayload;
  const transaction = payload.transaction ?? {};
  const firearm = payload.firearm ?? {};
  const parties = payload.parties ?? {};
  const myParticipant = document.participants.find(
    (participant) => participant.userId === session.user.id,
  );
  const otherParticipant = document.participants.find(
    (participant) =>
      ["BUYER", "SELLER"].includes(participant.role) &&
      participant.id !== myParticipant?.id,
  );

  const isCreator = document.creatorId === session.user.id;
  const signatureCount = version?.signatures.length ?? 0;
  const mySignature = version?.signatures.find(
    (signature) => signature.participantId === myParticipant?.id,
  );
  const editable =
    Boolean(version) &&
    signatureCount === 0 &&
    !version?.immutable &&
    !["FINALIZED", "AWAITING_EXTERNAL_STEP", "VOID"].includes(document.status);

  const buyerComplete = partyDetailsComplete(parties.BUYER);
  const sellerComplete = partyDetailsComplete(parties.SELLER);
  const bothPartiesLinked = document.participants
    .filter((participant) => ["BUYER", "SELLER"].includes(participant.role))
    .every((participant) => Boolean(participant.userId));
  const readyToSign = buyerComplete && sellerComplete && bothPartiesLinked;

  const myRole =
    myParticipant && ["BUYER", "SELLER"].includes(myParticipant.role)
      ? (myParticipant.role as "BUYER" | "SELLER")
      : null;
  const myLegalName = myRole ? parties[myRole]?.fullName ?? "" : "";

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
            <strong>
              {document.status === "FINALIZED"
                ? "Interstate transfer completion recorded"
                : "Interstate / receiving-FFL step required"}
            </strong>
            <div>
              Buyer and seller states differ. Signing records the parties&apos;
              agreement, but the firearm is not treated as transferred/completed
              until the receiving-FFL step is separately recorded.
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

            {editable && isCreator ? (
              <div className="actions">
                <Link className="button secondary" href={`/documents/${id}/edit`}>
                  Edit sale / firearm draft
                </Link>
              </div>
            ) : null}
          </article>

          <article className="card">
            <h2>Parties</h2>
            <div className="list">
              {document.participants
                .filter((participant) => ["BUYER", "SELLER"].includes(participant.role))
                .map((participant) => {
                  const role = participant.role as "BUYER" | "SELLER";
                  const details = parties[role];
                  const signature = version?.signatures.find(
                    (item) => item.participantId === participant.id,
                  );

                  return (
                    <div className="document-row" key={participant.id}>
                      <strong>{role}</strong>
                      <span className="muted">
                        {details?.fullName ??
                          participant.displayName ??
                          participant.email ??
                          "Waiting for participant"}
                      </span>
                      <span className="muted">
                        {!participant.userId
                          ? "Not joined"
                          : !partyDetailsComplete(details)
                            ? "Information incomplete"
                            : signature
                              ? `Signed ${signature.signedAt.toLocaleString()}`
                              : "Information complete"}
                      </span>
                    </div>
                  );
                })}
            </div>

            {editable && myRole ? (
              <div className="actions">
                <Link className="button secondary" href={`/documents/${id}/party`}>
                  Edit my information
                </Link>
              </div>
            ) : null}
          </article>

          {editable && isCreator && otherParticipant && !otherParticipant.userId ? (
            <article className="card">
              <h2>Invite the {otherParticipant.role.toLowerCase()}</h2>
              <p className="muted">
                Send a secure link. They can create an account or sign in, then
                the document will appear in their own library.
              </p>
              <InvitePartyPanel
                documentId={id}
                role={otherParticipant.role}
              />
            </article>
          ) : null}
        </section>

        {firearm.notes ? (
          <section className="card" style={{ marginTop: "1rem" }}>
            <h2>Condition / notes</h2>
            <p className="prewrap">{firearm.notes}</p>
          </section>
        ) : null}

        {readyToSign && myRole && !["FINALIZED", "AWAITING_EXTERNAL_STEP"].includes(document.status) ? (
          <section className="card" style={{ marginTop: "1rem" }}>
            <h2>Electronic signature</h2>
            <p className="muted">
              Once the first party signs, this exact document version is frozen.
            </p>
            <SignaturePanel
              documentId={id}
              legalName={myLegalName}
              alreadySigned={Boolean(mySignature)}
            />
          </section>
        ) : null}

        {!readyToSign && signatureCount === 0 ? (
          <section className="card" style={{ marginTop: "1rem" }}>
            <h2>Before signing</h2>
            <p className="muted">
              Both parties must join the document and complete their required
              personal information before either signature is enabled.
            </p>
          </section>
        ) : null}

        {document.status === "AWAITING_EXTERNAL_STEP" ? (
          <>
            <section className="card" style={{ marginTop: "1rem" }}>
              <h2>Signed agreement</h2>
              <p className="muted">
                Both parties have signed. The interstate transfer is still
                pending the receiving FFL.
              </p>
              <DocumentFileActions
                documentId={id}
                title={document.title}
                templateKey={document.templateKey}
                status={document.status}
                updatedAt={document.updatedAt.toISOString()}
                finalizedAt={document.finalizedAt?.toISOString() ?? null}
              />
            </section>

            {isCreator ? (
              <section className="card" style={{ marginTop: "1rem" }}>
                <h2>Record receiving-FFL completion</h2>
                <FflCompletionForm documentId={id} />
              </section>
            ) : null}
          </>
        ) : null}

        {document.status === "FINALIZED" ? (
          <section className="card" style={{ marginTop: "1rem" }}>
            <h2>Completed document</h2>
            <p className="muted">
              This version is finalized and locked. Both parties can keep their
              own PDF and offline device copy.
            </p>
            <DocumentFileActions
              documentId={id}
              title={document.title}
              templateKey={document.templateKey}
              status={document.status}
              updatedAt={document.updatedAt.toISOString()}
              finalizedAt={document.finalizedAt?.toISOString() ?? null}
            />
          </section>
        ) : null}

        {isCreator ? (
          <section className="card danger-zone" style={{ marginTop: "1rem" }}>
            <h2>{signatureCount > 0 ? "Document controls" : "Draft controls"}</h2>
            <p className="muted">
              {signatureCount > 0
                ? "Permanent deletion removes this server record for every participant. Copies already downloaded or saved offline on another device cannot be erased."
                : "Draft deletion is permanent and cannot be undone."}
            </p>
            <DeleteDocumentButton
              documentId={id}
              signedOrFinalized={
                signatureCount > 0 ||
                ["FINALIZED", "AWAITING_EXTERNAL_STEP"].includes(document.status)
              }
            />
          </section>
        ) : null}
      </main>
    </>
  );
}
