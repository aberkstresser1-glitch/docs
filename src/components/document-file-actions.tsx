"use client";

import { useState } from "react";
import {
  cacheDocument,
  cachePdf,
} from "@/lib/offline-db";

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

  async function fetchPdf() {
    const response = await fetch(`/api/documents/${documentId}/pdf`);
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.error ?? "PDF is not available yet.");
    }
    return response.blob();
  }

  async function download() {
    setPending(true);
    setMessage(null);
    try {
      const blob = await fetchPdf();
      const fileName = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "document"}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            title,
            files: [file],
          });
          return;
        } catch {
          // If the user closes the share sheet, fall back to a normal save.
        }
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to get the PDF.");
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
      <div className="actions">
        <button type="button" onClick={download} disabled={pending}>
          Save / share PDF
        </button>
        <button className="secondary" type="button" onClick={keepOffline} disabled={pending}>
          Keep available offline
        </button>
      </div>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}
