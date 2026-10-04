"use client";

import { useState } from "react";
import { cacheDocument, cachePdf } from "@/lib/offline-db";

export function DocumentFileActions({
  documentId,
  title,
  templateKey,
  status,
  updatedAt,
  finalizedAt,
}: {
  documentId: string;
  title: string;
  templateKey: string;
  status: string;
  updatedAt: string;
  finalizedAt?: string | null;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const previewUrl = `/api/documents/${documentId}/pdf?mode=preview`;
  const downloadUrl = `/api/documents/${documentId}/pdf?mode=download`;

  async function fetchPdf() {
    const response = await fetch(previewUrl);
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.error ?? "PDF is not available yet.");
    }
    return response.blob();
  }

  function preview() {
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  }

  function download() {
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download =
      `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "document"}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function share() {
    setPending(true);
    setMessage(null);

    try {
      const blob = await fetchPdf();
      const fileName =
        `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "document"}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title,
          text: title,
          files: [file],
        });
        return;
      }

      setMessage("File sharing is not supported by this browser. Use Download PDF instead.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setMessage(error instanceof Error ? error.message : "Unable to share the PDF.");
    } finally {
      setPending(false);
    }
  }

  async function keepOffline() {
    setPending(true);
    setMessage(null);

    try {
      const blob = await fetchPdf();
      const pdfFileId = `${documentId}:pdf`;
      await cachePdf(pdfFileId, blob);
      await cacheDocument({
        id: documentId,
        title,
        templateKey,
        status,
        updatedAt,
        finalizedAt,
        pdfFileId,
      });
      setMessage("Saved to this device for offline access.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save offline.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="form-stack">
      <div className="actions file-actions">
        <button type="button" className="secondary" onClick={preview}>
          Preview PDF
        </button>
        <button type="button" onClick={download}>
          Download PDF
        </button>
        <button type="button" className="secondary" onClick={share} disabled={pending}>
          Share PDF
        </button>
        <button
          className="secondary"
          type="button"
          onClick={keepOffline}
          disabled={pending}
        >
          Keep available offline
        </button>
      </div>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}
