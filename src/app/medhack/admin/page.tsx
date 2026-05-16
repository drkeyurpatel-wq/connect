'use client';

import { useState, useEffect, useCallback } from 'react';

type Reg = {
  id: string; created_at: string; team_name: string; track: string;
  open_track_problem: string | null; status: string;
  lead_name: string; lead_email: string; lead_phone: string; lead_role: string;
  lead_github: string | null; lead_linkedin: string | null;
  member2_name: string; member2_email: string; member2_role: string; member2_github: string | null;
  member3_name: string; member3_email: string; member3_role: string; member3_github: string | null;
  why_us: string; stack_experience: string; portfolio_url: string | null;
  admin_notes: string | null; nda_signed: boolean; slot_number: number | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#F8B800',
  shortlisted: '#0058A0',
  accepted: '#18B098',
  rejected: '#E02010',
  waitlisted: '#9B59B6',
};

const TRACK_COLORS: Record<string, string> = {
  HMIS: '#0058A0', HRMS: '#18B098', VPMS: '#F8B800',
  LIMS: '#E02010', 'Patient Portal': '#9B59B6', Open: '#FF6B35',
};

export default function MedHackAdminPage() {
  const [passcode, setPasscode] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [data, setData] = useState<Reg[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Reg | null>(null);
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const fetchData = useCallback(async (pc: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/medhack/admin', {
        headers: { 'x-admin-passcode': pc },
      });
      if (res.status === 401) { setAuthError('Wrong passcode.'); setAuthed(false); return; }
      const json = await res.json();
      setData(json.data || []);
      setAuthed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  async function login() {
    setAuthError('');
    await fetchData(passcode);
  }

  async function patch(id: string, updates: Partial<Reg>) {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(`/api/medhack/admin/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-passcode': passcode },
        body: JSON.stringify(updates),
      });
      if (!res.ok) { setSaveMsg('Save failed.'); return; }
      setSaveMsg('Saved ✓');
      setData((prev) => prev.map((r) => r.id === id ? { ...r, ...updates } : r));
      if (selected?.id === id) setSelected((s) => s ? { ...s, ...updates } : s);
      setTimeout(() => setSaveMsg(''), 2000);
    } finally {
      setSaving(false);
    }
  }

  const filtered = filter === 'all' ? data : data.filter((r) => r.status === filter);
  const counts = {
    all: data.length,
    pending: data.filter((r) => r.status === 'pending').length,
    shortlisted: data.filter((r) => r.status === 'shortlisted').length,
    accepted: data.filter((r) => r.status === 'accepted').length,
    rejected: data.filter((r) => r.status === 'rejected').length,
  };

  if (!authed) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f0f4f8; }
          .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
          .card { background: #fff; border-radius: 16px; padding: 40px; max-width: 380px; width: 100%;
            box-shadow: 0 8px 40px rgba(0,88,160,0.12); border: 1px solid rgba(0,88,160,0.1); }
          h1 { font-size: 22px; font-weight: 800; color: #0058A0; margin-bottom: 4px; }
          p { font-size: 13px; color: #7a95b0; margin-bottom: 24px; }
          label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #3d5a7a; display: block; margin-bottom: 6px; }
          input { width: 100%; padding: 11px 14px; border: 1.5px solid rgba(0,88,160,0.15); border-radius: 8px;
            font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; outline: none; margin-bottom: 14px; }
          input:focus { border-color: #0058A0; box-shadow: 0 0 0 3px rgba(0,88,160,0.1); }
          button { width: 100%; padding: 12px; background: linear-gradient(135deg, #0058A0, #1a6db5);
            color: #fff; border: none; border-radius: 8px; font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: 14px; font-weight: 700; cursor: pointer; }
          button:hover { opacity: 0.9; }
          .err { color: #E02010; font-size: 13px; margin-top: 10px; }
        `}</style>
        <div className="wrap">
          <div className="card">
            <h1>MedHack Admin</h1>
            <p>Health1 MedHack 2026 — Registrations</p>
            <label>Admin Passcode</label>
            <input
              type="password" value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && login()}
              placeholder="Enter passcode"
            />
            <button onClick={login}>Sign In →</button>
            {authError && <p className="err">⚠ {authError}</p>}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f0f4f8; color: #0f1e2e; }

        .header {
          background: linear-gradient(135deg, #003d73, #0058A0);
          padding: 16px 24px; display: flex; align-items: center;
          justify-content: space-between; gap: 16px;
          position: sticky; top: 0; z-index: 100;
        }
        .header-title { font-size: 16px; font-weight: 800; color: #fff; }
        .header-sub { font-size: 12px; color: rgba(255,255,255,0.6); }
        .refresh-btn {
          padding: 7px 14px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2);
          color: #fff; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .refresh-btn:hover { background: rgba(255,255,255,0.2); }

        .main { display: flex; height: calc(100vh - 57px); }

        /* Sidebar */
        .sidebar { width: 320px; flex-shrink: 0; overflow-y: auto; border-right: 1px solid rgba(0,88,160,0.1); background: #fff; }
        .filters { padding: 12px; border-bottom: 1px solid rgba(0,88,160,0.1); display: flex; gap: 6px; flex-wrap: wrap; }
        .filter-btn {
          padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;
          cursor: pointer; border: 1.5px solid rgba(0,88,160,0.15); background: #f5f8fc;
          color: #3d5a7a; font-family: 'Plus Jakarta Sans', sans-serif;
          transition: all 0.15s;
        }
        .filter-btn.active { background: #0058A0; color: #fff; border-color: #0058A0; }

        .reg-list { padding: 8px; }
        .reg-item {
          padding: 12px; border-radius: 10px; cursor: pointer;
          border: 1.5px solid transparent; margin-bottom: 6px;
          transition: all 0.15s; background: #f8fafb;
        }
        .reg-item:hover { background: #eef4fb; border-color: rgba(0,88,160,0.15); }
        .reg-item.selected { background: #e8f0fb; border-color: #0058A0; }
        .reg-team { font-size: 14px; font-weight: 700; color: #0f1e2e; margin-bottom: 4px; }
        .reg-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .badge {
          padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.3px;
        }
        .reg-email { font-size: 11px; color: #7a95b0; margin-top: 3px; }

        /* Detail panel */
        .detail { flex: 1; overflow-y: auto; padding: 24px; }
        .empty-state {
          height: 100%; display: flex; align-items: center; justify-content: center;
          color: #7a95b0; font-size: 15px;
        }

        .detail-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; margin-bottom: 20px; flex-wrap: wrap;
        }
        .detail-title { font-size: 22px; font-weight: 800; color: #0f1e2e; margin-bottom: 6px; }
        .detail-badges { display: flex; gap: 8px; flex-wrap: wrap; }

        .section { background: #fff; border: 1px solid rgba(0,88,160,0.1); border-radius: 12px; padding: 20px; margin-bottom: 16px; }
        .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #7a95b0; margin-bottom: 14px; }

        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 700px) { .grid2 { grid-template-columns: 1fr; } }
        .field-label { font-size: 11px; font-weight: 600; color: #7a95b0; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 3px; }
        .field-val { font-size: 14px; color: #0f1e2e; font-weight: 500; }
        .field-val a { color: #0058A0; text-decoration: none; }
        .field-val a:hover { text-decoration: underline; }

        .pitch-text { font-size: 14px; color: #3d5a7a; line-height: 1.7; white-space: pre-wrap; }

        .admin-section { background: #fff; border: 1.5px solid #0058A0; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
        .admin-section .section-title { color: #0058A0; }

        select.status-sel {
          font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 600;
          padding: 8px 12px; border: 1.5px solid rgba(0,88,160,0.2); border-radius: 8px;
          outline: none; background: #f5f8fc; cursor: pointer; color: #0f1e2e;
          margin-right: 8px;
        }
        textarea.notes-ta {
          width: 100%; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px;
          padding: 10px 12px; border: 1.5px solid rgba(0,88,160,0.15); border-radius: 8px;
          resize: vertical; min-height: 80px; outline: none; color: #0f1e2e;
          background: #f5f8fc; margin-top: 10px;
        }
        textarea.notes-ta:focus { border-color: #0058A0; box-shadow: 0 0 0 3px rgba(0,88,160,0.1); background: #fff; }

        .save-btn {
          margin-top: 10px; padding: 9px 20px; background: linear-gradient(135deg, #0058A0, #1a6db5);
          color: #fff; border: none; border-radius: 7px; font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 13px; font-weight: 700; cursor: pointer;
        }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .save-msg { font-size: 12px; color: #18B098; font-weight: 600; margin-left: 10px; }

        .nda-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
        .nda-label { font-size: 13px; font-weight: 600; color: #3d5a7a; }
        input[type="checkbox"] { width: 16px; height: 16px; accent-color: #18B098; cursor: pointer; }
      `}</style>

      <div>
        <div className="header">
          <div>
            <div className="header-title">MedHack 2026 — Admin</div>
            <div className="header-sub">{data.length} registrations total · {counts.accepted} accepted · {counts.shortlisted} shortlisted</div>
          </div>
          <button className="refresh-btn" onClick={() => fetchData(passcode)}>
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        </div>

        <div className="main">
          {/* Sidebar */}
          <div className="sidebar">
            <div className="filters">
              {(['all', 'pending', 'shortlisted', 'accepted', 'rejected'] as const).map((f) => (
                <button
                  key={f}
                  className={`filter-btn${filter === f ? ' active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f} ({counts[f as keyof typeof counts] ?? data.filter(r => r.status === f).length})
                </button>
              ))}
            </div>
            <div className="reg-list">
              {loading && <div style={{ padding: 20, color: '#7a95b0', fontSize: 13 }}>Loading...</div>}
              {!loading && filtered.length === 0 && (
                <div style={{ padding: 20, color: '#7a95b0', fontSize: 13 }}>No registrations.</div>
              )}
              {filtered.map((r) => (
                <div
                  key={r.id}
                  className={`reg-item${selected?.id === r.id ? ' selected' : ''}`}
                  onClick={() => { setSelected(r); setEditNotes(r.admin_notes || ''); }}
                >
                  <div className="reg-team">{r.team_name}</div>
                  <div className="reg-meta">
                    <span
                      className="badge"
                      style={{
                        background: `${TRACK_COLORS[r.track] || '#666'}22`,
                        color: TRACK_COLORS[r.track] || '#666',
                      }}
                    >{r.track}</span>
                    <span
                      className="badge"
                      style={{
                        background: `${STATUS_COLORS[r.status] || '#888'}22`,
                        color: STATUS_COLORS[r.status] || '#888',
                      }}
                    >{r.status}</span>
                  </div>
                  <div className="reg-email">{r.lead_name} · {r.lead_email}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Detail */}
          <div className="detail">
            {!selected ? (
              <div className="empty-state">← Select a registration to review</div>
            ) : (
              <div>
                <div className="detail-header">
                  <div>
                    <div className="detail-title">{selected.team_name}</div>
                    <div className="detail-badges">
                      <span className="badge" style={{ background: `${TRACK_COLORS[selected.track]}22`, color: TRACK_COLORS[selected.track], fontSize: 12, padding: '3px 10px' }}>
                        {selected.track}{selected.open_track_problem ? ` · ${selected.open_track_problem}` : ''}
                      </span>
                      <span className="badge" style={{ background: `${STATUS_COLORS[selected.status]}22`, color: STATUS_COLORS[selected.status], fontSize: 12, padding: '3px 10px' }}>
                        {selected.status}
                      </span>
                      {selected.nda_signed && (
                        <span className="badge" style={{ background: '#18B09822', color: '#18B098', fontSize: 12, padding: '3px 10px' }}>NDA ✓</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#7a95b0' }}>
                    {new Date(selected.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>

                {/* Admin controls */}
                <div className="admin-section">
                  <div className="section-title">Admin Controls</div>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <select
                      className="status-sel"
                      value={selected.status}
                      onChange={(e) => patch(selected.id, { status: e.target.value as Reg['status'] })}
                    >
                      {['pending', 'shortlisted', 'accepted', 'rejected', 'waitlisted'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {saving && <span style={{ fontSize: 12, color: '#7a95b0' }}>Saving...</span>}
                    {saveMsg && <span className="save-msg">{saveMsg}</span>}
                  </div>
                  <textarea
                    className="notes-ta"
                    placeholder="Admin notes (visible only to you)..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <button
                      className="save-btn"
                      disabled={saving}
                      onClick={() => patch(selected.id, { admin_notes: editNotes })}
                    >
                      Save Notes
                    </button>
                    <div className="nda-row">
                      <input
                        type="checkbox"
                        id="nda"
                        checked={selected.nda_signed}
                        onChange={(e) => patch(selected.id, { nda_signed: e.target.checked })}
                      />
                      <label htmlFor="nda" className="nda-label">NDA Signed</label>
                    </div>
                  </div>
                </div>

                {/* Team Lead */}
                <div className="section">
                  <div className="section-title">Team Lead</div>
                  <div className="grid2">
                    <div><div className="field-label">Name</div><div className="field-val">{selected.lead_name}</div></div>
                    <div><div className="field-label">Role</div><div className="field-val">{selected.lead_role}</div></div>
                    <div><div className="field-label">Email</div><div className="field-val"><a href={`mailto:${selected.lead_email}`}>{selected.lead_email}</a></div></div>
                    <div><div className="field-label">Phone</div><div className="field-val">{selected.lead_phone}</div></div>
                    {selected.lead_github && <div><div className="field-label">GitHub</div><div className="field-val"><a href={selected.lead_github} target="_blank" rel="noreferrer">{selected.lead_github}</a></div></div>}
                    {selected.lead_linkedin && <div><div className="field-label">LinkedIn</div><div className="field-val"><a href={selected.lead_linkedin} target="_blank" rel="noreferrer">View Profile</a></div></div>}
                  </div>
                </div>

                {/* Members */}
                <div className="section">
                  <div className="section-title">Team Members</div>
                  <div className="grid2" style={{ marginBottom: 16 }}>
                    <div><div className="field-label">Member 2 Name</div><div className="field-val">{selected.member2_name}</div></div>
                    <div><div className="field-label">Member 2 Role</div><div className="field-val">{selected.member2_role}</div></div>
                    <div><div className="field-label">Member 2 Email</div><div className="field-val"><a href={`mailto:${selected.member2_email}`}>{selected.member2_email}</a></div></div>
                    {selected.member2_github && <div><div className="field-label">Member 2 GitHub</div><div className="field-val"><a href={selected.member2_github} target="_blank" rel="noreferrer">{selected.member2_github}</a></div></div>}
                  </div>
                  <div style={{ height: 1, background: 'rgba(0,88,160,0.08)', margin: '0 0 16px' }} />
                  <div className="grid2">
                    <div><div className="field-label">Member 3 Name</div><div className="field-val">{selected.member3_name}</div></div>
                    <div><div className="field-label">Member 3 Role</div><div className="field-val">{selected.member3_role}</div></div>
                    <div><div className="field-label">Member 3 Email</div><div className="field-val"><a href={`mailto:${selected.member3_email}`}>{selected.member3_email}</a></div></div>
                    {selected.member3_github && <div><div className="field-label">Member 3 GitHub</div><div className="field-val"><a href={selected.member3_github} target="_blank" rel="noreferrer">{selected.member3_github}</a></div></div>}
                  </div>
                </div>

                {/* Pitch */}
                <div className="section">
                  <div className="section-title">Pitch</div>
                  <div style={{ marginBottom: 16 }}>
                    <div className="field-label" style={{ marginBottom: 6 }}>Why pick this team?</div>
                    <div className="pitch-text">{selected.why_us}</div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div className="field-label" style={{ marginBottom: 4 }}>Stack Experience</div>
                    <div className="field-val">{selected.stack_experience}</div>
                  </div>
                  {selected.portfolio_url && (
                    <div>
                      <div className="field-label" style={{ marginBottom: 4 }}>Portfolio</div>
                      <div className="field-val"><a href={selected.portfolio_url} target="_blank" rel="noreferrer">{selected.portfolio_url}</a></div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
