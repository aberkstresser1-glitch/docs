"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignaturePanel({
  documentId,
  legalName,
  alreadySigned,
}: {
  documentId: string;
  legalName: string;
  alreadySigned: boolean;
}) {
  const router = useRouter();
  const [typedName, setTypedName] = useState(legalName);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (alreadySigned) {
    return <div className="notice">You have signed this document version.</div>;
  }

  async function sign() {
    setPending(true);
    setError(null);

    const response = await fetch(`/api/documents/${documentId}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typedName, consent }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setPending(false);
      setError(result?.error ?? "Unable to sign the document.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="form-stack">
      <label className="field">
        <span>Type your full legal name</span>
        <input
          value={typedName}
          onChange={(event) => setTypedName(event.target.value)}
          autoComplete="name"
        />
      </label>

      <div className="signature-preview" aria-label="Signature preview">
        {typedName || "Your signature"}
      </div>

      <label className="check-row">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>
          I adopt this typed name as my electronic signature and intend to sign
          this exact document version. I understand that the signature does not
          replace any external legal transfer process required by law.
        </span>
      </label>

      {error ? <p className="error">{error}</p> : null}

      <button type="button" onClick={sign} disabled={pending || !consent}>
        {pending ? "Signing..." : "Adopt & sign"}
      </button>
    </div>
  );
}
