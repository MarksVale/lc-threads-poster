import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = process.env.SUPABASE_URL
const SUPABASE_KEY  = process.env.SUPABASE_ANON_KEY
const CRON_SECRET   = process.env.CRON_SECRET
const STORE_URL     = 'https://latviancandles.store/products.json?limit=250'

export default async function handler(req, res) {
  // Auth check
  const auth = req.headers['authorization'] || ''
  if (CRON_SECRET && auth !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Fetch all products from the public Shopify endpoint
    const shopifyRes = await fetch(STORE_URL)
    if (!shopifyRes.ok) {
      return res.status(500).json({ error: 'Failed to fetch Shopify products' })
    }
    const { products } = await shopifyRes.json()

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    let updated = 0
    let skipped = 0

    for (const product of products) {
      const imageUrls = product.images
        ? product.images.map(img => img.src.split('?')[0])
        : []

      if (imageUrls.length === 0) {
        skipped++
        continue
      }

      const { error } = await supabase
        .from('products')
        .update({ image_urls: imageUrls })
        .eq('handle', product.handle)

      if (error) {
        console.error('Update failed for', product.handle, error.message)
      } else {
        updated++
      }
    }

    return res.json({
      ok: true,
      total: products.length,
      updated,
      skipped,
    })
  } catch (err) {
    console.error('sync-images error:', err)
    return res.status(500).json({ error: err.message })
  }
}
