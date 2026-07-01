'use client';

import { useState } from 'react';

const SUPA_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yqyfmnemvedpqnkfraro.supabase.co';
const SUPA_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_A6RAsGDwzLH8vPNiOlb8KA_wY8wg5xW';

type App = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  org: string;
  github_url: string;
  portfolio_url: string | null;
  project_desc: string;
  stack: string;
  track_pref: string;
  hardest_build: string;
  why: string;
  team_status: string;
  team_members: string | null;
  status: string;
};

const CSS = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#FAF8F3;color:#15181C;font-family:'Plus Jakarta Sans',sans-serif;-webkit-font-smoothing:antialiased}
  .serif{font-family:'Fraunces',serif}
  .wrap{max-width:1240px;margin:0 auto;padding:0 22px}

  /* gate */
  .gate{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
  .gate-card{background:#fff;border:1px solid rgba(20,24,28,.09);border-radius:20px;padding:40px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.06);text-align:center}
  .gate-card .dot{width:12px;height:12px;border-radius:50%;background:#0F4D3C;display:inline-block;box-shadow:0 0 0 4px rgba(15,77,60,.1);margin-bottom:18px}
  .gate-card h1{font-size:24px;font-weight:600;margin-bottom:6px}
  .gate-card p{color:#4A4F57;font-size:14px;margin-bottom:24px}
  .gate-card input{width:100%;padding:14px 15px;border:1px solid rgba(20,24,28,.12);border-radius:10px;font-family:inherit;font-size:15px;margin-bottom:14px;text-align:center}
  .gate-card input:focus{outline:none;border-color:#0F4D3C;box-shadow:0 0 0 3px rgba(15,77,60,.08)}
  .gate-err{color:#c0392b;font-size:13px;font-weight:600;margin-bottom:14px}
  .btn{background:#0F4D3C;color:#fff;border:none;font-family:inherit;font-weight:700;font-size:15px;padding:14px 22px;border-radius:11px;cursor:pointer;transition:background .2s,transform .2s}
  .btn:hover{background:#0A3A2D;transform:translateY(-1px)}
  .btn:disabled{opacity:.6;cursor:default;transform:none}
  .btn-sm{padding:7px 12px;font-size:12.5px;font-weight:700;border-radius:8px}
  .btn-ghost{background:transparent;border:1px solid rgba(20,24,28,.16);color:#15181C}
  .btn-ghost:hover{border-color:#0F4D3C;color:#0F4D3C;background:transparent}

  /* dashboard */
  .top{padding:26px 0 18px;border-bottom:1px solid rgba(20,24,28,.09);display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:16px}
  .top h1{font-size:26px;font-weight:600}
  .top .meta{color:#4A4F57;font-size:13.5px;margin-top:3px}
  .top-actions{display:flex;gap:10px}
  .controls{display:flex;justify-content:space-between;align-items:center;gap:14px;margin:20px 0;flex-wrap:wrap}
  .tabs{display:flex;gap:8px;flex-wrap:wrap}
  .tab{padding:8px 14px;border-radius:100px;border:1px solid rgba(20,24,28,.12);background:#fff;font-size:13px;font-weight:600;cursor:pointer;color:#4A4F57;transition:all .15s}
  .tab.active{background:#0F4D3C;color:#fff;border-color:#0F4D3C}
  .tab .n{opacity:.7;margin-left:5px}
  .search{padding:11px 15px;border:1px solid rgba(20,24,28,.12);border-radius:10px;font-family:inherit;font-size:14px;min-width:250px}
  .search:focus{outline:none;border-color:#0F4D3C;box-shadow:0 0 0 3px rgba(15,77,60,.08)}

  .tablewrap{background:#fff;border:1px solid rgba(20,24,28,.09);border-radius:16px;overflow:hidden;box-shadow:0 2px 14px rgba(0,0,0,.02)}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  thead th{text-align:left;padding:14px 16px;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#8B9098;font-weight:700;border-bottom:1px solid rgba(20,24,28,.09);white-space:nowrap}
  tbody td{padding:14px 16px;border-bottom:1px solid rgba(20,24,28,.055);vertical-align:top}
  tbody tr:last-child td{border-bottom:none}
  tbody tr:hover{background:#FAF8F3}
  .nm{font-weight:700;font-size:14px}
  .sub{color:#8B9098;font-size:12px;margin-top:2px}
  .lnk{color:#0F4D3C;font-weight:600;text-decoration:none}
  .lnk:hover{text-decoration:underline}
  .badge{display:inline-block;font-size:11px;font-weight:700;padding:4px 10px;border-radius:100px;text-transform:capitalize}
  .b-pending{background:rgba(139,144,152,.14);color:#5c6472}
  .b-approved{background:rgba(15,77,60,.12);color:#0F4D3C}
  .b-waitlisted{background:rgba(180,120,20,.14);color:#8a5a00}
  .b-rejected{background:rgba(192,57,43,.12);color:#a5271b}
  .acts{display:flex;gap:6px;flex-wrap:wrap}
  .a-app{background:rgba(15,77,60,.1);color:#0F4D3C;border:none;border-radius:7px;padding:6px 10px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit}
  .a-app:hover{background:rgba(15,77,60,.2)}
  .a-wait{background:rgba(180,120,20,.12);color:#8a5a00}
  .a-wait:hover{background:rgba(180,120,20,.22)}
  .a-rej{background:rgba(192,57,43,.1);color:#a5271b}
  .a-rej:hover{background:rgba(192,57,43,.2)}
  .expand{cursor:pointer;color:#0F4D3C;font-weight:700;font-size:12px;background:none;border:none;padding:0;font-family:inherit}
  .detail{background:#FAF8F3;padding:16px;border-radius:10px;margin-top:10px;font-size:13px;line-height:1.6;color:#333}
  .detail b{color:#15181C;display:block;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#8B9098;margin:10px 0 3px}
  .detail b:first-child{margin-top:0}
  .empty{text-align:center;padding:60px 20px;color:#8B9098}
`;

export default function MedHackAdmin() {
  const [pass, setPass] = useState('');
  const [authed, setAuthed] = useState(false);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(false);
  const [gateErr, setGateErr] = useState('');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  async function rpc(fn: string, body: Record<string, unknown>) {
    return fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async function unlock() {
    setGateErr('');
    setLoading(true);
    try {
      const res = await rpc('mh_list_applications', { p_passcode: pass });
      if (res.status === 403 || res.status === 401) {
        setGateErr('Wrong password.');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setGateErr('Something went wrong. Try again.');
        setLoading(false);
        return;
      }
      const data: App[] = await res.json();
      setApps(data);
      setAuthed(true);
      setLoading(false);
    } catch {
      setGateErr('Network error. Try again.');
      setLoading(false);
    }
  }

  async function refresh() {
    const res = await rpc('mh_list_applications', { p_passcode: pass });
    if (res.ok) setApps(await res.json());
  }

  async function setStatus(id: string, status: string) {
    const prev = apps;
    setApps((a) => a.map((x) => (x.id === id ? { ...x, status } : x)));
    const res = await rpc('mh_set_status', { p_passcode: pass, p_id: id, p_status: status });
    if (!res.ok) setApps(prev);
  }

  function exportCsv() {
    const cols: (keyof App)[] = ['created_at', 'name', 'email', 'phone', 'org', 'github_url', 'portfolio_url', 'stack', 'track_pref', 'team_status', 'team_members', 'project_desc', 'hardest_build', 'why', 'status'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [cols.join(','), ...apps.map((a) => cols.map((c) => esc(a[c])).join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `medhack-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const counts = {
    all: apps.length,
    pending: apps.filter((a) => a.status === 'pending').length,
    approved: apps.filter((a) => a.status === 'approved').length,
    waitlisted: apps.filter((a) => a.status === 'waitlisted').length,
    rejected: apps.filter((a) => a.status === 'rejected').length,
  };

  const shown = apps.filter((a) => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return [a.name, a.email, a.org, a.track_pref, a.stack].some((f) => (f || '').toLowerCase().includes(s));
  });

  if (!authed) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="gate">
          <div className="gate-card">
            <span className="dot" />
            <h1 className="serif">MedHackathon &apos;26</h1>
            <p>Applications console</p>
            <input
              type="password"
              placeholder="Password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && unlock()}
            />
            {gateErr && <div className="gate-err">{gateErr}</div>}
            <button className="btn" style={{ width: '100%' }} disabled={loading || !pass} onClick={unlock}>
              {loading ? 'Checking…' : 'Unlock'}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="wrap" style={{ paddingBottom: 60 }}>
        <div className="top">
          <div>
            <h1 className="serif">Applications</h1>
            <div className="meta">Health1 MedHackathon &apos;26 · {counts.all} total · {counts.approved} approved</div>
          </div>
          <div className="top-actions">
            <button className="btn btn-sm btn-ghost" onClick={refresh}>Refresh</button>
            <button className="btn btn-sm btn-ghost" onClick={exportCsv}>Export CSV</button>
            <button className="btn btn-sm btn-ghost" onClick={() => { setAuthed(false); setPass(''); setApps([]); }}>Lock</button>
          </div>
        </div>

        <div className="controls">
          <div className="tabs">
            {(['all', 'pending', 'approved', 'waitlisted', 'rejected'] as const).map((t) => (
              <button key={t} className={`tab${filter === t ? ' active' : ''}`} onClick={() => setFilter(t)}>
                <span style={{ textTransform: 'capitalize' }}>{t}</span><span className="n">{counts[t]}</span>
              </button>
            ))}
          </div>
          <input className="search" placeholder="Search name, email, org, track…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="tablewrap">
          {shown.length === 0 ? (
            <div className="empty">{apps.length === 0 ? 'No applications yet.' : 'No applications match this filter.'}</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Applicant</th><th>Org</th><th>Track</th><th>Team</th><th>GitHub</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="nm">{a.name}</div>
                      <div className="sub">{a.email} · {a.phone}</div>
                      <button className="expand" onClick={() => setOpen((o) => ({ ...o, [a.id]: !o[a.id] }))}>
                        {open[a.id] ? '− hide detail' : '+ detail'}
                      </button>
                      {open[a.id] && (
                        <div className="detail">
                          <b>Stack</b>{a.stack}
                          <b>Project shipped</b>{a.project_desc}
                          <b>Hardest build</b>{a.hardest_build}
                          <b>Why</b>{a.why}
                          {a.portfolio_url && (<><b>Portfolio</b><a className="lnk" href={a.portfolio_url} target="_blank" rel="noreferrer">{a.portfolio_url}</a></>)}
                          {a.team_members && (<><b>Team members</b>{a.team_members}</>)}
                          <b>Applied</b>{new Date(a.created_at).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td>{a.org}</td>
                    <td>{a.track_pref}</td>
                    <td>{a.team_status}</td>
                    <td>{a.github_url ? <a className="lnk" href={a.github_url.startsWith('http') ? a.github_url : `https://${a.github_url}`} target="_blank" rel="noreferrer">view</a> : '—'}</td>
                    <td><span className={`badge b-${a.status}`}>{a.status}</span></td>
                    <td>
                      <div className="acts">
                        <button className="a-app" onClick={() => setStatus(a.id, 'approved')}>Approve</button>
                        <button className="a-app a-wait" onClick={() => setStatus(a.id, 'waitlisted')}>Waitlist</button>
                        <button className="a-app a-rej" onClick={() => setStatus(a.id, 'rejected')}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
