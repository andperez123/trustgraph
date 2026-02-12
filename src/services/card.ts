/**
 * Shareable Trust Card — SVG image for /agent/:agentId/card.png (or .svg).
 * Includes: agent id, composite, rank, badges, TrustGraph branding, short URL.
 */

import { config } from "../config.js";
import type { AgentProfilePublic } from "../types.js";

const CARD_WIDTH = 400;
const CARD_HEIGHT = 220;
const PADDING = 24;
const FONT_FAMILY = "system-ui, -apple-system, sans-serif";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Generate Trust Card as SVG string. */
export function generateTrustCardSvg(profile: AgentProfilePublic): string {
  const baseUrl = config.publicBaseUrl.replace(/\/$/, "");
  const shortUrl = `${baseUrl}/agent/${encodeURIComponent(profile.agentId)}`;
  const displayName = profile.displayName || profile.agentId;
  const rankText =
    profile.rank7d != null
      ? `#${profile.rank7d} (7d)`
      : profile.rankAllTime != null
        ? `#${profile.rankAllTime} (all-time)`
        : "—";
  const badgeLabels = profile.badges.map((b) => b.name).join(" · ") || "—";

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a"/>
      <stop offset="100%" style="stop-color:#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" rx="12"/>
  <text x="${PADDING}" y="${PADDING + 18}" font-family="${FONT_FAMILY}" font-size="11" fill="#94a3b8" letter-spacing="0.05em">TRUSTGRAPH</text>
  <text x="${PADDING}" y="${PADDING + 44}" font-family="${FONT_FAMILY}" font-size="20" font-weight="700" fill="#f8fafc">${escapeXml(displayName)}</text>
  <text x="${PADDING}" y="${PADDING + 64}" font-family="${FONT_FAMILY}" font-size="12" fill="#64748b">${escapeXml(profile.agentId)}</text>
  <text x="${CARD_WIDTH - PADDING}" y="${PADDING + 36}" font-family="${FONT_FAMILY}" font-size="36" font-weight="800" fill="#22c55e" text-anchor="end">${(profile.composite * 100).toFixed(1)}</text>
  <text x="${CARD_WIDTH - PADDING}" y="${PADDING + 54}" font-family="${FONT_FAMILY}" font-size="12" fill="#94a3b8" text-anchor="end">composite</text>
  <text x="${PADDING}" y="${PADDING + 92}" font-family="${FONT_FAMILY}" font-size="13" fill="#cbd5e1">Rank ${escapeXml(rankText)}</text>
  <text x="${PADDING}" y="${PADDING + 114}" font-family="${FONT_FAMILY}" font-size="11" fill="#94a3b8">${escapeXml(badgeLabels)}</text>
  <text x="${PADDING}" y="${CARD_HEIGHT - PADDING - 8}" font-family="${FONT_FAMILY}" font-size="10" fill="#475569">${escapeXml(shortUrl)}</text>
  <text x="${CARD_WIDTH - PADDING}" y="${CARD_HEIGHT - PADDING - 8}" font-family="${FONT_FAMILY}" font-size="10" fill="#475569" text-anchor="end">${profile.proofCount} proofs</text>
</svg>`.trim();

  return svg;
}
