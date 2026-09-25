"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  hostId: string;
  current?: { id: string; email: string; name: string | null } | null;
};

export function AttachOwnerForm({ hostId, current }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(current?.email || "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(current?.name || "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onAttach(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/hosts/${hostId}/attach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: password || undefined,
          name: name || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Attach failed");
        return;
      }
      setMessage(`Linked ${data.user?.email || email}`);
      setPassword("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function onDetach() {
    if (!confirm("Detach owning user from this host?")) return;
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/hosts/${hostId}/detach`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Detach failed");
        return;
      }
      setMessage("Owner detached");
      setEmail("");
      setName("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Host login (owner)</h2>
        <p className="text-sm text-slate-500">
          Create or link a HOST user. No invite email — set the password here.
        </p>
        {current ? (
          <p className="mt-2 text-sm text-emerald-700">
            Currently linked: <strong>{current.email}</strong>
            {current.name ? ` (${current.name})` : ""}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Unclaimed — no owning user.</p>
        )}
      </div>
      {error && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      )}
      {message && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}
      <form onSubmit={onAttach} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Password {current ? "(optional to reset)" : "(required for new user)"}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={current ? undefined : 8}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : current ? "Update / re-link" : "Create & attach"}
          </button>
          {current && (
            <button
              type="button"
              disabled={saving}
              onClick={onDetach}
              className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200 disabled:opacity-50"
            >
              Detach
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
