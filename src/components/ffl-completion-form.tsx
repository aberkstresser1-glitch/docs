"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { US_STATES } from "@/lib/templates";

export function FflCompletionForm({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [dealerState, setDealerState] = useState("FL");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    const response = await fetch(`/api/documents/${documentId}/ffl-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, dealerState }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setPending(false);
      setError(result?.error ?? "Unable to record the transfer completion.");
      return;
    }

    router.refresh();
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="notice warning">
        Record this only after the receiving FFL has actually completed the
        transfer to the buyer. This form records the external step; it does not
        perform or verify it.
      </div>

      <div className="form-grid">
        <label className="field full">
          <span>Receiving FFL / dealer name</span>
          <input name="dealerName" required />
        </label>
        <label className="field full">
          <span>Dealer address</span>
          <input name="dealerAddress" required />
        </label>
        <label className="field">
          <span>City</span>
          <input name="dealerCity" required />
        </label>
        <label className="field">
          <span>State</span>
          <select value={dealerState} onChange={(event) => setDealerState(event.target.value)}>
            {US_STATES.map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>ZIP</span>
          <input name="dealerZip" inputMode="numeric" required />
        </label>
        <label className="field">
          <span>FFL number (optional)</span>
          <input name="dealerLicenseNumber" autoCorrect="off" />
        </label>
        <label className="field">
          <span>Actual transfer date</span>
          <input name="transferDate" type="date" required />
        </label>
        <label className="field full">
          <span>Notes (optional)</span>
          <textarea name="notes" rows={3} />
        </label>
      </div>

      {error ? <p className="error">{error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? "Recording..." : "Record FFL transfer completion"}
      </button>
    </form>
  );
}
