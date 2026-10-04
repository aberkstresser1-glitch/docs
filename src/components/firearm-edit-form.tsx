"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { US_STATES } from "@/lib/templates";

type Props = {
  documentId: string;
  initial: {
    agreementDate: string;
    price: number | string;
    sellerState: string;
    buyerState: string;
  };
};

export function FirearmEditForm({ documentId, initial }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sellerState, setSellerState] = useState(initial.sellerState || "AL");
  const [buyerState, setBuyerState] = useState(initial.buyerState || "AL");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    const response = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        sellerState,
        buyerState,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setPending(false);
      setError(result?.error ?? "Unable to save the sale terms.");
      return;
    }

    router.push(`/documents/${documentId}`);
    router.refresh();
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <section className="card">
        <h2>Sale details</h2>
        <p className="muted">
          The person who started the draft controls these shared transaction
          terms until signing begins.
        </p>

        <div className="form-grid">
          <label className="field">
            <span>Agreement date</span>
            <input
              name="agreementDate"
              type="date"
              required
              defaultValue={initial.agreementDate}
            />
          </label>

          <label className="field">
            <span>Sale price ($)</span>
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              required
              defaultValue={initial.price}
            />
          </label>

          <label className="field">
            <span>Seller state</span>
            <select
              value={sellerState}
              onChange={(event) => setSellerState(event.target.value)}
            >
              {US_STATES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Buyer state</span>
            <select
              value={buyerState}
              onChange={(event) => setBuyerState(event.target.value)}
            >
              {US_STATES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {sellerState !== buyerState ? (
          <div className="notice warning">
            Interstate workflow will remain enabled because buyer and seller
            states differ.
          </div>
        ) : null}
      </section>

      {error ? <p className="error">{error}</p> : null}

      <div className="mobile-submit-bar">
        <button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save sale terms"}
        </button>
      </div>
    </form>
  );
}
