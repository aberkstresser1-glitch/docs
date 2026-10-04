"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function nextPath() {
    const value = new URLSearchParams(window.location.search).get("next");
    return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const result = await authClient.signUp.email({
      name,
      email,
      password,
    });

    setPending(false);

    if (result.error) {
      setError(result.error.message || "Unable to create account.");
      return;
    }

    window.location.href = nextPath();
  }

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <div className="brand">Docs</div>
        <h1>Create account</h1>
        <p className="muted">
          Your account will own its private copies of documents and signatures.
        </p>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? <p className="error">{error}</p> : null}

          <button type="submit" disabled={pending}>
            {pending ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="muted">
          Already have an account? <Link href="/login">Sign in</Link>.
        </p>
      </section>
    </main>
  );
}
