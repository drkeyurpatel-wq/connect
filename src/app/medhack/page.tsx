'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/browser';

const CSS = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500;1,9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  :root{
    --bg:#FAF8F3;
    --bg-2:#F1EEE6;
    --surface:#FFFFFF;
    --card:#FFFFFF;
    --border:rgba(20,24,28,0.09);
    --border-2:rgba(20,24,28,0.18);
    --text:#15181C;
    --text-2:#4A4F57;
    --muted:#8B9098;
    --accent:#0F4D3C;
    --accent-deep:#0A3A2D;
    --accent-glow:rgba(15,77,60,0.10);
    --accent-tint:rgba(15,77,60,0.07);
    --warn:#0F4D3C;
    --radius:16px;
    --maxw:1140px;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{
    background:var(--bg);
    color:var(--text);
    font-family:'Plus Jakarta Sans',sans-serif;
    line-height:1.65;
    -webkit-font-smoothing:antialiased;
    overflow-x:hidden;
  }
  h1,h2,h3,.display{font-family:'Fraunces',serif;letter-spacing:-0.01em;line-height:1.05;font-weight:600}
  .mono{font-family:'Plus Jakarta Sans',sans-serif}
  a{color:inherit;text-decoration:none}
  .wrap{max-width:var(--maxw);margin:0 auto;padding:0 24px}
  .accent{color:var(--accent)}

  /* ---------- NAV ---------- */
  nav{
    position:fixed;top:0;left:0;right:0;z-index:50;
    backdrop-filter:blur(14px);
    background:rgba(250,248,243,0.80);
    border-bottom:1px solid transparent;
    transition:border-color .3s, background .3s, box-shadow .3s;
  }
  nav.scrolled{border-bottom:1px solid var(--border);background:rgba(250,248,243,0.92);box-shadow:0 1px 20px rgba(0,0,0,0.03)}
  .nav-inner{display:flex;align-items:center;justify-content:space-between;height:64px}
  .logo{display:flex;align-items:center;gap:10px;font-weight:800;font-size:18px;letter-spacing:-0.3px}
  .logo .dot{width:11px;height:11px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 4px var(--accent-tint)}
  .logo small{font-weight:500;color:var(--text-2);font-size:13px;font-family:'Plus Jakarta Sans'}
  .nav-links{display:flex;align-items:center;gap:28px}
  .nav-links a{color:var(--text-2);font-size:14px;font-weight:600;transition:color .2s}
  .nav-links a:hover{color:var(--accent)}
  .btn{
    display:inline-flex;align-items:center;gap:8px;
    font-family:'Plus Jakarta Sans';font-weight:700;font-size:14px;
    padding:11px 20px;border-radius:10px;cursor:pointer;border:none;
    transition:transform .2s, box-shadow .2s, background .2s;
  }
  .btn-primary{
    background:var(--accent);
    color:#fff;
    box-shadow:0 8px 24px -8px var(--accent-glow);
  }
  .btn-primary:hover{transform:translateY(-2px);background:var(--accent-deep);box-shadow:0 14px 32px -8px var(--accent-glow)}
  .btn-ghost{background:transparent;border:1px solid var(--border-2);color:var(--text)}
  .btn-ghost:hover{border-color:var(--accent);color:var(--accent);transform:translateY(-2px)}
  .btn-lg{padding:15px 28px;font-size:15px}
  @media(max-width:760px){.nav-links a:not(.btn){display:none}}

  /* ---------- HERO ---------- */
  header{position:relative;padding:150px 0 90px;overflow:hidden}
  .glow{position:absolute;border-radius:50%;filter:blur(90px);z-index:0;pointer-events:none}
  .glow.g1{width:560px;height:560px;background:var(--accent);top:-200px;right:-140px;opacity:.07}
  .glow.g2{width:420px;height:420px;background:var(--accent);bottom:-180px;left:-140px;opacity:.05}
  .hero{position:relative;z-index:2;max-width:900px}
  .pill{
    display:inline-flex;align-items:center;gap:9px;
    background:var(--accent-tint);color:var(--accent);
    border:1px solid rgba(15,77,60,0.18);
    padding:7px 14px;border-radius:100px;font-size:12.5px;font-weight:700;
    letter-spacing:.3px;margin-bottom:26px;
  }
  .pill .live{width:7px;height:7px;border-radius:50%;background:var(--accent);animation:pulse 2s infinite}
  @keyframes pulse{0%{opacity:1}50%{opacity:.35}100%{opacity:1}}
  header h1{font-size:clamp(38px,6.4vw,70px);font-weight:600;margin-bottom:22px}
  header h1 .stroke{color:var(--accent);font-style:italic}
  .sub{font-size:clamp(17px,2.2vw,21px);color:var(--text-2);max-width:640px;margin-bottom:14px;line-height:1.55}
  .meta-row{display:flex;flex-wrap:wrap;gap:14px;margin:30px 0 34px}
  .meta{display:flex;align-items:center;gap:9px;background:var(--surface);border:1px solid var(--border);padding:11px 16px;border-radius:12px;font-size:14px;font-weight:500}
  .meta b{font-weight:700;color:var(--text)}
  .meta span{color:var(--text-2)}
  .meta .ic{color:var(--accent)}
  .hero-cta{display:flex;flex-wrap:wrap;gap:14px}

  /* ---------- COUNTDOWN ---------- */
  .countdown{display:flex;gap:12px;margin-top:42px}
  .cd-box{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px 8px;text-align:center;min-width:78px;flex:1;max-width:104px;box-shadow:0 2px 10px rgba(0,0,0,0.02)}
  .cd-box .num{font-family:'Fraunces',serif;font-size:34px;font-weight:600;color:var(--accent);line-height:1}
  .cd-box .lbl{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-top:8px;font-weight:700}

  /* ---------- SECTIONS ---------- */
  section{padding:84px 0;position:relative}
  section.alt{background:var(--bg-2);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
  .eyebrow{font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent);margin-bottom:14px}
  .sec-title{font-size:clamp(28px,4vw,42px);font-weight:600;margin-bottom:16px;max-width:720px}
  .sec-intro{font-size:17px;color:var(--text-2);max-width:640px;margin-bottom:48px;line-height:1.6}

  /* reveal */
  .reveal{opacity:0;transform:translateY(28px);transition:opacity .7s ease,transform .7s ease}
  .reveal.visible{opacity:1;transform:translateY(0)}

  /* ---------- WHY CARDS ---------- */
  .grid{display:grid;gap:18px}
  .grid-4{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
  .grid-3{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
  .grid-2{grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}
  .card{
    background:var(--card);border:1px solid var(--border);border-radius:var(--radius);
    padding:26px;transition:transform .25s,border-color .25s,box-shadow .25s;position:relative;overflow:hidden;
  }
  .card:hover{transform:translateY(-4px);border-color:rgba(15,77,60,0.25);box-shadow:0 16px 40px rgba(0,0,0,0.06)}
  .card .ic-box{width:46px;height:46px;border-radius:12px;background:var(--accent-tint);display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:18px}
  .card h3{font-size:19px;font-weight:700;margin-bottom:9px;font-family:'Plus Jakarta Sans';letter-spacing:-0.3px}
  .card p{font-size:14.5px;color:var(--text-2)}
  .card .tag{position:absolute;top:18px;right:18px;font-size:11px;font-weight:700;color:var(--accent);background:var(--accent-tint);padding:4px 9px;border-radius:6px;letter-spacing:.4px}

  /* ---------- FUNNEL ---------- */
  .funnel{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:10px}
  .stage{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:26px;position:relative}
  .stage .step{font-family:'Plus Jakarta Sans';font-size:12px;color:var(--accent);font-weight:700;margin-bottom:14px;letter-spacing:1px}
  .stage h3{font-size:20px;margin-bottom:10px;font-family:'Plus Jakarta Sans';font-weight:700;letter-spacing:-0.3px}
  .stage p{font-size:14px;color:var(--text-2)}
  .stage .arrow{position:absolute;right:-20px;top:50%;transform:translateY(-50%);color:var(--accent);font-size:22px;z-index:3}
  @media(max-width:980px){.stage .arrow{display:none}}

  /* ---------- TRACKS ---------- */
  .track{
    background:var(--card);border:1px solid var(--border);border-radius:var(--radius);
    padding:24px 26px;transition:transform .25s,border-color .25s,box-shadow .25s;display:flex;gap:18px;align-items:flex-start;
  }
  .track:hover{transform:translateY(-4px);border-color:rgba(15,77,60,0.25);box-shadow:0 16px 40px rgba(0,0,0,0.06)}
  .track .no{font-family:'Fraunces',serif;font-size:26px;font-weight:600;color:var(--accent);min-width:42px;line-height:1}
  .track h3{font-size:18px;font-weight:700;margin-bottom:6px;font-family:'Plus Jakarta Sans';letter-spacing:-0.3px}
  .track p{font-size:14px;color:var(--text-2)}
  .track.flagship{border-color:rgba(15,77,60,0.30);background:linear-gradient(135deg,rgba(15,77,60,0.05),transparent)}
  .track.flagship .flag{display:inline-block;margin-top:10px;font-size:12px;color:var(--accent);background:var(--accent-tint);padding:4px 10px;border-radius:6px;font-weight:700}

  /* ---------- PRIZES ---------- */
  .prize-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
  .prize{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:30px 26px;text-align:center;position:relative}
  .prize.win{border:none;background:linear-gradient(160deg,var(--accent),var(--accent-deep));color:#fff}
  .prize .rank{font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text-2);margin-bottom:12px}
  .prize.win .rank{color:rgba(255,255,255,0.85)}
  .prize .amt{font-family:'Fraunces',serif;font-size:42px;font-weight:600;margin-bottom:6px}
  .prize.win .amt.accent{color:#fff}
  .prize .per{font-size:13px;color:var(--muted)}
  .prize.win .per{color:rgba(255,255,255,0.75)}
  .prize .note{font-size:13.5px;color:var(--text-2);margin-top:14px}
  .prize.win .note{color:rgba(255,255,255,0.9)}
  .seat-banner{margin-top:22px;background:var(--accent-tint);border:1px solid rgba(15,77,60,0.2);border-radius:var(--radius);padding:26px 28px;display:flex;gap:20px;align-items:center;flex-wrap:wrap}
  .seat-banner .big{font-family:'Fraunces',serif;font-size:21px;font-weight:600;flex:1;min-width:260px}
  .seat-banner .big span{color:var(--accent)}

  /* ---------- TIMELINE ---------- */
  .days{display:grid;grid-template-columns:1fr 1fr;gap:22px}
  @media(max-width:760px){.days{grid-template-columns:1fr}}
  .day{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:28px}
  .day h3{font-size:20px;margin-bottom:4px;font-family:'Plus Jakarta Sans';font-weight:700}
  .day .date{font-size:13px;color:var(--accent);font-weight:700;margin-bottom:20px;font-family:'Plus Jakarta Sans';letter-spacing:.5px}
  .tl{list-style:none}
  .tl li{display:flex;gap:14px;padding:9px 0;font-size:14.5px;border-bottom:1px solid var(--border)}
  .tl li:last-child{border-bottom:none}
  .tl .t{font-family:'Plus Jakarta Sans';font-size:13px;color:var(--accent);min-width:62px;font-weight:700}
  .tl .e{color:var(--text-2)}
  .tl .e b{color:var(--text);font-weight:700}

  /* ---------- CRITERIA ---------- */
  .crit-list{display:grid;gap:14px}
  .crit{display:flex;gap:14px;align-items:flex-start;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px}
  .crit .w{font-family:'Fraunces',serif;font-weight:600;color:var(--accent);font-size:18px;min-width:46px}
  .crit b{font-weight:700}
  .crit span{color:var(--text-2);font-size:14px}

  /* ---------- FORM ---------- */
  .form-card{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:36px;max-width:760px;margin:0 auto;box-shadow:0 20px 60px rgba(0,0,0,0.05)}
  .frow{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
  @media(max-width:640px){.frow{grid-template-columns:1fr}}
  .field{display:flex;flex-direction:column;gap:7px;margin-bottom:16px}
  .field label{font-size:11.5px;text-transform:uppercase;letter-spacing:.7px;font-weight:700;color:var(--text-2)}
  .field label .req{color:var(--accent)}
  .field input,.field select,.field textarea{
    background:#fff;border:1px solid var(--border);border-radius:9px;
    padding:13px 14px;color:var(--text);font-family:'Plus Jakarta Sans';font-size:14.5px;width:100%;transition:border-color .2s,box-shadow .2s;
  }
  .field input::placeholder,.field textarea::placeholder{color:#b8bcc2}
  .field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-tint)}
  .field textarea{resize:vertical;min-height:74px}
  .field .hint{font-size:12px;color:var(--muted)}
  .check{display:flex;gap:11px;align-items:flex-start;font-size:13.5px;color:var(--text-2);margin-bottom:12px;cursor:pointer}
  .check input{margin-top:3px;accent-color:var(--accent);width:16px;height:16px;flex-shrink:0}
  .form-success{text-align:center;padding:40px 20px;display:none}
  .form-success .big{font-size:26px;font-family:'Fraunces',serif;font-weight:600;margin-bottom:10px}
  .form-success .big .accent{color:var(--accent)}
  .form-success p{color:var(--text-2);max-width:440px;margin:0 auto}
  .form-note{font-size:12.5px;color:var(--muted);text-align:center;margin-top:18px}

  /* ---------- FOOTER ---------- */
  footer{padding:54px 0 40px;border-top:1px solid var(--border);background:var(--bg-2)}
  .foot-inner{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px}
  .foot-inner p{font-size:13px;color:var(--muted)}
  .foot-links{display:flex;gap:22px}
  .foot-links a{font-size:13px;color:var(--text-2);transition:color .2s}
  .foot-links a:hover{color:var(--accent)}
  .placeholder-flag{background:var(--accent-tint);border:1px dashed rgba(15,77,60,0.4);color:var(--accent);font-size:12px;padding:3px 8px;border-radius:5px;font-weight:700;letter-spacing:.3px}
`;

type FormState = {
  name: string; email: string; phone: string; org: string;
  github_url: string; portfolio_url: string; project_desc: string;
  stack: string; track_pref: string; hardest_build: string; why: string;
  team_status: string; team_members: string;
};

const EMPTY: FormState = {
  name: '', email: '', phone: '', org: '', github_url: '', portfolio_url: '',
  project_desc: '', stack: '', track_pref: '', hardest_build: '', why: '',
  team_status: '', team_members: '',
};

export default function MedHackPage() {
  const [cd, setCd] = useState({ d: '--', h: '--', m: '--', s: '--' });
  const [scrolled, setScrolled] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [c3, setC3] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const target = new Date('2026-07-25T08:00:00+05:30').getTime();
    const tick = () => {
      let d = target - Date.now();
      if (d < 0) d = 0;
      const days = Math.floor(d / 86400000);
      const hrs = Math.floor((d % 86400000) / 3600000);
      const min = Math.floor((d % 3600000) / 60000);
      const sec = Math.floor((d % 60000) / 1000);
      setCd({
        d: String(days).padStart(2, '0'),
        h: String(hrs).padStart(2, '0'),
        m: String(min).padStart(2, '0'),
        s: String(sec).padStart(2, '0'),
      });
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [submitted]);

  async function submitForm() {
    setErrorMsg('');
    const required: (keyof FormState)[] = [
      'name', 'email', 'phone', 'org', 'github_url', 'project_desc',
      'stack', 'track_pref', 'hardest_build', 'why', 'team_status',
    ];
    const missing = required.filter((k) => !form[k].trim());
    if (missing.length) {
      setErrorMsg('Please fill all required (*) fields.');
      return;
    }
    if (!c1 || !c2 || !c3) {
      setErrorMsg('Please confirm all three checkboxes to apply.');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('mh_submit_application', {
        p_name: form.name,
        p_email: form.email,
        p_phone: form.phone,
        p_org: form.org,
        p_github_url: form.github_url,
        p_portfolio_url: form.portfolio_url,
        p_project_desc: form.project_desc,
        p_stack: form.stack,
        p_track_pref: form.track_pref,
        p_hardest_build: form.hardest_build,
        p_why: form.why,
        p_team_status: form.team_status,
        p_team_members: form.team_members,
      });
      if (error) {
        setSubmitting(false);
        setErrorMsg('Something went wrong submitting. Please try again.');
        return;
      }
      setSubmitting(false);
      setSubmitted(true);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSubmitting(false);
      setErrorMsg('Network error. Please try again.');
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <nav id="nav" className={scrolled ? 'scrolled' : ''}>
        <div className="wrap nav-inner">
          <a href="#top" className="logo"><span className="dot" />Health1 <small>MedHackathon &apos;26</small></a>
          <div className="nav-links">
            <a href="#why">Why</a>
            <a href="#tracks">Tracks</a>
            <a href="#prizes">Prizes</a>
            <a href="#format">Format</a>
            <a href="#apply" className="btn btn-primary">Apply →</a>
          </div>
        </div>
      </nav>

      <header id="top">
        <div className="glow g1" />
        <div className="glow g2" />
        <div className="wrap hero">
          <div className="pill"><span className="live" />Applications open · 20 seats only</div>
          <h1>Build real healthcare software.<br /><span className="stroke">Inside a real hospital.</span></h1>
          <p className="sub">A 30-hour build sprint where developers ship production-grade software on the actual hospital floor — beside the doctors, nurses, billing desks and OT teams whose problems they&apos;re solving.</p>
          <div className="meta-row">
            <div className="meta"><span className="ic">◆</span><span>When</span><b>Sat–Sun, July 25–26</b></div>
            <div className="meta"><span className="ic">◆</span><span>Where</span><b>Health1, Shilaj + a café on SBR</b></div>
            <div className="meta"><span className="ic">◆</span><span>Format</span><b>5 teams × 4 builders</b></div>
          </div>
          <div className="hero-cta">
            <a href="#apply" className="btn btn-primary btn-lg">Apply to build →</a>
            <a href="#why" className="btn btn-ghost btn-lg">What&apos;s the catch?</a>
          </div>
          <div className="countdown" id="countdown">
            <div className="cd-box"><div className="num">{cd.d}</div><div className="lbl">Days</div></div>
            <div className="cd-box"><div className="num">{cd.h}</div><div className="lbl">Hours</div></div>
            <div className="cd-box"><div className="num">{cd.m}</div><div className="lbl">Mins</div></div>
            <div className="cd-box"><div className="num">{cd.s}</div><div className="lbl">Secs</div></div>
          </div>
        </div>
      </header>

      <section id="why">
        <div className="wrap">
          <div className="reveal">
            <div className="eyebrow">Why this isn&apos;t another hackathon</div>
            <h2 className="sec-title">Most hackathons hand you a theme and a pizza. We put you inside a working hospital.</h2>
            <p className="sec-intro">The reward isn&apos;t a cheque you forget by Monday. The strongest teams join our healthtech vertical and carry their work all the way to production — real product, real users.</p>
          </div>
          <div className="grid grid-4">
            <div className="card reveal"><div className="ic-box">🏥</div><h3>Deep floor access</h3><p>Build beside the people who live the problem — doctors, nurses, TPA desks, OT managers and real patients. No other hackathon can put you there.</p></div>
            <div className="card reveal"><div className="ic-box">🧩</div><h3>Join the vertical</h3><p>Standout teams join our healthtech vertical to take their work to production — flexed to your life: full-time, part-time, or remote.</p></div>
            <div className="card reveal"><div className="ic-box">🚀</div><h3>Real product, real users</h3><p>You&apos;re not shipping a throwaway demo. The strongest work goes live across a real, growing hospital network.</p></div>
            <div className="card reveal"><div className="ic-box">💰</div><h3>Cash + portfolio</h3><p>₹1,50,000 in team prizes, plus production code running inside a real hospital on your portfolio.</p></div>
          </div>
        </div>
      </section>

      <section className="alt" id="funnel">
        <div className="wrap">
          <div className="reveal">
            <div className="eyebrow">The path</div>
            <h2 className="sec-title">The sprint is the audition. The work is what comes after.</h2>
            <p className="sec-intro">The weekend is how you prove it. What follows is the real opportunity.</p>
          </div>
          <div className="funnel">
            <div className="stage reveal"><div className="step">01 / SPRINT</div><h3>The weekend</h3><p>30 hours on the floor. Ship a working build against a real problem, and prove how you build under pressure.</p><div className="arrow">→</div></div>
            <div className="stage reveal"><div className="step">02 / PRODUCTION</div><h3>Take it to production</h3><p>The strongest teams keep building with us on live product — on terms that fit your life: full-time, part-time or remote.</p><div className="arrow">→</div></div>
            <div className="stage reveal"><div className="step">03 / VERTICAL</div><h3>Shape the vertical</h3><p>The very best become part of the core team building our new healthtech vertical.</p></div>
          </div>
        </div>
      </section>

      <section id="tracks">
        <div className="wrap">
          <div className="reveal">
            <div className="eyebrow">Choose your battle</div>
            <h2 className="sec-title">Six tracks. Every one a real, unsolved problem inside the hospital.</h2>
            <p className="sec-intro">Each team draws one track and builds a working slice on our stack — Next.js + Supabase, deployed live against a sandbox with realistic data. Slideware scores zero.</p>
          </div>
          <div className="grid grid-2">
            <div className="track reveal"><div className="no">01</div><div><h3>HRMS — Workforce Backbone</h3><p>The backbone of a 24/7 hospital — attendance and biometrics, payroll and statutory compliance, rostering, leave, and the audit trail that has to hold all of it together.</p></div></div>
            <div className="track reveal"><div className="no">02</div><div><h3>VPMS — Procure-to-Pay</h3><p>Vendor onboarding, quotations, purchase orders, goods receipt and reconciliation — where every rupee and every consumable has to trace back cleanly.</p></div></div>
            <div className="track reveal"><div className="no">03</div><div><h3>Insurance / RCM — Revenue Cycle</h3><p>Eligibility, pre-authorisation, claims, denials and reconciliation across cashless and reimbursement. The hardest, highest-leverage money problem in Indian healthcare.</p></div></div>
            <div className="track reveal"><div className="no">04</div><div><h3>Patient Portal — Self-Service</h3><p>Appointments, reports, records, payments and follow-ups — self-service done well enough to actually take load off the front desk.</p></div></div>
            <div className="track flagship reveal"><div className="no">05</div><div><h3>HMIS — Integrated Core</h3><p>The flagship, and the core hospital operating system — registration, EMR, orders, billing, pharmacy, OT, IPD and OPD. Take a real slice and make the modules talk to each other cleanly. Judged on integration, not polish.</p><span className="flag">Hardest track — strongest signal</span></div></div>
            <div className="track reveal"><div className="no">06</div><div><h3>Wildcard — Your Idea</h3><p>Bring your own healthtech idea, or find a real gap on Saturday&apos;s hospital floor walk. If it would genuinely move a hospital forward, it belongs here.</p></div></div>
          </div>
        </div>
      </section>

      <section className="alt" id="prizes">
        <div className="wrap">
          <div className="reveal">
            <div className="eyebrow">What you walk away with</div>
            <h2 className="sec-title">Team prizes — because this is a team build.</h2>
            <p className="sec-intro">Cash opens the door. The work that follows is what makes the serious builders go all in.</p>
          </div>
          <div className="prize-grid">
            <div className="prize win reveal"><div className="rank">★ Winning team</div><div className="amt accent">₹1,00,000</div><div className="per">≈ ₹25,000 per builder</div><div className="note">+ first call to join the healthtech vertical and take the work to production</div></div>
            <div className="prize reveal"><div className="rank">Runner-up team</div><div className="amt">₹50,000</div><div className="per">≈ ₹12,500 per builder</div><div className="note">+ standout teams stay in the conversation</div></div>
            <div className="prize reveal"><div className="rank">Every participant</div><div className="amt" style={{ fontSize: '26px', lineHeight: 1.3 }}>Honorarium<br />+ certificate</div><div className="note">Swag, all meals, and dinner with Health1&apos;s clinical leadership. Nobody leaves empty-handed.</div></div>
          </div>
          <div className="seat-banner reveal">
            <div className="big">The real prize: <span>a place in the healthtech vertical we&apos;re building — taking real product to production.</span></div>
            <a href="#apply" className="btn btn-primary btn-lg">Apply now →</a>
          </div>
        </div>
      </section>

      <section id="format">
        <div className="wrap">
          <div className="reveal">
            <div className="eyebrow">How the weekend runs</div>
            <h2 className="sec-title">One continuous sprint. Saturday morning to Sunday dinner.</h2>
            <p className="sec-intro">Anchored at Health1 Shilaj. Teams who prefer a quieter build can decamp to a café on Sindhu Bhavan Road <span className="placeholder-flag">TO BE ANNOUNCED</span> during open build hours — back at the hospital for the 5 PM Sunday code freeze.</p>
          </div>
          <div className="days">
            <div className="day reveal">
              <h3>Saturday</h3>
              <div className="date">JUL 25 · BUILD DAY</div>
              <ul className="tl">
                <li><span className="t">8:00</span><span className="e">Check-in + breakfast · <b>NDA / IP signed at the door</b></span></li>
                <li><span className="t">8:45</span><span className="e">Brief — rules, judging, what &quot;runs live&quot; means</span></li>
                <li><span className="t">9:15</span><span className="e">Track draw · teams locked · sandbox creds + repos</span></li>
                <li><span className="t">9:30</span><span className="e"><b>Hospital immersion</b> — embed with your real department</span></li>
                <li><span className="t">11:00</span><span className="e"><b>Build starts</b></span></li>
                <li><span className="t">20:00</span><span className="e">Dinner with clinical leadership · overnight build space open</span></li>
              </ul>
            </div>
            <div className="day reveal">
              <h3>Sunday</h3>
              <div className="date">JUL 26 · SHIP DAY</div>
              <ul className="tl">
                <li><span className="t">8:00</span><span className="e">Breakfast · build continues</span></li>
                <li><span className="t">17:00</span><span className="e"><b>Code freeze</b> — push to Vercel, lock repo</span></li>
                <li><span className="t">17:30</span><span className="e">Live demos · 7 min + 3 Q&amp;A each</span></li>
                <li><span className="t">18:30</span><span className="e">Jury deliberation</span></li>
                <li><span className="t">19:00</span><span className="e">Awards</span></li>
                <li><span className="t">19:30</span><span className="e">Closing</span></li>
                <li><span className="t">20:00</span><span className="e"><b>Dinner</b> with clinical leadership + winners</span></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="alt" id="criteria">
        <div className="wrap">
          <div className="reveal">
            <div className="eyebrow">Who gets in</div>
            <h2 className="sec-title">20 seats. We select on proven code, not credentials.</h2>
            <p className="sec-intro">No take-home test. We judge what you&apos;ve already shipped — so your GitHub and one real project matter more than your college or CV.</p>
          </div>
          <div className="crit-list">
            <div className="crit reveal"><div className="w">40%</div><div><b>Code evidence.</b> <span>Real, shipped, non-trivial work. Commit history, deployed projects, a quality glance. The only honest signal.</span></div></div>
            <div className="crit reveal"><div className="w">20%</div><div><b>Stack relevance.</b> <span>Web-app capable — JS/TS, React/Next, any backend or DB. Exact Next + Supabase not required.</span></div></div>
            <div className="crit reveal"><div className="w">20%</div><div><b>Real-world fit.</b> <span>You think about users and problems, not just tech. Healthcare interest is a plus, not a gate.</span></div></div>
            <div className="crit reveal"><div className="w">20%</div><div><b>Intent.</b> <span>You actually want to keep building with us — not just a weekend and the cash.</span></div></div>
          </div>
          <p className="sec-intro" style={{ marginTop: '26px', marginBottom: 0 }}>Pre-formed teams are scored together — but <b style={{ color: 'var(--text)' }}>every member must individually clear the code bar</b>. No carrying dead weight. Solo applicants are placed into balanced teams.</p>
        </div>
      </section>

      <section id="apply">
        <div className="wrap">
          <div className="reveal" style={{ textAlign: 'center', marginBottom: '42px' }}>
            <div className="eyebrow">The front door</div>
            <h2 className="sec-title" style={{ margin: '0 auto 16px' }}>Apply to build</h2>
            <p className="sec-intro" style={{ margin: '0 auto' }}>Takes ~5 minutes. We review real code, so make your links count.</p>
          </div>

          <div className="form-card reveal">
            {!submitted ? (
              <div>
                <div className="frow">
                  <div className="field"><label>Full name <span className="req">*</span></label><input type="text" placeholder="Your name" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
                  <div className="field"><label>Email <span className="req">*</span></label><input type="email" placeholder="you@email.com" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
                </div>
                <div className="frow">
                  <div className="field"><label>Phone <span className="req">*</span></label><input type="tel" placeholder="+91 ..." value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
                  <div className="field"><label>College / Company <span className="req">*</span></label><input type="text" placeholder="Where you study or work" value={form.org} onChange={(e) => set('org', e.target.value)} /></div>
                </div>
                <div className="frow">
                  <div className="field"><label>GitHub URL <span className="req">*</span></label><input type="url" placeholder="github.com/yourhandle" value={form.github_url} onChange={(e) => set('github_url', e.target.value)} /><span className="hint">Mandatory — we assess your real code.</span></div>
                  <div className="field"><label>Portfolio / live project</label><input type="url" placeholder="A deployed project link" value={form.portfolio_url} onChange={(e) => set('portfolio_url', e.target.value)} /></div>
                </div>
                <div className="field"><label>One project you&apos;ve shipped — what it does &amp; your specific role <span className="req">*</span></label><textarea placeholder="What it does, what YOU built, and a link." value={form.project_desc} onChange={(e) => set('project_desc', e.target.value)} /></div>
                <div className="frow">
                  <div className="field"><label>Primary stack <span className="req">*</span></label><input type="text" placeholder="e.g. TypeScript, React, Postgres" value={form.stack} onChange={(e) => set('stack', e.target.value)} /></div>
                  <div className="field"><label>Top track preference <span className="req">*</span></label>
                    <select value={form.track_pref} onChange={(e) => set('track_pref', e.target.value)}>
                      <option value="">Select a track…</option>
                      <option>01 · HRMS — Workforce Backbone</option>
                      <option>02 · VPMS — Procure-to-Pay</option>
                      <option>03 · Insurance / RCM</option>
                      <option>04 · Patient Portal</option>
                      <option>05 · HMIS — Integrated Core</option>
                      <option>06 · Wildcard</option>
                    </select>
                  </div>
                </div>
                <div className="field"><label>Hardest thing you&apos;ve ever built — and why it was hard <span className="req">*</span></label><textarea placeholder="≤ 100 words" value={form.hardest_build} onChange={(e) => set('hardest_build', e.target.value)} /></div>
                <div className="field"><label>Why do you want to be part of this? <span className="req">*</span></label><textarea placeholder="≤ 100 words" value={form.why} onChange={(e) => set('why', e.target.value)} /></div>
                <div className="field"><label>Team status <span className="req">*</span></label>
                  <select value={form.team_status} onChange={(e) => set('team_status', e.target.value)}>
                    <option value="">Select…</option>
                    <option>Solo — place me into a team</option>
                    <option>Pre-formed team (2–4 members)</option>
                  </select>
                </div>
                <div className="field"><label>If pre-formed: members + each member&apos;s GitHub</label><textarea placeholder="Name — github.com/handle (one per line)" value={form.team_members} onChange={(e) => set('team_members', e.target.value)} /></div>

                <label className="check"><input type="checkbox" checked={c1} onChange={(e) => setC1(e.target.checked)} /> I&apos;m available for <b style={{ color: 'var(--text)' }}>both days</b>, July 25–26, in Ahmedabad.</label>
                <label className="check"><input type="checkbox" checked={c2} onChange={(e) => setC2(e.target.checked)} /> I&apos;m open to <b style={{ color: 'var(--text)' }}>joining the healthtech vertical</b> (full-time / part-time / remote) if selected.</label>
                <label className="check"><input type="checkbox" checked={c3} onChange={(e) => setC3(e.target.checked)} /> I&apos;ll sign the <b style={{ color: 'var(--text)' }}>NDA / IP agreement</b> at the venue.</label>

                {errorMsg && <p style={{ color: '#c0392b', fontSize: '13.5px', marginBottom: '12px', fontWeight: 600 }}>{errorMsg}</p>}

                <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: '10px', opacity: submitting ? 0.7 : 1 }} disabled={submitting} onClick={submitForm}>
                  {submitting ? 'Submitting…' : 'Submit application →'}
                </button>
                <p className="form-note">Applications reviewed on a rolling basis. We&apos;ll email selected builders with team + track confirmation.</p>
              </div>
            ) : (
              <div className="form-success" style={{ display: 'block' }}>
                <div className="big">You&apos;re in the <span className="accent">review pile.</span> 🛠️</div>
                <p>Thanks for applying to Health1 MedHackathon &apos;26. We review real code, so we&apos;ll take a proper look and email you with a decision. Keep shipping in the meantime.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap foot-inner">
          <div>
            <a href="#top" className="logo" style={{ marginBottom: '8px' }}><span className="dot" />Health1 <small>MedHackathon &apos;26</small></a>
            <p>Health1 Super Speciality Hospitals · Shilaj, Ahmedabad</p>
          </div>
          <div className="foot-links">
            <a href="#why">Why</a>
            <a href="#tracks">Tracks</a>
            <a href="#prizes">Prizes</a>
            <a href="#format">Format</a>
            <a href="#apply">Apply</a>
          </div>
        </div>
      </footer>
    </>
  );
}
