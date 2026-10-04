"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteDraftButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("Delete this draft permanently? This cannot be undone.")) return;

    setPending(true);
    setError(null);
    const response = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setPending(false);
      setError(result?.error ?? "Unable to delete this draft.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div>
      {error ? <p className="error">{error}</p> : null}
      <button className="danger" type="button" onClick={remove} disabled={pending}>
        {pending ? "Deleting..." : "Delete draft"}
      </button>
    </div>
  );
}
