import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FirearmNewForm } from "@/components/firearm-new-form";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewFirearmDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const params = await searchParams;
  const initialRole = params.role === "BUYER" ? "BUYER" : "SELLER";

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
          <span className="badge">New document</span>
          <h1>Firearm Bill of Sale</h1>
          <p>
            Either party can start the draft. The Seller provides the firearm
            identification, and each party completes their own personal information.
          </p>
        </section>

        <FirearmNewForm
          currentUserName={session.user.name}
          initialRole={initialRole}
        />
      </main>
    </>
  );
}
