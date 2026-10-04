"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteDocumentButton({
  documentId,
  signedOrFinalized = false,
}: {
  documentId: string;
  signedOrFinalized?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    let confirmation: string | undefined;

    if (signedOrFinalized) {
      const typed = window.prompt(
        "This permanently deletes the server copy for every participant. Downloaded or offline copies on other devices cannot be erased. Type DELETE to continue.",
      );
      if (typed !== "DELETE") return;
      confirmation = typed;
    } else {
      const confirmed = window.confirm(
        "Delete this draft permanently? This cannot be undone.",
      );
      if (!confirmed) return;
    }

    setPending(true);
    setError(null);

    const response = await fetch(`/api/documents/${documentId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setPending(false);
      setError(result?.error ?? "Unable to delete this document.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div>
      {error ? <p className="error">{error}</p> : null}
      <button className="danger" type="button" onClick={remove} disabled={pending}>
        {pending
          ? "Deleting..."
          : signedOrFinalized
            ? "Permanently delete document"
            : "Delete draft"}
      </button>
    </div>
  );
}
