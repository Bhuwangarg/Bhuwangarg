#!/usr/bin/env node
/**
 * VANTA — image generator (Google Gemini / Imagen)
 * ------------------------------------------------------------------
 * Generates the product + lookbook imagery the website expects in
 * assets/img/. The site works WITHOUT this (it falls back to built-in
 * generative SVG art), but run this to drop in real photoreal images.
 *
 * USAGE:
 *   export GEMINI_API_KEY="your_key_here"      # from aistudio.google.com
 *   node scripts/generate-images.mjs
 *
 * It writes: assets/img/{hoodie,tee,pant,jacket,look1..look4}.jpg
 *
 * Model: imagen-3.0-generate-002 via the Generative Language API.
 * No external npm dependencies — uses Node 18+ global fetch.
 * ------------------------------------------------------------------
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'assets', 'img');

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const MODEL = process.env.IMAGEN_MODEL || 'imagen-3.0-generate-002';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predict`;

// Shared style so every image reads as one coherent brand world.
const STYLE =
  'high-fashion streetwear editorial photograph, true matte black garment, ' +
  'studio lighting with a single hard key light, deep shadows, concrete and ' +
  'dark steel backdrop, 35mm, fine film grain, muted desaturated palette with ' +
  'a single acid-green accent, premium, moody, cinematic, ultra detailed';

const JOBS = [
  { id: 'hoodie', prompt: `A heavyweight 480gsm black hoodie on a lean model, boxed fit, hood up, front view. ${STYLE}` },
  { id: 'tee',    prompt: `A boxy heavyweight black t-shirt on a model, three-quarter view, arms relaxed. ${STYLE}` },
  { id: 'pant',   prompt: `Black ripstop tactical cargo pants on a model, mid-shot of the legs and pockets. ${STYLE}` },
  { id: 'jacket', prompt: `A coated black nylon technical shell jacket with sealed seams on a model, collar up. ${STYLE}` },
  { id: 'look1',  prompt: `Full-length street editorial of a model in head-to-toe black streetwear at night, neon reflection. ${STYLE}` },
  { id: 'look2',  prompt: `Studio portrait of a model in a black hoodie against seamless dark grey paper, top light. ${STYLE}` },
  { id: 'look3',  prompt: `Extreme close-up detail of black garment-dyed fabric texture, stitched number tag reading 001. ${STYLE}` },
  { id: 'look4',  prompt: `Motion-blurred shot of a model walking fast in black streetwear, sense of speed, dark alley. ${STYLE}` }
];

async function generate(job) {
  const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: job.prompt }],
      parameters: { sampleCount: 1, aspectRatio: job.id.startsWith('look') ? '4:3' : '3:4' }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} for "${job.id}": ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error(`No image data returned for "${job.id}". Response: ${JSON.stringify(data).slice(0, 200)}`);
  const buf = Buffer.from(b64, 'base64');
  const out = resolve(OUT_DIR, `${job.id}.jpg`);
  await writeFile(out, buf);
  console.log(`  ✓ ${job.id}.jpg  (${(buf.length / 1024).toFixed(0)} KB)`);
}

async function main() {
  if (!API_KEY) {
    console.error('\n✗ No API key found. Set GEMINI_API_KEY (or GOOGLE_API_KEY) and re-run.');
    console.error('  Get one free at https://aistudio.google.com/app/apikey\n');
    console.error('  The website still works without images — it uses built-in generative art.\n');
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`\nVANTA · generating ${JOBS.length} images with ${MODEL}\n`);
  let ok = 0;
  for (const job of JOBS) {
    try { await generate(job); ok++; }
    catch (e) { console.error(`  ✗ ${job.id}: ${e.message}`); }
  }
  console.log(`\nDone. ${ok}/${JOBS.length} images written to assets/img/.`);
  console.log(ok < JOBS.length ? 'Some failed — the site falls back to generative art for those.\n' : 'Reload the site to see them live.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
