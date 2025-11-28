const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { chooseActiveCamera } = require('../../packages/decision-engine');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { AccessToken } = require('livekit-server-sdk');
const { RoomServiceClient } = require('livekit-server-sdk');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());
app.use(require('./auth'));
const storageDir = path.join(__dirname, 'storage');
if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
const upload = multer({ dest: storageDir });

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/metrics', (_req, res) => {
  const activeSessions = Array.from(sessions.values()).length;
  res.json({ ok: true, activeSessions });
});
app.get('/live/token', (req, res) => {
  const url = process.env.LIVEKIT_URL || '';
  const apiKey = process.env.LIVEKIT_API_KEY || '';
  const apiSecret = process.env.LIVEKIT_API_SECRET || '';
  const roomName = req.query.roomId || 'default';
  const identity = req.query.identity || 'director';
  if (!apiKey || !apiSecret) return res.status(400).json({ ok: false });
  const at = new AccessToken(apiKey, apiSecret, { identity, ttl: 3600 });
  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
  const token = at.toJwt();
  res.json({ ok: true, url, token });
});
app.get('/assets/:sessionId', (req, res) => {
  const sid = req.params.sessionId;
  const dir = ensureSessionDir(sid);
  if (!fs.existsSync(dir)) return res.status(404).json({ ok: false });
  const files = fs.readdirSync(dir).filter(Boolean);
  const out = files.map((f) => ({ name: f, url: `/download/${sid}/${encodeURIComponent(f)}` }));
  res.json({ ok: true, files: out });
});
app.get('/download/:sessionId/:name', (req, res) => {
  const sid = req.params.sessionId;
  const name = req.params.name;
  const dir = ensureSessionDir(sid);
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) return res.status(404).end();
  res.sendFile(file);
});
app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ ok: true, file: req.file?.filename || null });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// In-memory session state (Room -> camera scores)
const rooms = new Map();
const sessions = new Map();

io.on('connection', (socket) => {
  let roomId = null;
  let lastActive = null;
  let lastSwitchAt = 0;

  socket.on('join', (payload) => {
    roomId = payload?.roomId || 'default';
    socket.join(roomId);
    if (!rooms.has(roomId)) rooms.set(roomId, {});
    socket.emit('joined', { roomId });
  });

  // Client-side metadata: { camId, vad (0..1), motion (0..1) }
  socket.on('metadata', (m) => {
    if (!roomId) return;
    const room = rooms.get(roomId) || {};
    room[m.camId] = { vad: m.vad ?? 0, motion: m.motion ?? 0 };
    rooms.set(roomId, room);

    // Make a switch decision
    const now = Date.now();
    if (now - lastSwitchAt < 800) return;
    const decision = chooseActiveCamera({
      scores: room,
      lastActive,
      lastSwitchAt,
      now,
      minCutIntervalMs: 1500,
      minConfidence: 0.6,
    });
    if (decision.active !== lastActive) {
      lastActive = decision.active;
      lastSwitchAt = decision.lastSwitchAt || now;
      io.to(roomId).emit('switch', { active: lastActive, ts: now });
      const sid = sessions.get(roomId)?.sessionId;
      if (sid) appendEvent(sid, { type: 'switch', to: lastActive, ts: now });
    }
  });

  socket.on('event', (e) => {
    const sid = sessions.get(roomId)?.sessionId;
    if (!sid) return;
    appendEvent(sid, { ...e, ts: e.ts || Date.now() });
  });

  socket.on('disconnect', () => {
    // TODO: cleanup if needed
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Orchestrator listening on http://localhost:${PORT}`);
});

function ensureSessionDir(sessionId) {
  const dir = path.join(storageDir, 'sessions', sessionId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function appendEvent(sessionId, obj) {
  const dir = ensureSessionDir(sessionId);
  const line = JSON.stringify(obj) + '\n';
  fs.appendFileSync(path.join(dir, 'events.log'), line);
}

app.post('/session/start', (req, res) => {
  const sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const roomId = req.body?.roomId || 'default';
  ensureSessionDir(sessionId);
  sessions.set(roomId, { sessionId, startedAt: Date.now() });
  res.json({ sessionId });
});

app.post('/session/stop', (req, res) => {
  const roomId = req.body?.roomId || 'default';
  const sid = sessions.get(roomId)?.sessionId;
  if (!sid) return res.status(400).json({ ok: false });
  const dir = ensureSessionDir(sid);
  const logPath = path.join(dir, 'events.log');
  let events = [];
  if (fs.existsSync(logPath)) {
    const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
    events = lines.map((l) => JSON.parse(l));
  }
  fs.writeFileSync(path.join(dir, 'events.json'), JSON.stringify({ events }, null, 2));
  const manifest = { sessionId: sid, files: fs.readdirSync(dir).filter(Boolean) };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  sessions.delete(roomId);
  res.json({ ok: true, sessionId: sid });
});

app.post('/upload', upload.single('file'), (req, res) => {
  const sid = req.body?.sessionId;
  const name = req.body?.name || req.file?.originalname || req.file?.filename;
  if (!sid || !name || !req.file) return res.status(400).json({ ok: false });
  const dir = ensureSessionDir(sid);
  const target = path.join(dir, name);
  fs.renameSync(req.file.path, target);
  res.json({ ok: true, file: target });
});

app.post('/render', async (req, res) => {
  const sid = req.body?.sessionId;
  if (!sid) return res.status(400).json({ ok: false });
  try {
    const { renderSession } = require('./renderer/render');
    const result = await renderSession(storageDir, sid);
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

app.post('/live/start', (req, res) => {
  const url = process.env.LIVEKIT_URL || '';
  const apiKey = process.env.LIVEKIT_API_KEY || '';
  const apiSecret = process.env.LIVEKIT_API_SECRET || '';
  const roomService = new RoomServiceClient(url, apiKey, apiSecret);
  const roomName = req.body?.roomId || 'default';
  const rtmp = req.body?.rtmp || { url: process.env.RTMP_PRIMARY_URL, streamKey: process.env.RTMP_STREAM_KEY };
  roomService.startRTMPEgress(roomName, { urls: [`${rtmp?.url}/${rtmp?.streamKey}`] }).then(() => res.json({ ok: true })).catch(() => res.status(500).json({ ok: false }));
});

app.post('/live/stop', (req, res) => {
  const url = process.env.LIVEKIT_URL || '';
  const apiKey = process.env.LIVEKIT_API_KEY || '';
  const apiSecret = process.env.LIVEKIT_API_SECRET || '';
  const roomService = new RoomServiceClient(url, apiKey, apiSecret);
  const egressId = req.body?.egressId || '';
  if (!egressId) return res.status(400).json({ ok: false });
  roomService.stopEgress(egressId).then(() => res.json({ ok: true })).catch(() => res.status(500).json({ ok: false }));
});
