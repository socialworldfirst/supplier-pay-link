#!/usr/bin/env node
/**
 * WorldFirst Supplier Card Generator
 *
 * Reads suppliers.json → generates standalone HTML cards for each approved supplier.
 * Output goes to ./cards/ directory.
 *
 * Usage:  node generate-cards.js
 *
 * No npm dependencies required — pure Node.js.
 */

const fs = require('fs');
const path = require('path');

// ── Paths ──────────────────────────────────────────────────
const SUPPLIERS_FILE = path.join(__dirname, 'suppliers.json');
const CARDS_DIR = path.join(__dirname, 'cards');

// ── Helpers ────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getInitials(nameEn) {
  const words = nameEn.replace(/Co\.,?\s*Ltd\.?$/i, '').trim().split(/\s+/);
  // Take first letter of first two meaningful words
  const meaningful = words.filter(w => !['the', 'of', 'and', '&'].includes(w.toLowerCase()));
  if (meaningful.length >= 2) {
    return (meaningful[0][0] + meaningful[1][0]).toUpperCase();
  }
  return meaningful[0] ? meaningful[0].substring(0, 2).toUpperCase() : '??';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatWhatsAppNumber(num) {
  // Display number as-is for the label
  return num;
}

function whatsAppLink(num) {
  // Strip everything except digits and +
  const clean = num.replace(/[^0-9+]/g, '');
  // Remove leading + for wa.me link
  return 'https://wa.me/' + clean.replace(/^\+/, '');
}

function websiteDisplay(url) {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

function mapsLink(address) {
  return 'https://maps.google.com/?q=' + encodeURIComponent(address);
}

// ── SVG Icons (inline, matching card-demo.html) ────────────

const ICONS = {
  website: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7.5" stroke="#1A1A1A" stroke-width="1.4"/>
        <path d="M3 10H17M10 2.5C12 5 13 7.5 13 10C13 12.5 12 15 10 17.5M10 2.5C8 5 7 7.5 7 10C7 12.5 8 15 10 17.5" stroke="#1A1A1A" stroke-width="1.4"/>
      </svg>`,

  whatsapp: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M17 10C17 13.866 13.866 17 10 17C8.68 17 7.44 16.64 6.38 16L3 17L4 13.62C3.36 12.56 3 11.32 3 10C3 6.134 6.134 3 10 3C13.866 3 17 6.134 17 10Z" stroke="#25D366" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,

  wechat: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M6.5 3.5H4.5C3.672 3.5 3 4.172 3 5V15C3 15.828 3.672 16.5 4.5 16.5H11.5C12.328 16.5 13 15.828 13 15V13.5" stroke="#1A1A1A" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M7 9C7 7.343 8.343 6 10 6H15C16.657 6 18 7.343 18 9V9C18 10.657 16.657 12 15 12H10C8.343 12 7 10.657 7 9Z" stroke="#07C160" stroke-width="1.4"/>
        <circle cx="10.5" cy="9" r="0.75" fill="#07C160"/>
        <circle cx="14.5" cy="9" r="0.75" fill="#07C160"/>
      </svg>`,

  email: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="5" width="14" height="10" rx="2" stroke="#1A1A1A" stroke-width="1.4"/>
        <path d="M3 7L10 12L17 7" stroke="#1A1A1A" stroke-width="1.4" stroke-linecap="round"/>
      </svg>`,

  arrow: `<svg class="arrow" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  check: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>`
};

// ── Card HTML Template ─────────────────────────────────────

function buildCardHtml(supplier) {
  const initials = getInitials(supplier.nameEn);
  const name = escapeHtml(supplier.nameEn);
  const address = escapeHtml(supplier.address);
  // Split address into two roughly equal lines at a comma near the middle
  const commaPositions = [];
  for (let i = 0; i < address.length; i++) {
    if (address[i] === ',') commaPositions.push(i);
  }
  const mid = address.length / 2;
  let bestComma = -1;
  let bestDist = Infinity;
  for (const pos of commaPositions) {
    const dist = Math.abs(pos - mid);
    if (dist < bestDist) { bestDist = dist; bestComma = pos; }
  }
  const addressBreak = bestComma > -1
    ? address.substring(0, bestComma + 1) + '<br>' + address.substring(bestComma + 1).trimStart()
    : address;
  const mapsUrl = mapsLink(supplier.address);

  // Build category tags
  const categories = (supplier.categories || []).map(c =>
    `    <span class="tag">${escapeHtml(c)}</span>`
  ).join('\n');

  // Build contact links (only if data provided)
  const links = [];

  if (supplier.website) {
    links.push(`    <a class="link-btn" href="${escapeHtml(supplier.website)}" target="_blank">
      ${ICONS.website}
      <div>
        Website
        <div class="link-detail">${escapeHtml(websiteDisplay(supplier.website))}</div>
      </div>
      ${ICONS.arrow}
    </a>`);
  }

  if (supplier.whatsapp) {
    links.push(`    <a class="link-btn" href="${whatsAppLink(supplier.whatsapp)}" target="_blank">
      ${ICONS.whatsapp}
      <div>
        WhatsApp
        <div class="link-detail">${escapeHtml(supplier.whatsapp)}</div>
      </div>
      ${ICONS.arrow}
    </a>`);
  }

  if (supplier.wechat) {
    links.push(`    <div class="link-btn" onclick="copyText('${escapeHtml(supplier.wechat)}')">
      ${ICONS.wechat}
      <div>
        WeChat
        <div class="link-detail">${escapeHtml(supplier.wechat)}</div>
      </div>
      ${ICONS.arrow}
    </div>`);
  }

  if (supplier.email) {
    links.push(`    <a class="link-btn" href="mailto:${escapeHtml(supplier.email)}">
      ${ICONS.email}
      <div>
        Email
        <div class="link-detail">${escapeHtml(supplier.email)}</div>
      </div>
      ${ICONS.arrow}
    </a>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name} — Verified Supplier Card</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1A1A1A;
    background: #F5F6F8;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .card {
    max-width: 400px;
    width: 100%;
    background: #fff;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06);
  }

  /* Supplier header */
  .header {
    padding: 28px 24px 20px;
    text-align: center;
  }
  .avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #1A1A1A;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 14px;
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    letter-spacing: -0.5px;
  }
  .name {
    font-size: 20px;
    font-weight: 700;
    line-height: 1.25;
    margin-bottom: 6px;
  }
  .address {
    font-size: 13px;
    color: #888;
    line-height: 1.45;
    text-decoration: none;
    display: block;
  }
  .address:hover { color: #666; }

  /* Categories */
  .tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    padding: 0 24px 22px;
  }
  .tag {
    background: #F5F6F8;
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12px;
    color: #666;
  }

  /* Contact links */
  .links {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 20px 20px;
  }
  .link-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: #F9F9F9;
    border: 1px solid #EFEFEF;
    border-radius: 12px;
    text-decoration: none;
    color: #1A1A1A;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.15s;
    cursor: pointer;
    position: relative;
  }
  .link-btn:hover {
    background: #F3F3F3;
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  }
  .link-btn svg { flex-shrink: 0; }
  .link-btn .arrow {
    position: absolute;
    right: 14px;
    color: #D4D4D4;
  }
  .link-btn:hover .arrow { color: #AAA; }
  .link-detail {
    font-size: 12px;
    color: #999;
    font-weight: 400;
    margin-top: 1px;
  }

  /* WF trust badge */
  .wf-badge {
    margin: 4px 20px 0;
    background: #FF0051;
    border-radius: 14px;
    padding: 18px 20px;
  }
  .wf-badge-title {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    margin-bottom: 2px;
  }
  .wf-badge-sub {
    font-size: 12px;
    color: rgba(255,255,255,0.55);
    font-weight: 400;
    margin-bottom: 14px;
  }
  .wf-badge-checks {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .wf-check {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: rgba(255,255,255,0.85);
  }
  .wf-check svg { flex-shrink: 0; }
  .wf-check-icon {
    width: 22px;
    height: 22px;
    min-width: 22px;
    border-radius: 50%;
    background: rgba(255,255,255,0.18);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Footer outside badge */
  .card-footer {
    padding: 18px 20px 22px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .card-footer-logos {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .card-footer-logos img {
    opacity: 1;
  }
  .card-footer-logos img.logo-wf {
    height: 13px;
  }
  .card-footer-logos img.logo-ant {
    height: 20px;
  }
  .card-footer-sep {
    width: 1px;
    height: 14px;
    background: #DDD;
  }
  .card-footer-tagline {
    font-size: 11px;
    color: #BBB;
    letter-spacing: 0.02em;
  }

  /* Toast */
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: #1A1A1A;
    color: #fff;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 13px;
    opacity: 0;
    transition: all 0.25s;
    pointer-events: none;
    z-index: 50;
  }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
</style>
</head>
<body>

<div class="card">

  <!-- Supplier Info -->
  <div class="header">
    <div class="avatar">${initials}</div>
    <h1 class="name">${name}</h1>
    <a class="address" href="${mapsUrl}" target="_blank">${addressBreak}</a>
  </div>

  <!-- Categories -->
  <div class="tags">
${categories}
  </div>

  <!-- Contact Links -->
  <div class="links">
${links.join('\n\n')}
  </div>

  <!-- WorldFirst Trust Badge -->
  <div class="wf-badge">
    <div class="wf-badge-title">WorldFirst Business User</div>
    <div class="wf-badge-sub">Verified business account</div>
    <div class="wf-badge-checks">
      <div class="wf-check">
        <div class="wf-check-icon">
          ${ICONS.check}
        </div>
        Business licence and export licence verified
      </div>
      <div class="wf-check">
        <div class="wf-check-icon">
          ${ICONS.check}
        </div>
        Accepts instant and free WorldFirst payments
      </div>
    </div>
  </div>

  <!-- Footer: logos + tagline on white -->
  <div class="card-footer">
    <div class="card-footer-logos">
      <img class="logo-wf" src="../wf-logo-nav.webp" alt="WorldFirst">
      <div class="card-footer-sep"></div>
      <img class="logo-ant" src="../ant-logo.png" alt="Ant International">
    </div>
    <div class="card-footer-tagline">The smarter way to pay China</div>
  </div>

</div>

<div class="toast" id="toast"></div>

<script>
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    const t = document.getElementById('toast');
    t.textContent = 'Copied: ' + text;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
  });
}
</script>

</body>
</html>`;
}

// ── Index Page Template ────────────────────────────────────

function buildIndexHtml(suppliers) {
  const rows = suppliers.map(s => {
    const slug = slugify(s.nameEn);
    const cats = (s.categories || []).map(c => `<span class="idx-tag">${escapeHtml(c)}</span>`).join('');
    return `      <a class="idx-card" href="${slug}.html">
        <div class="idx-avatar">${getInitials(s.nameEn)}</div>
        <div class="idx-info">
          <div class="idx-name">${escapeHtml(s.nameEn)}</div>
          <div class="idx-name-cn">${escapeHtml(s.nameCn)}</div>
          <div class="idx-tags">${cats}</div>
        </div>
        <svg class="idx-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="#CCC" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Verified Suppliers — WorldFirst</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1A1A1A;
    background: #F5F6F8;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
    padding: 20px;
  }
  .container {
    max-width: 560px;
    margin: 0 auto;
  }
  .idx-header {
    text-align: center;
    padding: 32px 0 28px;
  }
  .idx-header img { height: 22px; margin-bottom: 20px; }
  .idx-header h1 {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .idx-header p {
    font-size: 14px;
    color: #888;
  }
  .idx-count {
    font-size: 13px;
    color: #999;
    text-align: center;
    margin-bottom: 16px;
  }
  .idx-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 32px;
  }
  .idx-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 18px;
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04);
    text-decoration: none;
    color: #1A1A1A;
    transition: all 0.15s;
  }
  .idx-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0,0,0,0.06), 0 8px 20px rgba(0,0,0,0.06);
  }
  .idx-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #1A1A1A;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    letter-spacing: -0.5px;
    flex-shrink: 0;
  }
  .idx-info {
    flex: 1;
    min-width: 0;
  }
  .idx-name {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.3;
  }
  .idx-name-cn {
    font-size: 12px;
    color: #999;
    margin-top: 1px;
  }
  .idx-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }
  .idx-tag {
    background: #F5F6F8;
    border-radius: 4px;
    padding: 2px 7px;
    font-size: 11px;
    color: #888;
  }
  .idx-arrow {
    flex-shrink: 0;
  }
  .idx-footer {
    text-align: center;
    padding: 16px 0 24px;
  }
  .idx-footer-logos {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 8px;
  }
  .idx-footer-logos img.logo-wf { height: 13px; }
  .idx-footer-logos img.logo-ant { height: 20px; }
  .idx-footer-sep { width: 1px; height: 14px; background: #DDD; }
  .idx-footer-tagline { font-size: 11px; color: #BBB; }
</style>
</head>
<body>

<div class="container">
  <div class="idx-header">
    <img src="../wf-logo-nav.webp" alt="WorldFirst">
    <h1>Verified Suppliers</h1>
    <p>WorldFirst business users with verified accounts</p>
  </div>

  <div class="idx-count">${suppliers.length} supplier${suppliers.length !== 1 ? 's' : ''}</div>

  <div class="idx-list">
${rows}
  </div>

  <div class="idx-footer">
    <div class="idx-footer-logos">
      <img class="logo-wf" src="../wf-logo-nav.webp" alt="WorldFirst">
      <div class="idx-footer-sep"></div>
      <img class="logo-ant" src="../ant-logo.png" alt="Ant International">
    </div>
    <div class="idx-footer-tagline">The smarter way to pay China</div>
  </div>
</div>

</body>
</html>`;
}

// ── Main ───────────────────────────────────────────────────

function main() {
  console.log('Reading suppliers.json...');

  if (!fs.existsSync(SUPPLIERS_FILE)) {
    console.error('Error: suppliers.json not found at ' + SUPPLIERS_FILE);
    process.exit(1);
  }

  const suppliers = JSON.parse(fs.readFileSync(SUPPLIERS_FILE, 'utf8'));
  const approved = suppliers.filter(s => s.approved === true);

  console.log(`Found ${suppliers.length} suppliers, ${approved.length} approved.`);

  if (approved.length === 0) {
    console.log('No approved suppliers. Nothing to generate.');
    return;
  }

  // Create cards directory
  if (!fs.existsSync(CARDS_DIR)) {
    fs.mkdirSync(CARDS_DIR, { recursive: true });
  }

  // Generate individual cards
  const generated = [];
  for (const supplier of approved) {
    const slug = slugify(supplier.nameEn);
    const filename = slug + '.html';
    const filepath = path.join(CARDS_DIR, filename);

    const html = buildCardHtml(supplier);
    fs.writeFileSync(filepath, html, 'utf8');

    generated.push({ supplier, slug, filename });
    console.log(`  Generated: cards/${filename}`);
  }

  // Generate index page
  const indexHtml = buildIndexHtml(approved);
  const indexPath = path.join(CARDS_DIR, 'index.html');
  fs.writeFileSync(indexPath, indexHtml, 'utf8');
  console.log(`  Generated: cards/index.html`);

  console.log(`\nDone! ${generated.length} cards + index page generated in ./cards/`);
}

main();
