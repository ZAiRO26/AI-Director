function chooseActiveCamera(state) {
  const { scores, lastActive, lastSwitchAt, now, minCutIntervalMs = 1500, minConfidence = 0.6 } = state;
  let bestCam = lastActive;
  let bestScore = -Infinity;
  for (const [camId, s] of Object.entries(scores)) {
    // s: { vad: 0..1, motion: 0..1 }
    const combined = (s.vad ?? 0) * 0.8 + (s.motion ?? 0) * 0.2;
    if (combined > bestScore) {
      bestScore = combined;
      bestCam = camId;
    }
  }
  // Hysteresis: do not cut too often, and require confidence
  const canCut = now - (lastSwitchAt || 0) >= minCutIntervalMs;
  if (!canCut) {
    return { active: lastActive, lastSwitchAt };
  }
  if (bestCam !== lastActive && bestScore >= minConfidence) {
    return { active: bestCam, lastSwitchAt: now };
  }
  return { active: lastActive, lastSwitchAt };
}

module.exports = { chooseActiveCamera };

