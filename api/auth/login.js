function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  let body
  try {
    const raw = await readBody(req)
    body = JSON.parse(raw)
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
