const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { buildHighlights } = require('./cutlist');

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-y', ...args], { stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg failed'))));
  });
}

async function renderSession(storageDir, sessionId) {
  const dir = path.join(storageDir, 'sessions', sessionId);
  const eventsPath = path.join(dir, 'events.json');
  if (!fs.existsSync(eventsPath)) throw new Error('events.json missing');
  const events = JSON.parse(fs.readFileSync(eventsPath, 'utf-8')).events || [];

  const programWebm = path.join(dir, 'program.webm');
  const programMp4 = path.join(dir, 'program.mp4');
  await runFFmpeg(['-i', programWebm, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-c:a', 'aac', programMp4]);

  const cuts = buildHighlights(events);
  const listPath = path.join(dir, 'cuts.txt');
  const tmpSegments = [];
  for (let i = 0; i < cuts.length; i++) {
    const segOut = path.join(dir, `seg_${i}.mp4`);
    tmpSegments.push(segOut);
    await runFFmpeg(['-ss', (cuts[i].startMs / 1000).toFixed(3), '-to', (cuts[i].endMs / 1000).toFixed(3), '-i', programMp4, '-c', 'copy', segOut]);
  }
  fs.writeFileSync(listPath, tmpSegments.map((s) => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
  const out = path.join(dir, 'highlights.mp4');
  if (tmpSegments.length) await runFFmpeg(['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', out]);
  return { programMp4, highlights: out };
}

module.exports = { renderSession };

