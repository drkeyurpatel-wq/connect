'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NewLeadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'Failed');
      return;
    }
    const { id } = await res.json();
    router.push(`/leads/${id}`);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">New lead</h1>
      <form onSubmit={onSubmit} className="mt-4 flex max-w-lg flex-col gap-3">
        <label className="text-sm">
          First name
          <input name="first_name" required className="mt-1 w-full rounded border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
        </label>
        <label className="text-sm">
          Last name
          <input name="last_name" className="mt-1 w-full rounded border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
        </label>
        <label className="text-sm">
          Phone
          <input name="phone" required className="mt-1 w-full rounded border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
        </label>
        <label className="text-sm">
          Email
          <input name="email" type="email" className="mt-1 w-full rounded border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" />
        </label>
        <label className="text-sm">
          Source
          <select name="source_code" required defaultValue="walk_in" className="mt-1 w-full rounded border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700">
            <option value="walk_in">Walk-in</option>
            <option value="inbound_call">Inbound call</option>
            <option value="doctor_referral">Doctor referral</option>
            <option value="event">Event / Camp</option>
            <option value="other">Other</option>
          </select>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="rounded bg-brand px-4 py-2 text-sm font-medium text-brand-fg disabled:opacity-60">
          {loading ? 'Creating…' : 'Create lead'}
        </button>
      </form>
    </div>
  );
}
