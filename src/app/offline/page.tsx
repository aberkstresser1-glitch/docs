"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CachedDocument,
  getCachedPdf,
  listCachedDocuments,
} from "@/lib/offline-db";

export default function OfflinePage() {
  const [documents, setDocuments] = useState<CachedDocument[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    listCachedDocuments()
      .then(setDocuments)
      .finally(() => setLoaded(true));
  }, []);

  async function openPdf(document: CachedDocument) {
    if (!document.pdfFileId) return;

    const blob = await getCachedPdf(document.pdfFileId);
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <main className="shell">
      <section className="hero">
        <span className="badge">Device cache</span>
        <h1>Offline library</h1>
        <p>
          This screen reads only documents cached on this device. It does not
          need the home server once the app shell and documents have been saved.
        </p>
        <div className="actions">
          <Link className="button secondary" href="/">
            Back to account
          </Link>
        </div>
      </section>

      {!loaded ? <p className="muted">Loading device cache...</p> : null}

      {loaded && documents.length === 0 ? (
        <section className="card">
          <h2>No cached documents yet</h2>
          <p className="muted">
            Finalized documents you choose to keep offline will appear here.
          </p>
        </section>
      ) : null}

      <section className="list">
        {documents.map((document) => (
          <article className="document-row" key={document.id}>
            <strong>{document.title}</strong>
            <span className="muted">
              {document.templateKey} · {document.status}
            </span>
            <span className="muted">
              Updated {new Date(document.updatedAt).toLocaleString()}
            </span>
            {document.pdfFileId ? (
              <div className="actions">
                <button type="button" onClick={() => openPdf(document)}>
                  Open cached PDF
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
