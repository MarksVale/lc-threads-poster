export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  const { email, password } = body || {}

  if (
    email === process.env.LOGIN_EMAIL &&
    password === process.env.LOGIN_PASSWORD
  ) {
    return res.status(200).json({ token: process.env.CRON_SECRET })
  }

  return res.status(401).json({ error: 'Invalid email or password' })
}
