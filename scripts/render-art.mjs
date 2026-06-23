#!/usr/bin/env node
/**
 * VANTA — offline image generator (no API, no cost)
 * ------------------------------------------------------------------
 * Draws each product + lookbook image as an art-directed studio
 * composition in SVG and rasterizes it to assets/img/<id>.jpg using a
 * headless Chromium (Playwright). This is fully local — it does NOT
 * call any paid image model. Use it when you don't have a
 * billing-enabled OpenAI/Gemini key.
 *
 * Requires (dev-only):  npm i -D playwright-core   + a chromium binary.
 * Override the binary with PW_CHROMIUM=/path/to/headless_shell
 *
 * Run:  node scripts/render-art.mjs
 * ------------------------------------------------------------------
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets', 'img');

/* ---------- shared SVG building blocks ---------- */
const defs = (id, clothTop, clothBot) => `
<defs>
  <radialGradient id="bg${id}" cx="42%" cy="32%" r="90%">
    <stop offset="0%" stop-color="#212123"/>
    <stop offset="52%" stop-color="#0d0d0e"/>
    <stop offset="100%" stop-color="#040404"/>
  </radialGradient>
  <linearGradient id="cloth${id}" x1="0" y1="0" x2="0.15" y2="1">
    <stop offset="0%" stop-color="${clothTop}"/>
    <stop offset="100%" stop-color="${clothBot}"/>
  </linearGradient>
  <radialGradient id="vig${id}" cx="50%" cy="44%" r="74%">
    <stop offset="55%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0.8"/>
  </radialGradient>
  <filter id="soft${id}"><feGaussianBlur stdDeviation="16"/></filter>
  <filter id="crease${id}"><feGaussianBlur stdDeviation="7"/></filter>
  <filter id="noise${id}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n"/>
    <feColorMatrix in="n" type="saturate" values="0"/>
  </filter>
</defs>`;

const grainVig = (id, w, h) => `
  <rect width="${w}" height="${h}" filter="url(#noise${id})" opacity="0.07" style="mix-blend-mode:overlay"/>
  <rect width="${w}" height="${h}" fill="url(#vig${id})"/>`;

const ACCENT = '#d8ff3e';
const F = "font-family='Archivo, Arial, Helvetica, sans-serif'";

/* ---------- garment path generators (1000 x 1250 space) ---------- */
function hoodie(id) {
  return `
  <ellipse cx="500" cy="1085" rx="250" ry="34" fill="#000" opacity="0.65" filter="url(#soft${id})"/>
  <path d="M300,360 L168,422 L150,694 L272,712 L322,520 Z" fill="url(#cloth${id})"/>
  <path d="M700,360 L832,422 L850,694 L728,712 L678,520 Z" fill="url(#cloth${id})"/>
  <path d="M300,360 Q500,318 700,360 L700,1030 Q700,1072 658,1072 L342,1072 Q300,1072 300,1030 Z" fill="url(#cloth${id})"/>
  <path d="M388,360 Q500,222 612,360 Q560,394 500,400 Q440,394 388,360 Z" fill="url(#cloth${id})"/>
  <path d="M410,352 Q500,250 590,352" fill="none" stroke="#000" stroke-opacity="0.5" stroke-width="10" filter="url(#crease${id})"/>
  <path d="M372,694 L628,694 L606,858 L394,858 Z" fill="#000" fill-opacity="0.18"/>
  <path d="M372,694 L628,694 L606,858 L394,858 Z" fill="none" stroke="#fff" stroke-opacity="0.10" stroke-width="1.6" stroke-dasharray="2 6"/>
  <path d="M470,372 L470,470 M530,372 L530,470" stroke="#0c0c0c" stroke-width="9" stroke-linecap="round"/>
  <circle cx="470" cy="476" r="9" fill="${ACCENT}"/><circle cx="530" cy="476" r="9" fill="#0c0c0c"/>
  <path d="M360,470 Q500,520 640,470" fill="none" stroke="#000" stroke-opacity="0.3" stroke-width="22" filter="url(#crease${id})"/>
  <rect x="332" y="1000" width="9" height="46" fill="${ACCENT}"/>`;
}
function tee(id) {
  return `
  <ellipse cx="500" cy="1045" rx="230" ry="30" fill="#000" opacity="0.6" filter="url(#soft${id})"/>
  <path d="M310,360 L185,420 L162,560 L278,600 L322,500 Z" fill="url(#cloth${id})"/>
  <path d="M690,360 L815,420 L838,560 L722,600 L678,500 Z" fill="url(#cloth${id})"/>
  <path d="M310,360 Q500,322 690,360 L690,1000 Q690,1030 660,1030 L340,1030 Q310,1030 310,1000 Z" fill="url(#cloth${id})"/>
  <path d="M418,360 Q500,430 582,360" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="14"/>
  <path d="M418,360 Q500,418 582,360" fill="none" stroke="#fff" stroke-opacity="0.08" stroke-width="3"/>
  <path d="M360,520 Q500,560 640,520" fill="none" stroke="#000" stroke-opacity="0.28" stroke-width="20" filter="url(#crease${id})"/>
  <rect x="340" y="965" width="8" height="40" fill="${ACCENT}"/>`;
}
function cargo(id) {
  return `
  <ellipse cx="500" cy="1110" rx="220" ry="30" fill="#000" opacity="0.6" filter="url(#soft${id})"/>
  <path d="M330,356 L670,356 L670,432 L330,432 Z" fill="url(#cloth${id})"/>
  <path d="M330,432 L495,432 L474,1086 L346,1086 Z" fill="url(#cloth${id})"/>
  <path d="M505,432 L670,432 L654,1086 L526,1086 Z" fill="url(#cloth${id})"/>
  <path d="M495,432 L505,432 L500,580 Z" fill="#000" fill-opacity="0.5"/>
  <path d="M360,640 L462,640 L457,792 L366,792 Z" fill="#000" fill-opacity="0.2" stroke="#fff" stroke-opacity="0.1" stroke-width="1.6" stroke-dasharray="2 6"/>
  <path d="M538,640 L640,640 L634,792 L543,792 Z" fill="#000" fill-opacity="0.2" stroke="#fff" stroke-opacity="0.1" stroke-width="1.6" stroke-dasharray="2 6"/>
  <path d="M360,640 L462,640 M538,640 L640,640" stroke="#fff" stroke-opacity="0.12" stroke-width="6"/>
  <rect x="348" y="356" width="40" height="14" fill="#000" fill-opacity="0.35"/>
  <rect x="612" y="356" width="40" height="14" fill="#000" fill-opacity="0.35"/>
  <rect x="486" y="372" width="28" height="12" fill="${ACCENT}"/>`;
}
function jacket(id) {
  return `
  <ellipse cx="500" cy="1075" rx="245" ry="32" fill="#000" opacity="0.65" filter="url(#soft${id})"/>
  <path d="M306,372 L176,432 L156,700 L278,718 L326,524 Z" fill="url(#cloth${id})"/>
  <path d="M694,372 L824,432 L844,700 L722,718 L674,524 Z" fill="url(#cloth${id})"/>
  <path d="M306,372 Q500,340 694,372 L694,1024 Q694,1062 654,1062 L346,1062 Q306,1062 306,1024 Z" fill="url(#cloth${id})"/>
  <path d="M398,372 L500,330 L602,372 L584,408 L416,408 Z" fill="url(#cloth${id})"/>
  <path d="M500,360 L500,1024" stroke="#000" stroke-opacity="0.6" stroke-width="7"/>
  <path d="M500,360 L500,1024" stroke="#fff" stroke-opacity="0.08" stroke-width="2" stroke-dasharray="3 7"/>
  <rect x="491" y="352" width="18" height="30" rx="3" fill="${ACCENT}"/>
  <path d="M384,560 L470,560 L470,640 L384,640 Z M530,560 L616,560 L616,640 L530,640 Z" fill="#000" fill-opacity="0.18" stroke="#fff" stroke-opacity="0.1" stroke-width="1.4" stroke-dasharray="2 6"/>
  <path d="M360,500 Q430,540 466,500 M534,500 Q570,540 640,500" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="16" filter="url(#crease${id})"/>`;
}

/* ---------- person silhouette ---------- */
function figure(cx, feetY, H, fill, op = 1) {
  const headR = H * 0.058, headCy = feetY - H * 0.915;
  const shY = feetY - H * 0.80, shW = H * 0.105;
  const hipY = feetY - H * 0.50, hipW = H * 0.072;
  const legW = H * 0.052;
  return `<g fill="${fill}" fill-opacity="${op}">
    <circle cx="${cx}" cy="${headCy}" r="${headR}"/>
    <path d="M${cx - shW},${shY} Q${cx},${shY - H * 0.03} ${cx + shW},${shY} L${cx + hipW},${hipY} L${cx - hipW},${hipY} Z"/>
    <rect x="${cx - hipW}" y="${hipY}" width="${legW}" height="${feetY - hipY}" rx="${legW * 0.4}"/>
    <rect x="${cx + hipW - legW}" y="${hipY}" width="${legW}" height="${feetY - hipY}" rx="${legW * 0.4}"/>
    <rect x="${cx - shW - legW * 0.3}" y="${shY + H * 0.02}" width="${legW * 0.85}" height="${hipY - shY + H * 0.06}" rx="${legW * 0.4}" transform="rotate(8 ${cx - shW} ${shY})"/>
    <rect x="${cx + shW - legW * 0.55}" y="${shY + H * 0.02}" width="${legW * 0.85}" height="${hipY - shY + H * 0.06}" rx="${legW * 0.4}" transform="rotate(-8 ${cx + shW} ${shY})"/>
  </g>`;
}

/* ---------- compositions ---------- */
function product(id, name, num, price, garment, clothTop, clothBot) {
  // Image is garment-only on a studio backdrop — the site's card UI supplies
  // all text (name, number, price), so nothing is baked in here.
  const W = 1000, H = 1250;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
    ${defs(id, clothTop, clothBot)}
    <rect width="${W}" height="${H}" fill="url(#bg${id})"/>
    ${garment(id)}
    ${grainVig(id, W, H)}
  </svg>`;
}

function lookFull(id) { // landscape full figure + reflection
  const W = 1400, H = 1050;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
    ${defs(id, '#1c1c1f', '#0a0a0b')}
    <rect width="${W}" height="${H}" fill="url(#bg${id})"/>
    <text x="${W / 2}" y="${H / 2 + 60}" ${F} font-weight="900" font-size="520" fill="#fff" fill-opacity="0.03" text-anchor="middle">001</text>
    <rect x="0" y="858" width="${W}" height="3" fill="${ACCENT}" opacity="0.5"/>
    ${figure(W / 2, 858, 760, '#020202', 1)}
    <g transform="translate(0,1716) scale(1,-1)" opacity="0.16">${figure(W / 2, 858, 760, ACCENT, 1)}</g>
    ${grainVig(id, W, H)}
  </svg>`;
}
function lookPortrait(id, cap) { // studio head & shoulders
  const W = 1000, H = 1333;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
    ${defs(id, '#1c1c1f', '#0a0a0b')}
    <rect width="${W}" height="${H}" fill="url(#bg${id})"/>
    <ellipse cx="500" cy="430" rx="360" ry="300" fill="#fff" fill-opacity="0.05"/>
    ${figure(500, 1500, 1500, '#040404', 1)}
    ${grainVig(id, W, H)}
  </svg>`;
}
function lookDetail(id) { // macro fabric + woven tag
  const W = 1000, H = 1333;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
    ${defs(id, '#1c1c1f', '#0a0a0b')}
    <rect width="${W}" height="${H}" fill="url(#bg${id})"/>
    <rect width="${W}" height="${H}" filter="url(#noise${id})" opacity="0.5" style="mix-blend-mode:overlay"/>
    <rect width="${W}" height="${H}" fill="#0c0c0d" opacity="0.55"/>
    <g transform="rotate(-4 500 720)">
      <rect x="300" y="600" width="400" height="240" rx="6" fill="#0a0a0a" stroke="#fff" stroke-opacity="0.14" stroke-width="2" stroke-dasharray="3 7"/>
      <text x="500" y="700" ${F} font-weight="900" font-size="64" fill="#f0f0ee" text-anchor="middle">001</text>
      <text x="500" y="760" ${F} font-size="26" letter-spacing="6" fill="#8a8a86" text-anchor="middle">/ 100</text>
      <rect x="300" y="600" width="14" height="240" fill="${ACCENT}"/>
    </g>
    ${grainVig(id, W, H)}
  </svg>`;
}
function lookMotion(id) { // landscape, motion-blur figures
  const W = 1400, H = 1050;
  let ghosts = '';
  for (let i = 0; i < 4; i++) ghosts += `<g transform="translate(${i * 70},0)">${figure(520 + i * 60, 880, 720, '#000', 0.18 + i * 0.22)}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
    ${defs(id, '#1c1c1f', '#0a0a0b')}
    <rect width="${W}" height="${H}" fill="url(#bg${id})"/>
    <rect x="0" y="880" width="${W}" height="2" fill="#fff" fill-opacity="0.08"/>
    ${ghosts}
    ${grainVig(id, W, H)}
  </svg>`;
}

const ITEMS = [
  { id: 'hoodie', w: 1080, h: 1350, svg: product('hoodie', 'NULL HOODIE', 'N° 001–025', 180, hoodie, '#2c2c2f', '#151517') },
  { id: 'tee',    w: 1080, h: 1350, svg: product('tee', 'VOID TEE', 'N° 026–050', 80, tee, '#2a2a2c', '#161618') },
  { id: 'pant',   w: 1080, h: 1350, svg: product('pant', 'STATE CARGO', 'N° 051–075', 160, cargo, '#26282a', '#131516') },
  { id: 'jacket', w: 1080, h: 1350, svg: product('jacket', 'SIGNAL SHELL', 'N° 076–100', 240, jacket, '#2a2d33', '#121317') },
  { id: 'look1',  w: 1440, h: 1080, svg: lookFull('look1') },
  { id: 'look2',  w: 1080, h: 1440, svg: lookPortrait('look2', 'FIG.03 — STUDIO') },
  { id: 'look3',  w: 1080, h: 1440, svg: lookDetail('look3') },
  { id: 'look4',  w: 1440, h: 1080, svg: lookMotion('look4') }
];

async function main() {
  const { chromium } = require('playwright-core');
  const exe = process.env.PW_CHROMIUM; // optional explicit binary
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  console.log(`\nVANTA · rendering ${ITEMS.length} images locally (no API)\n`);
  for (const it of ITEMS) {
    const page = await browser.newPage({ viewport: { width: it.w, height: it.h }, deviceScaleFactor: 2 });
    const svg = it.svg.replace('<svg ', `<svg width="${it.w}" height="${it.h}" `);
    await page.setContent(`<!doctype html><html><body style="margin:0;background:#040404">${svg}</body></html>`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    await page.screenshot({ path: resolve(OUT, `${it.id}.jpg`), type: 'jpeg', quality: 92 });
    await page.close();
    console.log(`  ✓ ${it.id}.jpg  (${it.w}x${it.h})`);
  }
  await browser.close();
  console.log(`\nDone. Wrote ${ITEMS.length} images to assets/img/.\n`);
}
main().catch(e => { console.error(e); process.exit(1); });
