import { createClient } from '@supabase/supabase-js'

const THREADS_USER_ID = process.env.THREADS_USER_ID
const THREADS_TOKEN   = process.env.THREADS_ACCESS_TOKEN
const SUPABASE_URL    = process.env.SUPABASE_URL
const SUPABASE_KEY    = process.env.SUPABASE_ANON_KEY
const CRON_SECRET     = process.env.CRON_SECRET

// 7 reply variants — rotates by day-of-year
const REPLY_VARIANTS = [
  'Our full collection is at latviancandles.store',
  'Browse the full range at latviancandles.store',
  'Find all our candles at latviancandles.store',
  'Shop the collection at latviancandles.store',
  'See everything at latviancandles.store',
  'Explore our candles at latviancandles.store',
  'Discover the full collection at latviancandles.store',
]

function getReplyText(post) {
  if (post.reply_text && post.reply_text.trim()) return post.reply_text.trim()
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  )
  return REPLY_VARIANTS[dayOfYear % REPLY_VARIANTS.length]
}

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

// ── Utility ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms) })
}

function todayRiga() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0]
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.headers.authorization !== 'Bearer ' + CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const delaySec = Math.floor(Math.random() * 240)
  console.log('Random delay: ' + delaySec + 's')
  await sleep(delaySec * 1000)

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const today = todayRiga()
  const slot = (req.query && req.query.slot) || 'morning'

  const { data: post, error: fetchError } = await supabase
    .from('threads_posts')
    .select('*')
    .eq('status', 'approved')
    .eq('slot', slot)
    .lte('scheduled_date', today)
    .order('scheduled_date', { ascending: true })
    .limit(1)
    .single()

  if (fetchError || !post) {
    console.log('No approved posts for today:', today, 'slot:', slot)
    return res.status(200).json({ message: 'No posts to publish today' })
  }

  console.log('Publishing post #' + post.id + ': "' + post.content.slice(0, 60) + '..."')

  try {
    // Step 1: Create container
    const container = await createContainer(post.content, post.image_url)
    if (!container.id) {
      throw new Error('Container creation failed: ' + JSON.stringify(container))
    }
    console.log('Container created:', container.id)

    // Step 2: Wait for processing
    await pollContainerStatus(container.id)
    console.log('Container ready')

    // Step 3: Publish
    const published = await publishContainer(container.id)
    if (!published.id) {
      throw new Error('Publish failed: ' + JSON.stringify(published))
    }
    console.log('Published! Threads post ID:', published.id)

    // Step 4: Post reply with store link
    try {
      const replyText = getReplyText(post)
      const replyContainer = await createContainer(replyText, null, published.id)
      if (replyContainer.id) {
        await pollContainerStatus(replyContainer.id)
        await publishContainer(replyContainer.id)
        console.log('Reply posted:', replyText)
      }
    } catch (replyErr) {
      console.error('Reply post failed (non-fatal):', replyErr.message)
    }

    // Step 5: Mark as posted
    await supabase
      .from('threads_posts')
      .update({
        status: 'posted',
        posted_at: new Date().toISOString(),
        threads_post_id: published.id,
      })
      .eq('id', post.id)

    return res.status(200).json({
      success: true,
      post_id: published.id,
      slot: slot,
      scheduled_date: post.scheduled_date,
    })

  } catch (err) {
    console.error('Error posting to Threads:', err.message)
    await supabase
      .from('threads_posts')
      .update({ status: 'error', error_message: err.message })
      .eq('id', post.id)
    return res.status(500).json({ error: err.message })
  }
}
