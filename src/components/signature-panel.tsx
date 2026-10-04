"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function renderSignatureImage(name: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 220;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Your browser could not render the signature.");
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#101828";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  let size = 86;
  const fontStack =
    '"Snell Roundhand", "Segoe Script", "Apple Chancery", "Brush Script MT", cursive';

  while (size > 42) {
    ctx.font = `${size}px ${fontStack}`;
    if (ctx.measureText(name).width <= 880) break;
    size -= 4;
  }

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.transform(1, 0, -0.08, 1, 0, 0);
  ctx.fillText(name, 0, 0);
  ctx.restore();

  return canvas.toDataURL("image/png");
}

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

    try {
      const signatureImage = renderSignatureImage(typedName.trim());

      const response = await fetch(`/api/documents/${documentId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typedName, consent, signatureImage }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setPending(false);
        setError(result?.error ?? "Unable to sign the document.");
        return;
      }

      router.refresh();
    } catch (error) {
      setPending(false);
      setError(
        error instanceof Error ? error.message : "Unable to render the signature.",
      );
    }
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

      <p className="muted">
        This cursive rendering is captured at signing time and placed into the
        final PDF with your signed record.
      </p>

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

      <button
        type="button"
        onClick={sign}
        disabled={pending || !consent || typedName.trim().length < 2}
      >
        {pending ? "Signing..." : "Adopt & sign"}
      </button>
    </div>
  );
}
