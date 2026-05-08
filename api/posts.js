import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY
const CRON_SECRET  = process.env.CRON_SECRET

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

  // POST — create new post
  if (req.method === 'POST') {
    const { scheduled_date, content, image_url } = req.body
    if (!scheduled_date || !content) {
      return res.status(400).json({ error: 'scheduled_date and content required' })
    }
    const { data, error } = await supabase
      .from('threads_posts')
      .insert([{ scheduled_date, content, image_url: image_url || null, status: 'pending' }])
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  // PATCH — update content of a pending post
  if (req.method === 'PATCH') {
    const { id, content } = req.body
    if (!id || !content) return res.status(400).json({ error: 'id and content required' })
    const { data, error } = await supabase
      .from('threads_posts')
      .update({ content })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  // DELETE — remove a pending post
  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'Missing id' })
    const { error } = await supabase
      .from('threads_posts')
      .delete()
      .eq('id', id)
      .eq('status', 'pending')
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
