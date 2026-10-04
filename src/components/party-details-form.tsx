"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { US_STATES } from "@/lib/templates";
import type { PartyDetails } from "@/lib/document-types";

export function PartyDetailsForm({
  documentId,
  role,
  initial,
}: {
  documentId: string;
  role: string;
  initial: PartyDetails;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial.state || "AL");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    const response = await fetch(`/api/documents/${documentId}/party`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, state }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setPending(false);
      setError(result?.error ?? "Unable to save your information.");
      return;
    }

    router.push(`/documents/${documentId}`);
    router.refresh();
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <section className="card">
        <h2>{role} information</h2>
        <div className="form-grid">
          <label className="field full">
            <span>Full legal name</span>
            <input name="fullName" autoComplete="name" required defaultValue={initial.fullName ?? ""} />
          </label>
          <label className="field full">
            <span>Street address</span>
            <input name="street" autoComplete="street-address" required defaultValue={initial.street ?? ""} />
          </label>
          <label className="field">
            <span>City</span>
            <input name="city" autoComplete="address-level2" required defaultValue={initial.city ?? ""} />
          </label>
          <label className="field">
            <span>State</span>
            <select value={state} onChange={(event) => setState(event.target.value)}>
              {US_STATES.map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>ZIP code</span>
            <input name="zip" autoComplete="postal-code" inputMode="numeric" required defaultValue={initial.zip ?? ""} />
          </label>
          <label className="field">
            <span>Phone (optional)</span>
            <input name="phone" type="tel" autoComplete="tel" defaultValue={initial.phone ?? ""} />
          </label>
          <label className="field full">
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required defaultValue={initial.email ?? ""} />
          </label>
        </div>
      </section>

      {error ? <p className="error">{error}</p> : null}
      <div className="mobile-submit-bar">
        <button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save my information"}
        </button>
      </div>
    </form>
  );
}
