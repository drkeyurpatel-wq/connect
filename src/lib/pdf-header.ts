import { HEALTH1_LOGO_BASE64 } from './logo-base64';

/**
 * Shared Health1 PDF header — copied from VPMS conventions.
 * Every exportable document must call this (ECC v4 Rule 9).
 */
export function renderPDFHeader(title: string, subtitle?: string): string {
  return `
    <header style="display:flex;align-items:center;gap:16px;border-bottom:2px solid #0f766e;padding:16px 24px;">
      <img src="${HEALTH1_LOGO_BASE64}" alt="Health1" style="height:48px;width:auto;" />
      <div>
        <h1 style="margin:0;font-size:20px;color:#0f172a;">${title}</h1>
        ${subtitle ? `<p style="margin:4px 0 0;font-size:13px;color:#475569;">${subtitle}</p>` : ''}
      </div>
      <div style="margin-left:auto;font-size:12px;color:#475569;">
        Generated ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC
      </div>
    </header>
  `;
}
