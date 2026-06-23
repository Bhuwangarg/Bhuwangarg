#!/usr/bin/env node
/**
 * VANTA — image generator (OpenAI  or  Google Gemini / Imagen)
 * ------------------------------------------------------------------
 * Generates the product + lookbook imagery the website expects in
 * assets/img/. The site works WITHOUT this (it falls back to built-in
 * generative SVG art), but run this to drop in real photoreal images.
 *
 * USAGE — pick ONE provider by exporting its key, then run:
 *   export OPENAI_API_KEY="sk-..."        # uses gpt-image-1   (platform.openai.com)
 *   #  or
 *   export GEMINI_API_KEY="..."           # uses Imagen/Gemini (aistudio.google.com)
 *   node scripts/generate-images.mjs
 *
 * If both keys are set, OpenAI is used. It writes:
 *   assets/img/{hoodie,tee,pant,jacket,look1..look4}.jpg
 *
 * No external npm dependencies — uses Node 18+ global fetch.
 * ------------------------------------------------------------------
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'assets', 'img');

// --- Provider selection: OpenAI wins if its key is present, else Gemini. ---
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const PROVIDER = OPENAI_KEY ? 'openai' : (GEMINI_KEY ? 'gemini' : null);

// OpenAI
const OPENAI_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
// Google
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const IMAGEN_MODEL = process.env.IMAGEN_MODEL || 'imagen-4.0-generate-001';
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

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

// OpenAI gpt-image-1. Returns base64 or throws with the API message.
async function viaOpenAI(job) {
  const size = job.id.startsWith('look') ? '1536x1024' : '1024x1536'; // landscape vs portrait
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: OPENAI_MODEL, prompt: job.prompt, n: 1, size, quality: 'high' })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${data?.error?.message || ''}`.trim());
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('no image in OpenAI response');
  return b64;
}

// Try Imagen (predict). Returns base64 or throws with the API message.
async function viaImagen(job) {
  const res = await fetch(`${BASE}/${IMAGEN_MODEL}:predict?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: job.prompt }],
      parameters: { sampleCount: 1, aspectRatio: job.id.startsWith('look') ? '4:3' : '3:4' }
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${data?.error?.message || ''}`.trim());
  const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('no image in Imagen response');
  return b64;
}

// Try the Gemini image model (generateContent). Returns base64 or throws.
async function viaGemini(job) {
  const res = await fetch(`${BASE}/${GEMINI_IMAGE_MODEL}:generateContent?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: job.prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] }
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${data?.error?.message || ''}`.trim());
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const img = parts.find(p => p.inlineData?.data);
  if (!img) throw new Error('no image in Gemini response');
  return img.inlineData.data;
}

async function generate(job) {
  let b64, source;
  if (PROVIDER === 'openai') {
    b64 = await viaOpenAI(job); source = OPENAI_MODEL;
  } else {
    try { b64 = await viaImagen(job); source = IMAGEN_MODEL; }
    catch (e1) {
      try { b64 = await viaGemini(job); source = GEMINI_IMAGE_MODEL; }
      catch (e2) { throw new Error(`Imagen[${e1.message}] / Gemini[${e2.message}]`); }
    }
  }
  const buf = Buffer.from(b64, 'base64');
  const out = resolve(OUT_DIR, `${job.id}.jpg`);
  await writeFile(out, buf);
  console.log(`  ✓ ${job.id}.jpg  (${(buf.length / 1024).toFixed(0)} KB · ${source})`);
}

async function main() {
  if (!PROVIDER) {
    console.error('\n✗ No API key found. Set ONE of these and re-run:');
    console.error('    export OPENAI_API_KEY="sk-..."   # platform.openai.com/api-keys');
    console.error('    export GEMINI_API_KEY="..."      # aistudio.google.com/app/apikey\n');
    console.error('  The website still works without images — it uses built-in generative art.\n');
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });
  const using = PROVIDER === 'openai'
    ? OPENAI_MODEL
    : `${IMAGEN_MODEL}, falling back to ${GEMINI_IMAGE_MODEL}`;
  console.log(`\nVANTA · generating ${JOBS.length} images via ${PROVIDER} (${using})\n`);
  let ok = 0;
  for (const job of JOBS) {
    try { await generate(job); ok++; }
    catch (e) { console.error(`  ✗ ${job.id}: ${e.message}`); }
  }
  console.log(`\nDone. ${ok}/${JOBS.length} images written to assets/img/.`);
  console.log(ok < JOBS.length ? 'Some failed — the site falls back to generative art for those.\n' : 'Reload the site to see them live.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
