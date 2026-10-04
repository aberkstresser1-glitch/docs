import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FirearmNewForm } from "@/components/firearm-new-form";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewFirearmDocumentPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div>
            <Link className="brand" href="/">Docs</Link>
            <div className="muted">Firearm Bill of Sale</div>
          </div>
          <Link className="button secondary" href="/new">Templates</Link>
        </div>
      </header>

      <main className="shell">
        <section className="hero">
          <span className="badge">Template v1</span>
          <h1>Firearm Bill of Sale</h1>
          <p>
            Start by choosing your role and entering the shared sale details.
            The other party can be invited to complete their side later.
          </p>
        </section>

        <FirearmNewForm currentUserName={session.user.name} />
      </main>
    </>
  );
}
