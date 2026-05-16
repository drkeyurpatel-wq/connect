export default function MedHackSuccessPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f0f4f8; }
        .wrap {
          min-height: 100vh; display: flex; align-items: center;
          justify-content: center; padding: 32px 24px;
        }
        .card {
          background: #fff; border-radius: 16px; padding: 48px 40px;
          text-align: center; max-width: 480px; width: 100%;
          box-shadow: 0 8px 40px rgba(0,88,160,0.12);
          border: 1px solid rgba(0,88,160,0.1);
        }
        .icon {
          width: 72px; height: 72px; border-radius: 50%;
          background: linear-gradient(135deg, #18B098, #0d8a78);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 24px; font-size: 32px;
          box-shadow: 0 4px 20px rgba(24,176,152,0.35);
        }
        h1 { font-size: 26px; font-weight: 800; color: #0f1e2e; letter-spacing: -0.5px; margin-bottom: 10px; }
        p { font-size: 15px; color: #3d5a7a; line-height: 1.65; margin-bottom: 8px; }
        .highlight { color: #0058A0; font-weight: 600; }
        .divider { height: 1px; background: rgba(0,88,160,0.1); margin: 24px 0; }
        .meta { font-size: 13px; color: #7a95b0; }
        .meta strong { color: #3d5a7a; }
        .back {
          display: inline-block; margin-top: 28px;
          font-size: 14px; font-weight: 600; color: #0058A0;
          text-decoration: none;
        }
        .back:hover { text-decoration: underline; }
      `}</style>
      <div className="wrap">
        <div className="card">
          <div className="icon">✓</div>
          <h1>Application submitted!</h1>
          <p>
            Your team&apos;s application for <span className="highlight">Health1 MedHack 2026</span> has
            been received. Keyur reviews every application personally.
          </p>
          <div className="divider" />
          <p className="meta"><strong>What happens next:</strong></p>
          <p className="meta">Review within 5 days → shortlisted teams contacted via lead email → NDA signing → codebase access on June 6.</p>
          <a href="https://health1.co.in" className="back">← Back to Health1</a>
        </div>
      </div>
    </>
  );
}
