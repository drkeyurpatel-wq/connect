'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TRACKS = ['HMIS', 'HRMS', 'VPMS', 'LIMS', 'Patient Portal', 'Open'] as const;
const OPEN_PROBLEMS = [
  'Insurance End-to-End',
  'Discharge Optimizer',
  'Patient Journey & Outcomes',
] as const;

const TRACK_DESC: Record<string, string> = {
  HMIS: 'Billing engine · EMR · RCM — up to 2 teams',
  HRMS: 'Payroll · Biometric attendance pipeline',
  VPMS: 'PO lifecycle · GRN · 3-way matching',
  LIMS: 'End-to-end lab sample lifecycle (LAB1)',
  'Patient Portal': 'Greenfield · Mobile-first · OTP login',
  Open: 'Build from scratch — pick one problem statement',
};

type FormData = {
  team_name: string;
  track: string;
  open_track_problem: string;
  lead_name: string; lead_email: string; lead_phone: string;
  lead_role: string; lead_github: string; lead_linkedin: string;
  member2_name: string; member2_email: string; member2_role: string; member2_github: string;
  member3_name: string; member3_email: string; member3_role: string; member3_github: string;
  why_us: string; stack_experience: string; portfolio_url: string;
};

const empty: FormData = {
  team_name: '', track: '', open_track_problem: '',
  lead_name: '', lead_email: '', lead_phone: '', lead_role: '', lead_github: '', lead_linkedin: '',
  member2_name: '', member2_email: '', member2_role: '', member2_github: '',
  member3_name: '', member3_email: '', member3_role: '', member3_github: '',
  why_us: '', stack_experience: '', portfolio_url: '',
};

export default function MedHackRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(empty);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof FormData, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/medhack/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          open_track_problem: form.track === 'Open' ? form.open_track_problem : null,
          portfolio_url: form.portfolio_url || null,
          lead_github: form.lead_github || null,
          lead_linkedin: form.lead_linkedin || null,
          member2_github: form.member2_github || null,
          member3_github: form.member3_github || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Submission failed. Please try again.');
        return;
      }
      router.push('/medhack/success');
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  const canNext1 = form.team_name.trim() && form.track &&
    (form.track !== 'Open' || form.open_track_problem);
  const canNext2 = form.lead_name && form.lead_email && form.lead_phone && form.lead_role;
  const canNext3 =
    form.member2_name && form.member2_email && form.member2_role &&
    form.member3_name && form.member3_email && form.member3_role;
  const canSubmit = form.why_us.trim().length >= 20 && form.stack_experience.trim();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --navy: #0058A0;
          --navy-dark: #004080;
          --navy-light: #1a6db5;
          --teal: #18B098;
          --teal-light: #1fcdb7;
          --red: #E02010;
          --yellow: #F8B800;
          --bg: #f0f4f8;
          --surface: #ffffff;
          --card: #ffffff;
          --border: rgba(0,88,160,0.12);
          --text: #0f1e2e;
          --text-2: #3d5a7a;
          --text-3: #7a95b0;
          --font: 'Plus Jakarta Sans', sans-serif;
          --radius: 12px;
          --shadow: 0 4px 24px rgba(0,88,160,0.08);
          --shadow-lg: 0 8px 40px rgba(0,88,160,0.13);
        }

        body {
          font-family: var(--font);
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
        }

        .page { min-height: 100vh; display: flex; flex-direction: column; }

        /* Hero */
        .hero {
          background: linear-gradient(135deg, #003d73 0%, var(--navy) 50%, #005fad 100%);
          padding: 48px 24px 56px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 70% 40%, rgba(24,176,152,0.18) 0%, transparent 60%);
        }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(24,176,152,0.18); border: 1px solid rgba(24,176,152,0.4);
          color: #7ee8d8; font-size: 11px; font-weight: 600; letter-spacing: 1px;
          text-transform: uppercase; padding: 4px 12px; border-radius: 20px;
          margin-bottom: 16px; position: relative;
        }
        .hero h1 {
          font-size: clamp(28px, 5vw, 48px); font-weight: 800;
          color: #fff; letter-spacing: -1.5px; margin-bottom: 8px;
          position: relative;
        }
        .hero h1 span { color: var(--teal); }
        .hero-sub {
          font-size: 16px; color: rgba(255,255,255,0.72); font-weight: 400;
          margin-bottom: 24px; position: relative;
        }
        .hero-meta {
          display: flex; align-items: center; justify-content: center;
          gap: 20px; flex-wrap: wrap; position: relative;
        }
        .hero-chip {
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18);
          color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 500;
          padding: 6px 14px; border-radius: 20px;
        }

        /* Steps indicator */
        .steps-wrap { background: var(--surface); border-bottom: 1px solid var(--border); }
        .steps {
          max-width: 680px; margin: 0 auto; padding: 16px 24px;
          display: flex; align-items: center; gap: 0;
        }
        .step-item {
          display: flex; align-items: center; gap: 8px; flex: 1;
        }
        .step-circle {
          width: 28px; height: 28px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; flex-shrink: 0;
          transition: all 0.2s;
        }
        .step-circle.done { background: var(--teal); color: #fff; }
        .step-circle.active { background: var(--navy); color: #fff; }
        .step-circle.pending { background: #e8edf3; color: var(--text-3); }
        .step-label { font-size: 12px; font-weight: 600; color: var(--text-3); white-space: nowrap; }
        .step-label.active { color: var(--navy); }
        .step-line { flex: 1; height: 2px; background: #e8edf3; margin: 0 8px; }
        .step-line.done { background: var(--teal); }

        /* Form */
        .form-wrap { max-width: 680px; margin: 0 auto; padding: 32px 24px 80px; flex: 1; }

        .card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 28px;
          box-shadow: var(--shadow); margin-bottom: 16px;
        }
        .card-title {
          font-size: 17px; font-weight: 700; color: var(--navy);
          margin-bottom: 4px;
        }
        .card-sub {
          font-size: 13px; color: var(--text-3); margin-bottom: 20px;
        }

        .row { display: grid; gap: 14px; margin-bottom: 14px; }
        .row.cols2 { grid-template-columns: 1fr 1fr; }
        @media (max-width: 540px) { .row.cols2 { grid-template-columns: 1fr; } }

        .field { display: flex; flex-direction: column; gap: 5px; }
        .label {
          font-size: 11px; font-weight: 600; letter-spacing: 0.5px;
          text-transform: uppercase; color: var(--text-2);
        }
        .label .req { color: var(--red); margin-left: 2px; }
        .label .opt { color: var(--text-3); font-weight: 400; text-transform: none; letter-spacing: 0; font-size: 11px; }

        input, textarea, select {
          font-family: var(--font); font-size: 14px; color: var(--text);
          background: #f5f8fc; border: 1.5px solid var(--border);
          border-radius: 8px; padding: 10px 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none; width: 100%;
        }
        input::placeholder, textarea::placeholder { color: var(--text-3); }
        input:focus, textarea:focus, select:focus {
          border-color: var(--navy); box-shadow: 0 0 0 3px rgba(0,88,160,0.1);
          background: #fff;
        }
        textarea { resize: vertical; min-height: 100px; line-height: 1.6; }
        select { cursor: pointer; appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L11 1' stroke='%237a95b0' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 14px center;
          padding-right: 36px;
        }

        /* Track picker */
        .track-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          gap: 10px; margin-bottom: 14px;
        }
        .track-card {
          border: 1.5px solid var(--border); border-radius: 10px;
          padding: 12px 14px; cursor: pointer;
          transition: all 0.18s; background: #f5f8fc;
        }
        .track-card:hover { border-color: var(--navy-light); background: #eef4fb; }
        .track-card.selected {
          border-color: var(--navy); background: #e8f0fb;
          box-shadow: 0 0 0 3px rgba(0,88,160,0.1);
        }
        .track-name { font-size: 14px; font-weight: 700; color: var(--navy); margin-bottom: 3px; }
        .track-desc { font-size: 11px; color: var(--text-3); line-height: 1.4; }

        /* Member section */
        .member-header {
          display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
        }
        .member-badge {
          width: 28px; height: 28px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: #fff;
          flex-shrink: 0;
        }
        .member-badge.lead { background: var(--navy); }
        .member-badge.m2 { background: var(--teal); }
        .member-badge.m3 { background: var(--yellow); color: #333; }
        .member-title { font-size: 15px; font-weight: 700; color: var(--text); }
        .member-role-hint { font-size: 12px; color: var(--text-3); }

        .divider { height: 1px; background: var(--border); margin: 20px 0; }

        /* Buttons */
        .btn-row { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }
        .btn {
          font-family: var(--font); font-size: 14px; font-weight: 700;
          padding: 12px 28px; border-radius: 8px; border: none;
          cursor: pointer; transition: all 0.18s; display: inline-flex;
          align-items: center; gap: 8px;
        }
        .btn-primary {
          background: linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%);
          color: #fff; box-shadow: 0 4px 14px rgba(0,88,160,0.3);
        }
        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,88,160,0.4);
        }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .btn-ghost {
          background: transparent; color: var(--text-2);
          border: 1.5px solid var(--border);
        }
        .btn-ghost:hover { background: #f0f4f8; }

        /* Prize strip */
        .prize-strip {
          background: linear-gradient(90deg, rgba(0,88,160,0.06), rgba(24,176,152,0.06));
          border: 1px solid var(--border); border-radius: 10px;
          padding: 14px 18px; margin-bottom: 20px;
          display: flex; flex-wrap: wrap; gap: 16px; align-items: center;
        }
        .prize-item { display: flex; align-items: center; gap: 8px; }
        .prize-dot { width: 8px; height: 8px; border-radius: 50%; }
        .prize-text { font-size: 12px; font-weight: 600; color: var(--text-2); }

        /* Error */
        .error-box {
          background: #fff0ee; border: 1px solid rgba(224,32,16,0.2);
          border-radius: 8px; padding: 12px 16px; color: var(--red);
          font-size: 13px; margin-bottom: 16px; font-weight: 500;
        }

        /* Char count */
        .char-count { font-size: 11px; color: var(--text-3); text-align: right; margin-top: 3px; }
        .char-count.warn { color: var(--red); }
      `}</style>

      <div className="page">
        {/* Hero */}
        <div className="hero">
          <div className="hero-badge">⚡ Applications Open</div>
          <h1>Health1 <span>MedHack</span> 2026</h1>
          <p className="hero-sub">India&apos;s first hospital-run internal healthtech hackathon</p>
          <div className="hero-meta">
            <span className="hero-chip">📅 June 6–7, 2026</span>
            <span className="hero-chip">📍 Health1 Shilaj, Ahmedabad</span>
            <span className="hero-chip">🏆 ₹2L Prize Pool</span>
            <span className="hero-chip">👥 5–6 Teams of 3</span>
          </div>
        </div>

        {/* Steps */}
        <div className="steps-wrap">
          <div className="steps">
            {[
              { n: 1, label: 'Track' },
              { n: 2, label: 'Team Lead' },
              { n: 3, label: 'Members' },
              { n: 4, label: 'Pitch' },
            ].map(({ n, label }, i, arr) => (
              <div key={n} className="step-item">
                <div className={`step-circle ${step > n ? 'done' : step === n ? 'active' : 'pending'}`}>
                  {step > n ? '✓' : n}
                </div>
                <span className={`step-label ${step === n ? 'active' : ''}`}>{label}</span>
                {i < arr.length - 1 && (
                  <div className={`step-line ${step > n ? 'done' : ''}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="form-wrap">
          {error && <div className="error-box">⚠ {error}</div>}

          {/* Step 1 — Track */}
          {step === 1 && (
            <div>
              <div className="prize-strip">
                <div className="prize-item">
                  <div className="prize-dot" style={{ background: '#F8B800' }} />
                  <span className="prize-text">₹1L Grand Winner</span>
                </div>
                <div className="prize-item">
                  <div className="prize-dot" style={{ background: '#0058A0' }} />
                  <span className="prize-text">₹40K Best Stack-Hardening</span>
                </div>
                <div className="prize-item">
                  <div className="prize-dot" style={{ background: '#18B098' }} />
                  <span className="prize-text">₹40K Best Open Build</span>
                </div>
                <div className="prize-item">
                  <div className="prize-dot" style={{ background: '#E02010' }} />
                  <span className="prize-text">₹20K Code-Merged Bounty</span>
                </div>
              </div>

              <div className="card">
                <div className="card-title">Choose your track</div>
                <div className="card-sub">Pick the system your team will build on. HMIS allows up to 2 teams.</div>

                <div className="track-grid">
                  {TRACKS.map((t) => (
                    <div
                      key={t}
                      className={`track-card${form.track === t ? ' selected' : ''}`}
                      onClick={() => set('track', t)}
                    >
                      <div className="track-name">{t}</div>
                      <div className="track-desc">{TRACK_DESC[t]}</div>
                    </div>
                  ))}
                </div>

                {form.track === 'Open' && (
                  <div className="field" style={{ marginTop: 8 }}>
                    <label className="label">Problem Statement <span className="req">*</span></label>
                    <select
                      value={form.open_track_problem}
                      onChange={(e) => set('open_track_problem', e.target.value)}
                    >
                      <option value="">Select a problem statement...</option>
                      {OPEN_PROBLEMS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="row" style={{ marginTop: 16 }}>
                  <div className="field">
                    <label className="label">Team Name <span className="req">*</span></label>
                    <input
                      value={form.team_name}
                      onChange={(e) => set('team_name', e.target.value)}
                      placeholder="e.g. Byte Surgeons"
                      maxLength={80}
                    />
                  </div>
                </div>
              </div>

              <div className="btn-row">
                <button
                  className="btn btn-primary"
                  disabled={!canNext1}
                  onClick={() => setStep(2)}
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Team Lead */}
          {step === 2 && (
            <div>
              <div className="card">
                <div className="member-header">
                  <div className="member-badge lead">L</div>
                  <div>
                    <div className="member-title">Team Lead</div>
                    <div className="member-role-hint">Primary contact — gets all communications</div>
                  </div>
                </div>

                <div className="row cols2">
                  <div className="field">
                    <label className="label">Full Name <span className="req">*</span></label>
                    <input value={form.lead_name} onChange={(e) => set('lead_name', e.target.value)} placeholder="Dr. Priya Sharma" />
                  </div>
                  <div className="field">
                    <label className="label">Role / Title <span className="req">*</span></label>
                    <input value={form.lead_role} onChange={(e) => set('lead_role', e.target.value)} placeholder="Full-stack dev · Final year MBBS" />
                  </div>
                </div>
                <div className="row cols2">
                  <div className="field">
                    <label className="label">Email <span className="req">*</span></label>
                    <input type="email" value={form.lead_email} onChange={(e) => set('lead_email', e.target.value)} placeholder="you@email.com" />
                  </div>
                  <div className="field">
                    <label className="label">Phone <span className="req">*</span></label>
                    <input value={form.lead_phone} onChange={(e) => set('lead_phone', e.target.value)} placeholder="98XXXXXXXX" maxLength={15} />
                  </div>
                </div>
                <div className="row cols2">
                  <div className="field">
                    <label className="label">GitHub <span className="opt">(optional)</span></label>
                    <input value={form.lead_github} onChange={(e) => set('lead_github', e.target.value)} placeholder="github.com/username" />
                  </div>
                  <div className="field">
                    <label className="label">LinkedIn <span className="opt">(optional)</span></label>
                    <input value={form.lead_linkedin} onChange={(e) => set('lead_linkedin', e.target.value)} placeholder="linkedin.com/in/username" />
                  </div>
                </div>
              </div>

              <div className="btn-row">
                <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
                <button className="btn btn-primary" disabled={!canNext2} onClick={() => setStep(3)}>Continue →</button>
              </div>
            </div>
          )}

          {/* Step 3 — Members */}
          {step === 3 && (
            <div>
              <div className="card">
                <div className="member-header">
                  <div className="member-badge m2">2</div>
                  <div>
                    <div className="member-title">Member 2</div>
                    <div className="member-role-hint">Second team member</div>
                  </div>
                </div>
                <div className="row cols2">
                  <div className="field">
                    <label className="label">Full Name <span className="req">*</span></label>
                    <input value={form.member2_name} onChange={(e) => set('member2_name', e.target.value)} placeholder="Full name" />
                  </div>
                  <div className="field">
                    <label className="label">Role <span className="req">*</span></label>
                    <input value={form.member2_role} onChange={(e) => set('member2_role', e.target.value)} placeholder="Backend dev · Designer" />
                  </div>
                </div>
                <div className="row cols2">
                  <div className="field">
                    <label className="label">Email <span className="req">*</span></label>
                    <input type="email" value={form.member2_email} onChange={(e) => set('member2_email', e.target.value)} placeholder="email@domain.com" />
                  </div>
                  <div className="field">
                    <label className="label">GitHub <span className="opt">(optional)</span></label>
                    <input value={form.member2_github} onChange={(e) => set('member2_github', e.target.value)} placeholder="github.com/username" />
                  </div>
                </div>

                <div className="divider" />

                <div className="member-header">
                  <div className="member-badge m3">3</div>
                  <div>
                    <div className="member-title">Member 3</div>
                    <div className="member-role-hint">Third team member</div>
                  </div>
                </div>
                <div className="row cols2">
                  <div className="field">
                    <label className="label">Full Name <span className="req">*</span></label>
                    <input value={form.member3_name} onChange={(e) => set('member3_name', e.target.value)} placeholder="Full name" />
                  </div>
                  <div className="field">
                    <label className="label">Role <span className="req">*</span></label>
                    <input value={form.member3_role} onChange={(e) => set('member3_role', e.target.value)} placeholder="Frontend dev · Clinician" />
                  </div>
                </div>
                <div className="row cols2">
                  <div className="field">
                    <label className="label">Email <span className="req">*</span></label>
                    <input type="email" value={form.member3_email} onChange={(e) => set('member3_email', e.target.value)} placeholder="email@domain.com" />
                  </div>
                  <div className="field">
                    <label className="label">GitHub <span className="opt">(optional)</span></label>
                    <input value={form.member3_github} onChange={(e) => set('member3_github', e.target.value)} placeholder="github.com/username" />
                  </div>
                </div>
              </div>

              <div className="btn-row">
                <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
                <button className="btn btn-primary" disabled={!canNext3} onClick={() => setStep(4)}>Continue →</button>
              </div>
            </div>
          )}

          {/* Step 4 — Pitch */}
          {step === 4 && (
            <div>
              <div className="card">
                <div className="card-title">Your pitch</div>
                <div className="card-sub">Keyur reviews every application personally. Be specific.</div>

                <div className="field" style={{ marginBottom: 16 }}>
                  <label className="label">Why should we pick your team? <span className="req">*</span></label>
                  <textarea
                    value={form.why_us}
                    onChange={(e) => set('why_us', e.target.value)}
                    placeholder="What makes your team the right one for this track? Mention relevant projects, experience with the stack, or anything that sets you apart..."
                    maxLength={2000}
                    style={{ minHeight: 130 }}
                  />
                  <div className={`char-count${form.why_us.length > 1800 ? ' warn' : ''}`}>
                    {form.why_us.length}/2000
                  </div>
                </div>

                <div className="field" style={{ marginBottom: 16 }}>
                  <label className="label">Tech stack experience <span className="req">*</span></label>
                  <input
                    value={form.stack_experience}
                    onChange={(e) => set('stack_experience', e.target.value)}
                    placeholder="Next.js, Supabase, TypeScript, Tailwind, React..."
                    maxLength={500}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
                    Comma-separated list of tools/languages your team knows well
                  </div>
                </div>

                <div className="field">
                  <label className="label">Portfolio / Project URL <span className="opt">(optional)</span></label>
                  <input
                    value={form.portfolio_url}
                    onChange={(e) => set('portfolio_url', e.target.value)}
                    placeholder="https://github.com/your-project or https://yourapp.vercel.app"
                    maxLength={500}
                  />
                </div>
              </div>

              <div style={{
                background: 'rgba(0,88,160,0.04)', border: '1px solid rgba(0,88,160,0.1)',
                borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontSize: 13,
                color: 'var(--text-2)', lineHeight: 1.6
              }}>
                <strong>By submitting</strong> you confirm all three team members agree to sign a confidentiality &amp; IP
                assignment agreement before accessing any codebase. Applications are reviewed within 5 days.
                Shortlisted teams will be contacted via the lead email.
              </div>

              <div className="btn-row">
                <button className="btn btn-ghost" onClick={() => setStep(3)}>← Back</button>
                <button
                  className="btn btn-primary"
                  disabled={!canSubmit || loading}
                  onClick={submit}
                >
                  {loading ? 'Submitting...' : 'Submit Application →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
