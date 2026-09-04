"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Accesso non riuscito.");
      return;
    }
    router.replace("/admin");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-8 shadow-sm" onSubmit={login}>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Area admin</p>
          <h1 className="mt-2 text-2xl font-bold">Accedi</h1>
        </div>
        <label className="block text-sm font-medium">
          Password
          <input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white" type="submit">Accedi</button>
      </form>
    </main>
  );
}
