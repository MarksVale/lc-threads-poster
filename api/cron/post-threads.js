import { createClient } from '@supabase/supabase-js'

const THREADS_USER_ID    = process.env.THREADS_USER_ID
const THREADS_TOKEN      = process.env.THREADS_ACCESS_TOKEN
const SUPABASE_URL       = process.env.SUPABASE_URL
const SUPABASE_KEY       = process.env.SUPABASE_ANON_KEY
const CRON_SECRET        = process.env.CRON_SECRET

// ── Threads API helpers ──────────────────────────────────────────────────────

async function createContainer(content, imageUrl, replyToId = null) {
  const params = new URLSearchParams({
    access_token: THREADS_TOKEN,
    text: content,
    media_type: imageUrl ? 'IMAGE' : 'TEXT',
  })
  if (imageUrl) params.append('image_url', imageUrl)
  if (replyToId) params.append('reply_to_id', replyToId)

  const res = await fetch(
    `https://graph.threads.net/v1.0/${THREADS_USER_ID}/threads`,
    { method: 'POST', body: params }
  )
  return res.json()
}

async function pollContainerStatus(containerId, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await fetch(
      `https://graph.threads.net/v1.0/${containerId}?fields=status,error_message&access_token=${THREADS_TOKEN}`
    )
    const data = await res.json()
    if (data.status === 'FINISHED') return
    if (data.status === 'ERROR') throw new Error(`Container error: ${data.error_message}`)
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
    `https://graph.threads.net/v1.0/${THREADS_USER_ID}/threads_publish`,
    { method: 'POST', body: params }
  )
  return res.json()
}

// ── Utility ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function todayRiga() {
  // UTC+3 in summer / UTC+2 in winter — close enough for daily scheduling
  return new Date(Date.now() + 3 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Security: only allow calls with the correct secret
  if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const today = todayRiga()

  // Fetch the next pending post scheduled for today or earlier
  const { data: post, error: fetchError } = await supabase
    .from('threads_posts')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_date', today)
    .order('scheduled_date', { ascending: true })
    .limit(1)
    .single()

  if (fetchError || !post) {
    console.log('No pending posts for today:', today)
    return res.status(200).json({ message: 'No posts to publish today' })
  }

  console.log(`Publishing post #${post.id}: "${post.content.slice(0, 60)}..."`)

  try {
    // Step 1: Create media container
    const container = await createContainer(post.content, post.image_url)
    if (!container.id) {
      throw new Error(`Container creation failed: ${JSON.stringify(container)}`)
    }
    console.log('Container created:', container.id)

    // Step 2: Wait for Threads to process the container
    await pollContainerStatus(container.id)
    console.log('Container ready')

    // Step 3: Publish
    const published = await publishContainer(container.id)
    if (!published.id) {
      throw new Error(`Publish failed: ${JSON.stringify(published)}`)
    }
    console.log('Published! Threads post ID:', published.id)

    // Step 4: Post a reply with the store link
    try {
      const replyContainer = await createContainer(
        'Our full collection is at latviancandles.store',
        null,
        published.id
      )
      if (replyContainer.id) {
        await pollContainerStatus(replyContainer.id)
        await publishContainer(replyContainer.id)
        console.log('Reply posted with store link')
      }
    } catch (replyErr) {
      // Reply failing should not fail the whole job
      console.error('Reply post failed (non-fatal):', replyErr.message)
    }

    // Step 5: Mark as posted in Supabase
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
      preview: post.content.slice(0, 80),
    })

  } catch (err) {
    console.error('Posting failed:', err.message)

    await supabase
      .from('threads_posts')
      .update({ status: 'failed' })
      .eq('id', post.id)

    return res.status(500).json({ error: err.message })
  }
}
