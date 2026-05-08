import { createClient } from '@supabase/supabase-js'

const THREADS_USER_ID = process.env.THREADS_USER_ID
const THREADS_TOKEN   = process.env.THREADS_ACCESS_TOKEN
const SUPABASE_URL    = process.env.SUPABASE_URL
const SUPABASE_KEY    = process.env.SUPABASE_ANON_KEY
const CRON_SECRET     = process.env.CRON_SECRET

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function pollContainerStatus(containerId, timeoutMs) {
  timeoutMs = timeoutMs || 45000
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await fetch(
      'https://graph.threads.net/v1.0/' + containerId +
      '?fields=status,error_message&access_token=' + THREADS_TOKEN
    )
    const data = await res.json()
    if (data.status === 'FINISHED') return
    if (data.status === 'ERROR') throw new Error('Container error: ' + data.error_message)
    await sleep(3000)
  }
  throw new Error('Container timed out after ' + timeoutMs + 'ms')
}

async function publishContainer(containerId) {
  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: THREADS_TOKEN,
  })
  const res = await fetch(
    'https://graph.threads.net/v1.0/' + THREADS_USER_ID + '/threads_publish',
    { method: 'POST', body: params }
  )
  return res.json()
}

// Single image post
async function createSinglePost(text, imageUrl) {
  const params = new URLSearchParams({
    access_token: THREADS_TOKEN,
    text,
    media_type: 'IMAGE',
    image_url: imageUrl,
  })
  const res = await fetch(
    'https://graph.threads.net/v1.0/' + THREADS_USER_ID + '/threads',
    { method: 'POST', body: params }
  )
  return res.json()
}

// Carousel post — creates item containers then a carousel container
async function createCarouselPost(text, imageUrls) {
  // Step 1: create one carousel item per image (max 10 for Threads)
  const urls = imageUrls.slice(0, 10)
  const itemIds = []

  for (const url of urls) {
    const params = new URLSearchParams({
      access_token: THREADS_TOKEN,
      media_type: 'IMAGE',
      image_url: url,
      is_carousel_item: 'true',
    })
    const res = await fetch(
      'https://graph.threads.net/v1.0/' + THREADS_USER_ID + '/threads',
      { method: 'POST', body: params }
    )
    const data = await res.json()
    if (!data.id) throw new Error('Carousel item creation failed: ' + JSON.stringify(data))
    itemIds.push(data.id)
  }

  // Step 2: poll each item until FINISHED
  for (const id of itemIds) {
    await pollContainerStatus(id, 45000)
  }

  // Step 3: create carousel container
  const params = new URLSearchParams({
    access_token: THREADS_TOKEN,
    media_type: 'CAROUSEL',
    children: itemIds.join(','),
    text,
  })
  const res = await fetch(
    'https://graph.threads.net/v1.0/' + THREADS_USER_ID + '/threads',
    { method: 'POST', body: params }
  )
  return res.json()
}

// Reply to a post
async function createReply(text, replyToId) {
  const params = new URLSearchParams({
    access_token: THREADS_TOKEN,
    text,
    media_type: 'TEXT',
    reply_to_id: replyToId,
  })
  const res = await fetch(
    'https://graph.threads.net/v1.0/' + THREADS_USER_ID + '/threads',
    { method: 'POST', body: params }
  )
  return res.json()
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const auth = req.headers['authorization'] || ''
  if (CRON_SECRET && auth !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  try {
    // Pick next active product — least recently posted
    const { data: product, error: pickErr } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('last_posted_at', { ascending: true, nullsFirst: true })
      .order('sort_order', { ascending: true })
      .limit(1)
      .single()

    if (pickErr || !product) {
      return res.status(404).json({ error: 'No active products found', detail: pickErr?.message })
    }

    const PRODUCT_REPLY_VARIANTS = [
      'Get yours at latviancandles.store/products/',
      'Shop this mold at latviancandles.store/products/',
      'Find it at latviancandles.store/products/',
      'Order yours at latviancandles.store/products/',
      'See more at latviancandles.store/products/',
    ]
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
    const replyText = PRODUCT_REPLY_VARIANTS[dayOfYear % PRODUCT_REPLY_VARIANTS.length] + product.handle

    // Decide: carousel or single image
    const images = product.image_urls && product.image_urls.length > 1
      ? product.image_urls
      : null
    const singleImage = product.image_url

    let container
    if (images) {
      container = await createCarouselPost(product.description, images)
    } else {
      container = await createSinglePost(product.description, singleImage)
    }

    if (!container.id) {
      return res.status(500).json({ error: 'Container creation failed', detail: container })
    }

    // Poll and publish
    await pollContainerStatus(container.id, 60000)
    const published = await publishContainer(container.id)

    if (!published.id) {
      return res.status(500).json({ error: 'Publish failed', detail: published })
    }

    const mainPostId = published.id

    // Post reply with product link
    await sleep(2000)
    const replyContainer = await createReply(replyText, mainPostId)
    if (replyContainer.id) {
      await pollContainerStatus(replyContainer.id, 30000)
      await publishContainer(replyContainer.id)
    } else {
      console.error('Reply container failed:', replyContainer)
    }

    // Update last_posted_at
    await supabase
      .from('products')
      .update({ last_posted_at: new Date().toISOString() })
      .eq('id', product.id)

    return res.json({
      ok: true,
      product: product.handle,
      threads_id: mainPostId,
      carousel: !!images,
      image_count: images ? images.length : 1,
    })
  } catch (err) {
    console.error('post-products error:', err)
    return res.status(500).json({ error: err.message })
  }
}
