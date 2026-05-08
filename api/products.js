import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = process.env.SUPABASE_URL
const SUPABASE_KEY  = process.env.SUPABASE_ANON_KEY
const CRON_SECRET   = process.env.CRON_SECRET

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function checkAuth(req) {
  const auth = req.headers['authorization'] || ''
  return auth === 'Bearer ' + CRON_SECRET
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // GET — list all products
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('products')
      .select('id, handle, title, description, image_url, price, sort_order, active, last_posted_at')
      .order('sort_order', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  // PATCH — update active, description, or sort_order
  if (req.method === 'PATCH') {
    const raw = await readBody(req)
    let body = {}
    try { body = JSON.parse(raw) } catch(e) { return res.status(400).json({ error: 'Bad JSON' }) }
    const { id, active, sort_order, description } = body
    if (!id) return res.status(400).json({ error: 'id required' })
    const updates = {}
    if (active !== undefined) updates.active = active
    if (sort_order !== undefined) updates.sort_order = sort_order
    if (description !== undefined) updates.description = description
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' })
    const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  // POST — post a specific product right now
  if (req.method === 'POST') {
    const raw = await readBody(req)
    let body = {}
    try { body = JSON.parse(raw) } catch(e) { return res.status(400).json({ error: 'Bad JSON' }) }
    const { id } = body
    if (!id) return res.status(400).json({ error: 'id required' })

    const { data: product, error: pickErr } = await supabase
      .from('products').select('*').eq('id', id).single()
    if (pickErr || !product) return res.status(404).json({ error: 'Product not found' })

    const THREADS_USER_ID = process.env.THREADS_USER_ID
    const THREADS_TOKEN   = process.env.THREADS_ACCESS_TOKEN

    async function createContainer(content, imageUrl, replyToId) {
      const params = new URLSearchParams({ access_token: THREADS_TOKEN, text: content, media_type: imageUrl ? 'IMAGE' : 'TEXT' })
      if (imageUrl) params.append('image_url', imageUrl)
      if (replyToId) params.append('reply_to_id', replyToId)
      const r = await fetch('https://graph.threads.net/v1.0/' + THREADS_USER_ID + '/threads', { method: 'POST', body: params })
      return r.json()
    }

    async function pollStatus(cid) {
      const deadline = Date.now() + 45000
      while (Date.now() < deadline) {
        const r = await fetch('https://graph.threads.net/v1.0/' + cid + '?fields=status,error_message&access_token=' + THREADS_TOKEN)
        const d = await r.json()
        if (d.status === 'FINISHED') return
        if (d.status === 'ERROR') throw new Error(d.error_message)
        await new Promise(r => setTimeout(r, 3000))
      }
      throw new Error('Timed out')
    }

    async function publish(cid) {
      const params = new URLSearchParams({ creation_id: cid, access_token: THREADS_TOKEN })
      const r = await fetch('https://graph.threads.net/v1.0/' + THREADS_USER_ID + '/threads_publish', { method: 'POST', body: params })
      return r.json()
    }

    try {
      const container = await createContainer(product.description, product.image_url, null)
      if (!container.id) throw new Error('Container failed: ' + JSON.stringify(container))
      await pollStatus(container.id)
      const published = await publish(container.id)
      if (!published.id) throw new Error('Publish failed: ' + JSON.stringify(published))

      await new Promise(r => setTimeout(r, 2000))
      const replyText = 'Get yours at latviancandles.store/products/' + product.handle
      const replyContainer = await createContainer(replyText, null, published.id)
      if (replyContainer.id) {
        await pollStatus(replyContainer.id)
        await publish(replyContainer.id)
      }

      await supabase.from('products').update({ last_posted_at: new Date().toISOString() }).eq('id', id)

      return res.json({ ok: true, threads_id: published.id, product: product.handle })
    } catch(err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
