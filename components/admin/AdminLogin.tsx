"use client";

import { useState } from "react";
import { LockKeyhole, MapPinned } from "lucide-react";

export function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password })
    });
    setLoading(false);
    if (response.ok) {
      window.location.href = "/admin/dashboard";
    } else {
      const data = await response.json();
      setError(data.error || "Connexion impossible.");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-wine-100 bg-white p-7 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-wine-700 text-white">
            <MapPinned size={24} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-wine-900">Mode editeur</h1>
            <p className="text-sm text-ink/60">In viaggio per l'Italia - Depot</p>
          </div>
        </div>
        <label className="text-sm font-semibold text-ink/75" htmlFor="password">
          Mot de passe admin
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-lg border border-wine-100 px-4 py-3 focus-ring"
          autoFocus
        />
        {error && <p className="mt-3 rounded-lg bg-wine-50 p-3 text-sm font-medium text-wine-700">{error}</p>}
        <button disabled={loading} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-wine-700 px-4 py-3 font-semibold text-white disabled:opacity-60">
          <LockKeyhole size={18} />
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
