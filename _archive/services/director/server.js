import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import Redis from 'ioredis'
import http from 'http'
import { WebSocketServer } from 'ws'

const app = express()
app.use(cors())
app.use(express.json())

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
let redis = null
let redisSub = null
let redisReady = false
try {
  redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
  redisSub = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
  Promise.all([redis.connect(), redisSub.connect()]).then(() => {
    redisReady = true
    redisSub.psubscribe('control:*')
    redisSub.on('pmessage', (pattern, channel, msg) => {
      const sessionId = channel.split(':')[1]
      forwardControl(sessionId, JSON.parse(msg))
    })
  }).catch(() => { redisReady = false })
} catch { redisReady = false }

const sessions = new Map()

app.post('/api/auth/login', (req, res) => {
  const { email } = req.body || {}
  const token = jwt.sign({ sub: email || 'user' }, JWT_SECRET, { expiresIn: '1h' })
  res.json({ token })
})

app.post('/api/devices/register', (req, res) => {
  const { deviceName } = req.body || {}
  const deviceId = uuidv4()
  res.json({ deviceId, deviceName })
})

app.post('/api/session/create', (req, res) => {
  const sessionId = uuidv4()
  sessions.set(sessionId, { clients: new Set() })
  res.json({ sessionId, wsEndpoint: `/ws/${sessionId}` })
})

app.post('/api/session/:id/start', (req, res) => {
  const { id } = req.params
  if (!sessions.has(id)) return res.status(404).json({ error: 'session not found' })
  res.json({ ok: true })
})

app.post('/api/session/:id/stop', async (req, res) => {
  const { id } = req.params
  if (!sessions.has(id)) return res.status(404).json({ error: 'session not found' })
  res.json({ ok: true })
})

app.get('/api/session/:id/status', (req, res) => {
  const { id } = req.params
  const s = sessions.get(id)
  if (!s) return res.status(404).json({ error: 'session not found' })
  res.json({ sessionId: id, connectedClients: s.clients.size })
})

const server = http.createServer(app)
const wss = new WebSocketServer({ server })

const memoryEvents = new Map()
function publishEvent(sessionId, event) {
  if (redisReady && redis) {
    const stream = `events:${sessionId}`
    redis.xadd(stream, '*', 'data', JSON.stringify(event))
    return
  }
  if (!memoryEvents.has(sessionId)) memoryEvents.set(sessionId, [])
  memoryEvents.get(sessionId).push({ ts: Date.now(), event })
}

function forwardControl(sessionId, message) {
  const s = sessions.get(sessionId)
  if (!s) return
  for (const ws of s.clients) {
    try { ws.send(JSON.stringify(message)) } catch {}
  }
}

setInterval(() => {
  for (const [sessionId, arr] of memoryEvents.entries()) {
    if (arr.length > 0) {
      const last = arr[arr.length - 1]
      const s = sessions.get(sessionId)
      if (!s) continue
      for (const ws of s.clients) {
        try { ws.send(JSON.stringify({ type: 'debug_event_count', count: arr.length })) } catch {}
      }
    }
  }
}, 1000)

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const parts = url.pathname.split('/')
  const sessionId = parts[2]
  if (!sessionId || !sessions.has(sessionId)) {
    ws.close()
    return
  }
  sessions.get(sessionId).clients.add(ws)

  ws.on('message', (raw) => {
    let obj
    try { obj = JSON.parse(raw.toString()) } catch { return }
    if (obj && obj.type === 'metadata') publishEvent(sessionId, obj)
  })

  ws.on('close', () => {
    sessions.get(sessionId).clients.delete(ws)
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  
})
