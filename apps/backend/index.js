const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { chooseActiveCamera } = require('../../packages/decision-engine');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
const storageDir = path.join(__dirname, 'storage');
if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
const upload = multer({ dest: storageDir });

app.get('/health', (_req, res) => res.json({ ok: true }));
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
    }
  });

  socket.on('disconnect', () => {
    // TODO: cleanup if needed
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Orchestrator listening on http://localhost:${PORT}`);
});
