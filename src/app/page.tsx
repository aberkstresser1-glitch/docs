import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const documents = await prisma.document.findMany({
    where: {
      participants: {
        some: {
          userId: session.user.id,
        },
      },
    },
    include: {
      participants: {
        where: {
          userId: session.user.id,
        },
        take: 1,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 25,
  });

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div>
            <div className="brand">Docs</div>
            <div className="muted">Private documents & e-signatures</div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="shell">
        <section className="hero">
          <span className="badge">Private document vault</span>
          <h1>Your documents, available when you need them.</h1>
          <p>
            Create private forms, track each party, keep finalized records on
            the home server, and retain device copies for offline access.
          </p>
        </section>

        <section className="grid" aria-label="Document actions">
          <article className="card">
            <h2>New document</h2>
            <p className="muted">
              Start with a reusable template and choose which party you are.
            </p>
            <div className="actions">
              <Link className="button" href="/new">
                Choose template
              </Link>
            </div>
          </article>

          <article className="card">
            <h2>My documents</h2>
            <p className="muted">
              {documents.length === 0
                ? "No documents yet."
                : `${documents.length} recent document${documents.length === 1 ? "" : "s"}.`}
            </p>
            {documents.length > 0 ? (
              <div className="mini-list">
                {documents.slice(0, 3).map((document) => (
                  <Link
                    className="mini-document"
                    href={`/documents/${document.id}`}
                    key={document.id}
                  >
                    <strong>{document.title}</strong>
                    <span>
                      {document.participants[0]?.role ?? "Participant"} ·{" "}
                      {document.status.replaceAll("_", " ")}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </article>

          <article className="card">
            <h2>Offline library</h2>
            <p className="muted">
              View documents already cached on this device without a connection.
            </p>
            <div className="actions">
              <Link className="button secondary" href="/offline">
                Open offline library
              </Link>
            </div>
          </article>
        </section>

        <section style={{ marginTop: "2rem" }}>
          <div className="section-heading">
            <div>
              <h2>Recent documents</h2>
              <p className="muted">
                Documents shared with your account appear here.
              </p>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="card">
              <strong>No documents yet.</strong>
              <p className="muted">
                Create your first document from a template.
              </p>
            </div>
          ) : (
            <div className="list">
              {documents.map((document) => (
                <Link
                  className="document-row document-link"
                  href={`/documents/${document.id}`}
                  key={document.id}
                >
                  <strong>{document.title}</strong>
                  <span className="muted">
                    {document.participants[0]?.role ?? "Participant"} ·{" "}
                    {document.status.replaceAll("_", " ")}
                  </span>
                  <span className="muted">
                    Updated {document.updatedAt.toLocaleString()}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section style={{ marginTop: "2rem" }}>
          <h2>Account</h2>
          <div className="card">
            <strong>{session.user.name}</strong>
            <div className="muted">{session.user.email}</div>
          </div>
        </section>
      </main>
    </>
  );
}
