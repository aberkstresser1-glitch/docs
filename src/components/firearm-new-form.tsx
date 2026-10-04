"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { US_STATES } from "@/lib/templates";

type Props = {
  currentUserName: string;
};

export function FirearmNewForm({ currentUserName }: Props) {
  const router = useRouter();
  const [role, setRole] = useState<"BUYER" | "SELLER">("SELLER");
  const [sellerState, setSellerState] = useState("AL");
  const [buyerState, setBuyerState] = useState("AL");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const interstate = useMemo(
    () => sellerState !== buyerState,
    [sellerState, buyerState],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        role,
        sellerState,
        buyerState,
        templateKey: "firearm_bill_of_sale",
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setPending(false);
      setError(result?.error ?? "Unable to create the document.");
      return;
    }

    router.push(`/documents/${result.id}`);
    router.refresh();
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <section className="card">
        <h2>1. Which party are you?</h2>
        <p className="muted">
          You are signed in as <strong>{currentUserName}</strong>.
        </p>

        <div className="role-grid">
          <button
            type="button"
            className={role === "BUYER" ? "role-choice selected" : "role-choice"}
            onClick={() => setRole("BUYER")}
          >
            I am the Buyer
          </button>

          <button
            type="button"
            className={role === "SELLER" ? "role-choice selected" : "role-choice"}
            onClick={() => setRole("SELLER")}
          >
            I am the Seller
          </button>
        </div>
      </section>

      <section className="card">
        <h2>2. Jurisdictions</h2>

        <div className="form-grid">
          <label className="field">
            <span>Seller state</span>
            <select
              value={sellerState}
              onChange={(event) => setSellerState(event.target.value)}
            >
              {US_STATES.map(([code, name]) => (
                <option value={code} key={code}>
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
                <option value={code} key={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {interstate ? (
          <div className="notice warning">
            <strong>Interstate transfer workflow</strong>
            <div>
              The buyer and seller states differ. This draft will be marked as
              requiring an external FFL transfer step before the firearm can be
              marked transferred/completed. Signing this document will not by
              itself complete that transfer.
            </div>
          </div>
        ) : (
          <div className="notice">
            Same-state workflow selected. State and local requirements may
            still apply.
          </div>
        )}
      </section>

      <section className="card">
        <h2>3. Firearm and sale details</h2>

        <div className="form-grid">
          <label className="field">
            <span>Agreement date</span>
            <input name="agreementDate" type="date" required />
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
            />
          </label>

          <label className="field">
            <span>Manufacturer</span>
            <input name="manufacturer" placeholder="Taurus" required />
          </label>

          <label className="field">
            <span>Model</span>
            <input name="model" placeholder="GX2" required />
          </label>

          <label className="field">
            <span>Caliber / gauge</span>
            <input name="caliber" placeholder="9mm" required />
          </label>

          <label className="field">
            <span>Firearm type</span>
            <select name="firearmType" required defaultValue="HANDGUN">
              <option value="HANDGUN">Handgun</option>
              <option value="RIFLE">Rifle</option>
              <option value="SHOTGUN">Shotgun</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <label className="field full">
            <span>Serial number</span>
            <input
              name="serialNumber"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </label>

          <label className="field full">
            <span>Condition / notes</span>
            <textarea
              name="notes"
              rows={4}
              placeholder="Condition, included magazines/accessories, or other agreed details."
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>4. Start the draft</h2>
        <p className="muted">
          This creates the document in your account. It does not sign or
          finalize anything yet.
        </p>

        {error ? <p className="error">{error}</p> : null}

        <div className="mobile-submit-bar">
          <button type="submit" disabled={pending}>
            {pending ? "Creating draft..." : "Create draft"}
          </button>
        </div>
      </section>
    </form>
  );
}
