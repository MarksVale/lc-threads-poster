# Latvian Candles — Brand Profile & Voice Guide

> **This file is the living brand brain.** Every time you learn something new about the business — a corrected fact, a new product, a preference Mark expresses — update this file. It is the source of truth for all content generation, post writing, and brand decisions.

Last updated: 2026-05-08 (end of day 2)

---

## 1. Who We Are

**Business name:** Latvian Candles  
**Store:** latviancandles.store  
**Platform:** Shopify  
**Location:** Kalēju iela, Mazsalaca, LV-4215, Latvia  
**Contact:** info@latviancandles.store  
**Type:** Family business — small team, personal, hands-on  
**Owner / voice behind content:** Mark (Marks Vāle)

We make and sell **silicone molds specifically designed for beeswax candles**. Not soy, not paraffin — beeswax. That specificity is our identity and our differentiator. We are a family of candlemakers who started making molds because we needed them ourselves, and now sell them worldwide.

---

## 2. What We Sell

### Core product
**Silicone candle molds for beeswax candles**

- 180+ designs in the catalog (102 active products currently in the Threads rotation)
- Made from premium flexible silicone
- Built for durability — can be used countless times with proper care
- No separator needed — flexible silicone releases candles cleanly on its own
- Molds are **not cut** — this is by design. The candle comes out on its own. Uncut construction is a feature, not a flaw.
- Molds are **not marketed as "large"** — the selling point is sturdy, full silicone construction
- **Currency: EUR (€)** — never use GBP (£) in any content

### Product categories (known)
- Pillar molds (classic, bee cell texture, etc.)
- Tea light molds
- Birthday candle molds
- Christmas tree molds
- Obelisk molds
- Geometric / Japandi-style designs
- Many more (180+ total)

### Top 5 bestsellers in 2025
1. Bee Cells Pillars
2. Birthday Candles
3. Christmas Tree (Plain)
4. Tea Lights
5. Pillars

### What the molds are NOT
- **Not food-grade silicone** — never state or imply this. If unsure about any material property, ask Mark.
- Not designed for soy wax or paraffin (though they could work — we focus on beeswax)

---

## 3. Key Technical Facts (verified by Mark)

| Topic | Fact |
|---|---|
| Best pour temperature | **70°C** — tested, this is the sweet spot |
| Silicone food safety | **NOT food-grade** — never claim this |
| Demolding | Wax shines and releases easily; no cutting needed |
| Uncut molds | By design — candle releases naturally |
| Mold size | Not marketed as large — selling point is full silicone construction |
| Ships | Worldwide |
| Candle price range (retail) | ~€4 to ~€15 per finished candle |
| Currency | EUR (€) only — never £ |

> **RULE: Never assume facts about materials, safety ratings, or properties. If unsure, ask Mark.**

---

## 4. Brand Voice

### Tone
- Warm, personal, like a message from a real person
- Direct — no fluff, no corporate speak
- Friendly but never salesy
- Honest and specific — real details beat vague claims
- Conversational, like talking to a fellow maker

### Language
- **English only** (for Threads and all social content)
- **No em dashes ( — ) ever** — use commas or short sentences instead
- **No long dashes of any kind** — this is a hard rule, Mark is very clear on this
- No clichés or AI-sounding phrases (e.g. "would not have it any other way", "dive into", "it's all about")
- No excessive adjectives ("amazing", "incredible", "stunning")

### Content structure for Threads
- Posts should **drive engagement and discussion** — not just list facts
- End posts with a **question** to invite replies
- **Never include the store link in the main post body** — it goes in a reply to every post
- Keep posts punchy — Threads rewards shorter, snappier content
- Real experience and specific numbers beat generic statements

### What we like to talk about
- The craft of beeswax candle making
- Tips and techniques (pour temp, demolding, wick choice)
- Design inspiration (shapes, aesthetics, room pairings)
- The business side — starting a candle business, scaling up
- Behind the scenes — family business life, making in Latvia
- Community — what our customers are making

---

## 5. Social Media & Posting System

| Platform | Status |
|---|---|
| Threads | Active — auto-posting via this system |
| Instagram | Active |
| Facebook | Active |
| Pinterest | Active |

### Threads Auto-Post System (as of 2026-05-08)

**GitHub repo:** MarksVale/lc-threads-poster  
**Deployed on:** Vercel (lc-threads-poster.vercel.app)  
**Database:** Supabase (project: latvian-candles-threads, id: xrchfbhhxcocfbuwswvh, region: eu-north-1)

**Daily posting schedule (alternating, 2 posts per day max):**
- Even days: morning content post (07:00 UTC) + product post (10:00 UTC)
- Odd days: product post (10:00 UTC) + evening content post (17:00 UTC)
- Each content post has a 0-4 min random delay so it doesn't land exactly on the hour

**Cron jobs (vercel.json):**
- 07:00 UTC — post-threads?slot=morning (even days only)
- 10:00 UTC — post-products (every day)
- 17:00 UTC — post-threads?slot=evening (odd days only)
- 05:00 UTC — sync-images (every day — re-fetches all product images from latviancandles.store/products.json and updates image_urls in Supabase)

**Content posts (threads_posts table):**
- Mark queues posts via the web UI (email/password login)
- Posts must be approved before they go live
- Reply text rotates through 7 variants by day-of-year (e.g. "Our full collection is at latviancandles.store")
- Per-post reply_text override available if needed

**Product posts (products table):**
- 102 active products in rotation
- One product posted per day, picked by oldest last_posted_at (cycles through all 102 then repeats)
- Products with 2+ images post as a Threads carousel (up to 10 images). Products with 1 image post as a single image post.
- Each product post: image(s) + description as main post, reply with direct product link
- Reply text rotates through 5 variants (e.g. "Get yours at latviancandles.store/products/[handle]")
- "Post now" button in UI for manual out-of-order posting (cron picks up from where rotation left off)
- Product descriptions editable per-card in the UI
- image_urls column (TEXT[]) stores all images per product, auto-synced daily from Shopify

**Image data (as of 2026-05-08):**
- 31 of 102 products have multiple images (carousel-eligible)
- Max images on one product: 11 (Cheese mold)
- 71 products have 1 image — many older products only have 1 photo uploaded in Shopify
- Source: public endpoint latviancandles.store/products.json — no API key needed

**Web UI features:**
- Grid, List, Calendar views for content post queue
- Approve, Edit, Undo, Delete, Copy, Edit Reply per post
- Products tab: all 102 products with image count badge ("X photos · carousel" or "1 photo")
- Preview, Edit text, Post now, toggle active/inactive per product card
- Login: email + password (stored as LOGIN_EMAIL / LOGIN_PASSWORD env vars on Vercel)

**Intro post queue (written, ready to approve):**
9 posts written for the account launch — introducing the brand naturally, no selling. Sequence:
1. First post ever — showing up on Threads
2. Who's behind the account (Mark and family, Mazsalaca)
3. Why Threads (want to talk to people, not just post product photos)
4. Latvia angle — Mazsalaca, ships worldwide
5. What we'll post about (craft, tips, business, no hard selling)
6. First post (existing) — arrival + what we do
7. Why we started — couldn't find good beeswax molds, made our own
8. What we actually do — molds not candles, beeswax specifically
9. The family part — small team, personal, ships from Mazsalaca

---

## 6. Customer Profile

- Hobbyist candle makers looking to upgrade their molds
- Small candle businesses and artisans
- People who want beeswax-specific molds (not generic molds)
- Interior design / home decor enthusiasts (Japandi, Scandinavian styles)
- Gift makers
- People transitioning from hobby to small business

Many customers are repeat buyers — loyalty is a real strength.

---

## 7. What Makes Us Different

1. **Beeswax-specific** — our molds are designed for beeswax, not generic wax
2. **Family business** — real people, personal service, fast chat response
3. **180+ designs** — one of the largest selections anywhere
4. **Ships worldwide** — accessible to makers globally
5. **Durable construction** — full premium flexible silicone, made to last
6. **Clean release** — no separator needed, smooth finish every time
7. **Candlemakers ourselves** — we know what a good mold needs because we use them

---

## 8. Content Rules (non-negotiable)

1. Never put the store link in the main post — always in a reply
2. Never claim silicone is food-grade
3. Never call molds "large" — they are not marketed on size
4. Pour temperature is 70°C (not 60-65°C)
5. Every post should end with a question
6. **No em dashes, no long dashes, no dashes of any kind used as punctuation** — Mark is very firm on this
7. English only
8. Currency is EUR (€) — never GBP (£)
9. If uncertain about any product fact — do not guess, ask Mark
10. No HTML tags in any content ever

---

## 9. Things to Explore / Open Questions

- Exact mold dimensions / weights (not published clearly online)
- Wick recommendations for each mold size
- Whether B2B / wholesale is available (contact page suggests yes)
- Whether there is a Threads handle / @username
- Total number of reviews / star ratings
- Countries that order most (shipping insights)

---

## 10. Update Log

| Date | What was updated |
|---|---|
| 2026-05-08 | Initial profile created from conversation with Mark + online research |
| 2026-05-08 | Key corrections: no food-grade claim, 70°C pour temp, molds not large, no store link in main post, uncut molds by design |
| 2026-05-08 | Full Threads auto-post system built and deployed. Products table seeded with 102 active products. Alternating 2-posts/day schedule. Products UI with preview/edit/post-now. EUR not GBP. No em dashes rule reinforced. |
| 2026-05-08 | Carousel support added: image_urls fetched from public Shopify endpoint, 31/102 products have multiple images. Daily sync-images cron added at 05:00 UTC. Product cards show image count badge. Post-now also supports carousels. 9 intro posts written for account launch. |
