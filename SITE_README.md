# VANTA — DROP 001

A single-drop streetwear storefront. **One drop. One hundred pieces. Then it's gone.**

Designed as a monolithic, motion-driven landing experience — black canvas,
heavyweight type, one signal-green accent, and animation that feels mechanical
and inevitable rather than decorative.

## What's here

```
index.html              # the whole site (one page, anchored sections)
assets/css/main.css     # design system + all motion
assets/js/main.js       # interactions: cursor, countdown, reveals, inventory, products
scripts/generate-images.mjs  # optional Gemini/Imagen image generator
assets/img/             # real images land here (created by the script)
```

## Run it

It's a static site — no build step, no dependencies.

```bash
# from the repo root
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just open `index.html` in a browser.

## Features

- **Live countdown** to the drop date.
- **Live inventory counter** — animates to show pieces already claimed, and
  ticks down as you reserve items. When it hits 0 the drop is "closed."
- **Product cards** with size selection + reserve flow (sold-out sizes shown).
- **Generative fallback art** — every image slot renders a unique seeded SVG
  swatch, so the site is *never blank*, even with zero photos.
- **Custom cursor, magnetic buttons, particle hero, scroll reveals, parallax,
  marquee, preloader** — all vanilla JS, ~10KB, no libraries.
- Fully **responsive**, respects **`prefers-reduced-motion`**, accessible nav.

## Make it yours

Open `assets/js/main.js` and edit the `CONFIG` object at the top:

- `dropDate` — when the countdown ends.
- `pieces` — total inventory (default 100).
- `products` — names, prices, descriptions.
- `soldOut` — which sizes are gone per product.

Brand name is `VANTA` throughout `index.html` — find & replace to rebrand.

## Real images (optional) — OpenAI or Gemini

The site ships with generative art so it looks finished immediately. To swap in
photoreal product/lookbook shots, set ONE provider key and run the generator:

```bash
# Option A — OpenAI (gpt-image-1)
export OPENAI_API_KEY="sk-..."     # https://platform.openai.com/api-keys
node scripts/generate-images.mjs

# Option B — Google (Imagen 4, falls back to Gemini image model)
export GEMINI_API_KEY="..."        # https://aistudio.google.com/app/apikey
node scripts/generate-images.mjs
```

If both keys are set, OpenAI is used. This writes
`hoodie/tee/pant/jacket/look1..4.jpg` into `assets/img/`. The site auto-detects
them and uses them in place of the SVG art on next load. Any image that fails
simply keeps its generative fallback — nothing breaks.

> Note: image generation requires a **billing-enabled** account on either
> provider. Free-tier keys typically return quota/plan errors (the OpenAI and
> Google free tiers don't include image generation), and the site will keep its
> generative art until a funded key is used.

### No API key? Render images locally (free)

The repo ships with a set of art-directed images in `assets/img/` that were
generated **offline, with no paid model**, by `scripts/render-art.mjs`. It draws
each garment + lookbook shot as a studio composition in SVG and rasterizes it
with a headless Chromium. To regenerate or tweak them:

```bash
npm i -D playwright-core && npx playwright install chromium
node scripts/render-art.mjs           # writes assets/img/*.jpg
```

Edit the garment paths / colors in that file to restyle. When you later add a
billing-enabled OpenAI or Gemini key, `generate-images.mjs` will overwrite these
with photoreal versions.

## Deploy (GitHub Pages)

Repo Settings → Pages → Source: `main` (or this branch), root. Done.

## Wiring up the waitlist

The "Get Access" form currently stores emails in `localStorage` (honest demo —
nothing is silently dropped or faked). To collect real signups, point the
form's submit handler in `main.js` at your provider (Mailchimp, Resend,
Formspree, a serverless function, etc.).
