import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const SUPABASE_URL           = process.env.SUPABASE_URL
const SUPABASE_KEY           = process.env.SUPABASE_ANON_KEY
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET

// ── Helpers ──────────────────────────────────────────────────────────────────

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function todayRiga() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]
}

function generatePost(product) {
  const title    = product.title || 'New Mold'
  const imageUrl = product.images?.[0]?.src || null

  const templates = [
    `New mold just added: ${title}.\n\nMade for beeswax specifically, flexible silicone, releases cleanly on its own. What candle shape have you been wanting to see that we have not made yet?`,
    `${title} is now in the store.\n\nWe tested this one several times before it was ready. Clean release, smooth beeswax surface finish. What shape is next on your wishlist?`,
    `Just listed: ${title}.\n\nFresh from our workshop in Latvia. Designed for beeswax from the start. What would you pair this shape with in a gift set?`,
    `New addition to the collection: ${title}.\n\nThis one has been on our list for a while. Finally happy with how it demolding turned out. What do you look for first when you try a new mold?`,
  ]

  const content = templates[Math.floor(Math.random() * templates.length)]
  return { content, image_url: imageUrl }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Read raw body before any parsing (needed for HMAC check)
  const rawBody = await readRawBody(req)

  // Verify the request is genuinely from Shopify
  const shopifyHmac = req.headers['x-shopify-hmac-sha256']
  const digest = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64')

  if (!shopifyHmac || digest !== shopifyHmac) {
    console.warn('Webhook HMAC mismatch — rejected')
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const product = JSON.parse(rawBody)
  console.log(`Received product webhook: "${product.title}" (status: ${product.status})`)

  // Only queue a post for active/published products
  if (product.status !== 'active') {
    return res.status(200).json({ message: 'Product not active, skipping' })
  }

  const { content, image_url } = generatePost(product)
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const today = todayRiga()

  const { data, error } = await supabase
    .from('threads_posts')
    .insert({
      scheduled_date: today,
      slot: 'morning',
      status: 'pending',
      content,
      image_url,
    })
    .select()
    .single()

  if (error) {
    console.error('Supabase insert failed:', error.message)
    return res.status(500).json({ error: error.message })
  }

  console.log(`Post queued: #${data.id} for product "${product.title}"`)
  return res.status(200).json({ success: true, post_id: data.id, preview: content.slice(0, 80) })
}
