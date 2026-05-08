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
  if (!auth.startsWith('Bearer ')) return false
  const token = auth.slice(7)
  // Simple check — same token as posts.js
  return token === CRON_SECRET
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // GET — list all products ordered by sort_order
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('products')
      .select('id, handle, title, description, image_url, price, sort_order, active, last_posted_at')
      .order('sort_order', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  // PATCH — toggle active or update sort_order
  if (req.method === 'PATCH') {
    const raw = await readBody(req)
    let body = {}
    try { body = JSON.parse(raw) } catch(e) { return res.status(400).json({ error: 'Bad JSON' }) }
    const { id, active, sort_order } = body
    if (!id) return res.status(400).json({ error: 'id required' })
    const updates = {}
    if (active !== undefined) updates.active = active
    if (sort_order !== undefined) updates.sort_order = sort_order
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' })
    const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
