"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function SellerFirearmForm({
  documentId,
  initial,
}: {
  documentId: string;
  initial: {
    manufacturer: string;
    model: string;
    caliber: string;
    firearmType: string;
    serialNumber: string;
    notes: string;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    const response = await fetch(`/api/documents/${documentId}/firearm`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setPending(false);
      setError(result?.error ?? "Unable to save the firearm information.");
      return;
    }

    router.push(`/documents/${documentId}`);
    router.refresh();
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <section className="card">
        <h2>Seller firearm information</h2>
        <p className="muted">
          This section belongs to the Seller and can be changed until signing begins.
        </p>

        <div className="form-grid">
          <label className="field">
            <span>Manufacturer</span>
            <input name="manufacturer" required defaultValue={initial.manufacturer} />
          </label>

          <label className="field">
            <span>Model</span>
            <input name="model" required defaultValue={initial.model} />
          </label>

          <label className="field">
            <span>Caliber / gauge</span>
            <input name="caliber" required defaultValue={initial.caliber} />
          </label>

          <label className="field">
            <span>Firearm type</span>
            <select
              name="firearmType"
              required
              defaultValue={initial.firearmType || "HANDGUN"}
            >
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
              required
              defaultValue={initial.serialNumber}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>

          <label className="field full">
            <span>Condition / notes</span>
            <textarea name="notes" rows={4} defaultValue={initial.notes} />
          </label>
        </div>
      </section>

      {error ? <p className="error">{error}</p> : null}

      <div className="mobile-submit-bar">
        <button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save firearm information"}
        </button>
      </div>
    </form>
  );
}
