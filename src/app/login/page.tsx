'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';

type Mode = 'password' | 'magic';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  async function handleMagic(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      setError(error.message.includes('rate') ? 'Email rate limit hit. Use password instead, or wait an hour.' : error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-2 font-semibold">
          <span className="inline-block h-6 w-6 rounded bg-brand" aria-hidden />
          H1 Connect
        </div>

        {sent ? (
          <div>
            <p className="text-sm mb-3">Check your email for the magic link.</p>
            <button onClick={() => { setSent(false); setMode('password'); }} className="text-xs text-slate-500 hover:underline">
              ← Back to login
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex gap-1 text-xs">
              <button
                onClick={() => { setMode('password'); setError(null); }}
                className={`px-3 py-1 rounded ${mode === 'password' ? 'bg-brand text-brand-fg' : 'bg-slate-100 dark:bg-slate-800'}`}
              >
                Password
              </button>
              <button
                onClick={() => { setMode('magic'); setError(null); }}
                className={`px-3 py-1 rounded ${mode === 'magic' ? 'bg-brand text-brand-fg' : 'bg-slate-100 dark:bg-slate-800'}`}
              >
                Magic Link
              </button>
            </div>

            <form onSubmit={mode === 'password' ? handlePassword : handleMagic} className="flex flex-col gap-3">
              <label className="text-sm">
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700"
                  autoComplete="email"
                />
              </label>

              {mode === 'password' && (
                <label className="text-sm">
                  Password
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700"
                    autoComplete="current-password"
                  />
                </label>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="rounded bg-brand px-4 py-2 text-sm font-medium text-brand-fg disabled:opacity-60"
              >
                {loading
                  ? (mode === 'password' ? 'Signing in…' : 'Sending…')
                  : (mode === 'password' ? 'Sign in' : 'Send magic link')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
