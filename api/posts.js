import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY
const CRON_SECRET  = process.env.CRON_SECRET

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const auth = req.headers.authorization
  if (!auth || auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // GET — list all posts
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('threads_posts')
      .select('*')
      .order('scheduled_date', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  // Parse body for POST/PATCH
  let body = {}
  if (req.method === 'POST' || req.method === 'PATCH') {
    try {
      const raw = await readBody(req)
      body = raw ? JSON.parse(raw) : {}
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON' })
    }
  }

  // POST — create new post
  if (req.method === 'POST') {
    const { scheduled_date, content, image_url, slot, status, reply_text } = body
    if (!scheduled_date || !content) {
      return res.status(400).json({ error: 'scheduled_date and content required' })
    }
    const { data, error } = await supabase
      .from('threads_posts')
      .insert([{
        scheduled_date,
        content,
        image_url: image_url || null,
        slot: slot || 'morning',
        status: status || 'pending',
        reply_text: reply_text || null,
      }])
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  // PATCH — update content, status, or reply_text
  if (req.method === 'PATCH') {
    const { id, content, status, reply_text } = body
    if (!id) return res.status(400).json({ error: 'id required' })

    const updates = {}
    if (content !== undefined) updates.content = content
    if (status !== undefined) updates.status = status
    if (reply_text !== undefined) updates.reply_text = reply_text

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' })
    }

    const { data, error } = await supabase
      .from('threads_posts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  // DELETE — remove a post
  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'Missing id' })
    const { error } = await supabase
      .from('threads_posts')
      .delete()
      .eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
