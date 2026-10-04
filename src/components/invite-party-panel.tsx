"use client";

import { useState } from "react";

export function InvitePartyPanel({
  documentId,
  role,
}: {
  documentId: string;
  role: string;
}) {
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createInvite() {
    setPending(true);
    setMessage(null);

    const response = await fetch(`/api/documents/${documentId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const result = await response.json().catch(() => null);
    setPending(false);

    if (!response.ok) {
      setMessage(result?.error ?? "Unable to create invitation.");
      return;
    }

    setUrl(result.url);
  }

  async function shareInvite() {
    if (!url) return;

    const shareData = {
      title: "Document invitation",
      text: `Join this bill of sale as the ${role}.`,
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Fall through to clipboard unless the share sheet was simply cancelled.
      }
    }

    await navigator.clipboard.writeText(url);
    setMessage("Invitation link copied.");
  }

  return (
    <div className="form-stack">
      <label className="field">
        <span>{role} email (optional)</span>
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="friend@example.com"
        />
      </label>

      {!url ? (
        <button type="button" onClick={createInvite} disabled={pending}>
          {pending ? "Creating link..." : "Create secure invitation"}
        </button>
      ) : (
        <>
          <div className="notice">
            Invitation created. It expires in 7 days and can be replaced with a new link.
          </div>
          <button type="button" onClick={shareInvite}>Share invitation</button>
          <label className="field">
            <span>Invitation link</span>
            <input readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
          </label>
        </>
      )}

      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}
