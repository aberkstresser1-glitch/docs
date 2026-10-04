"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteAccept({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setPending(true);
    setError(null);

    const response = await fetch(`/api/invites/${encodeURIComponent(token)}/accept`, {
      method: "POST",
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setPending(false);
      setError(result?.error ?? "Unable to accept invitation.");
      return;
    }

    router.push(`/documents/${result.documentId}`);
    router.refresh();
  }

  return (
    <div>
      {error ? <p className="error">{error}</p> : null}
      <button type="button" onClick={accept} disabled={pending}>
        {pending ? "Joining document..." : "Accept invitation"}
      </button>
    </div>
  );
}
