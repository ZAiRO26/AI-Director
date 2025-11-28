function buildHighlights(events, opts = {}) {
  const minSeg = opts.minSegment || 8_000;
  const maxTotal = opts.maxTotal || 600_000;
  const cuts = [];
  let total = 0;
  const speech = events.filter((e) => e.type === 'speaking_start');
  for (let i = 0; i < speech.length; i++) {
    const start = speech[i].ts - 1000;
    const stopEv = events.find((e) => e.type === 'speaking_stop' && e.camId === speech[i].camId && e.ts > speech[i].ts);
    const end = (stopEv?.ts || start + minSeg) + 500;
    const dur = end - start;
    if (dur >= minSeg) {
      cuts.push({ startMs: start, endMs: end });
      total += dur;
      if (total >= maxTotal) break;
    }
  }
  return cuts;
}

module.exports = { buildHighlights };

