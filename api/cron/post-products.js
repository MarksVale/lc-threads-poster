import { createClient } from '@supabase/supabase-js'

const THREADS_USER_ID = process.env.THREADS_USER_ID
const THREADS_TOKEN   = process.env.THREADS_ACCESS_TOKEN
const SUPABASE_URL    = process.env.SUPABASE_URL
const SUPABASE_KEY    = process.env.SUPABASE_ANON_KEY
const CRON_SECRET     = process.env.CRON_SECRET

// ── Threads API helpers ───────────────────────────────────────────────────────

async function createContainer(content, imageUrl, replyToId) {
  const params = new URLSearchParams({
    access_token: THREADS_TOKEN,
    text: content,
    media_type: imageUrl ? 'IMAGE' : 'TEXT',
  })
  if (imageUrl) params.append('image_url', imageUrl)
  if (replyToId) params.append('reply_to_id', replyToId)

  const res = await fetch(
    'https://graph.threads.net/v1.0/' + THREADS_USER_ID + '/threads',
    { method: 'POST', body: params }
  )
  return res.json()
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
  throw new Error('Container processing timed out after 45s')
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Auth check
  const auth = req.headers['authorization'] || ''
  if (CRON_SECRET && auth !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  try {
    // Pick the next active product to post — least recently posted, ordered by sort_order
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

    const replyText = 'Get yours at latviancandles.store/products/' + product.handle

    // Step 1: create main container (image post with description)
    const container = await createContainer(product.description, product.image_url, null)
    if (!container.id) {
      return res.status(500).json({ error: 'Container creation failed', detail: container })
    }

    // Step 2: wait for processing
    await pollContainerStatus(container.id)

    // Step 3: publish
    const published = await publishContainer(container.id)
    if (!published.id) {
      return res.status(500).json({ error: 'Publish failed', detail: published })
    }

    const mainPostId = published.id

    // Step 4: create reply container with product link
    await sleep(2000)
    const replyContainer = await createContainer(replyText, null, mainPostId)
    if (!replyContainer.id) {
      console.error('Reply container failed:', replyContainer)
      // Don't fail the whole job — main post succeeded
    } else {
      await pollContainerStatus(replyContainer.id)
      await publishContainer(replyContainer.id)
    }

    // Step 5: record last_posted_at
    await supabase
      .from('products')
      .update({ last_posted_at: new Date().toISOString() })
      .eq('id', product.id)

    return res.json({
      ok: true,
      product: product.handle,
      threads_id: mainPostId,
    })
  } catch (err) {
    console.error('post-products error:', err)
    return res.status(500).json({ error: err.message })
  }
}
