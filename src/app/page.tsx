import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

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
          <span className="badge">Foundation build</span>
          <h1>Your documents, available when you need them.</h1>
          <p>
            Signed documents will live in your account, sync to the home server,
            and keep an offline device copy after they have been downloaded.
          </p>
        </section>

        <section className="grid" aria-label="Document actions">
          <article className="card">
            <h2>New document</h2>
            <p className="muted">
              Template selection and the first bill-of-sale workflow are next.
            </p>
            <button type="button" disabled>
              Choose template
            </button>
          </article>

          <article className="card">
            <h2>My documents</h2>
            <p className="muted">
              Server-backed document library will appear here.
            </p>
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
