/**
 * verifiedBadge.ts
 * Authentic social-media style Verified Checkmark badge (similar to X, Instagram, Facebook).
 * Used to indicate players who have completed 1-tap WhatsApp registration
 * and are officially eligible for real cash and voucher payouts.
 */

export const VERIFIED_BADGE_SVG = `
<svg class="verified-tick-icon" viewBox="0 0 24 24" width="16" height="16" aria-label="Verified Player" title="Verified Tournament Player" style="display: inline-block; vertical-align: -2px; flex-shrink: 0;">
  <path fill="#00ba7c" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91c-1.31.67-2.19 1.91-2.19 3.34s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2l-3.54-3.54 1.41-1.41 2.13 2.12 5.66-5.65 1.41 1.41-7.07 7.07z"/>
</svg>
`.trim();

export const VERIFIED_BADGE_GOLD_SVG = `
<svg class="verified-tick-icon gold" viewBox="0 0 24 24" width="16" height="16" aria-label="Verified Gold Player" title="Official Verified Partner Competitor" style="display: inline-block; vertical-align: -2px; flex-shrink: 0;">
  <path fill="#ffd700" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91c-1.31.67-2.19 1.91-2.19 3.34s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2l-3.54-3.54 1.41-1.41 2.13 2.12 5.66-5.65 1.41 1.41-7.07 7.07z"/>
</svg>
`.trim();

export function getVerifiedBadgeHtml(isGold: boolean = false): string {
  return isGold ? VERIFIED_BADGE_GOLD_SVG : VERIFIED_BADGE_SVG;
}
