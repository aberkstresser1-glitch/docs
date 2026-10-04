import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { templates } from "@/lib/templates";

export const dynamic = "force-dynamic";

export default async function NewDocumentPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div>
            <Link className="brand" href="/">Docs</Link>
            <div className="muted">Choose a document template</div>
          </div>
          <Link className="button secondary" href="/">Dashboard</Link>
        </div>
      </header>

      <main className="shell">
        <section className="hero">
          <span className="badge">New document</span>
          <h1>What are you creating?</h1>
          <p>
            Pick a template. Each template keeps its own version so completed
            documents never silently change when a form is updated later.
          </p>
        </section>

        <section className="grid">
          {templates.map((template) => (
            <article className="card" key={template.key}>
              <span className="badge">{template.category}</span>
              <h2 style={{ marginTop: "0.75rem" }}>{template.name}</h2>
              <p className="muted">{template.description}</p>
              <div className="actions">
                {template.available && template.href ? (
                  template.key === "firearm_bill_of_sale" ? (
                    <>
                      <Link className="button" href={`${template.href}?role=SELLER`}>
                        Start as Seller
                      </Link>
                      <Link className="button secondary" href={`${template.href}?role=BUYER`}>
                        Start as Buyer
                      </Link>
                    </>
                  ) : (
                    <Link className="button" href={template.href}>
                      Use template
                    </Link>
                  )
                ) : (
                  <button type="button" disabled>
                    Coming soon
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
