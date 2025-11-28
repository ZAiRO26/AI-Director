from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, List, Optional
import os, json, time

try:
    import redis
except Exception:
    redis = None

app = FastAPI()

class Weights(BaseModel):
    sound: float = 0.6
    motion: float = 0.1
    gaze: float = 0.1
    gesture: float = 0.0
    interval: float = 0.2

class SwitchCommand(BaseModel):
    type: str = "switch_to_camera"
    timestamp: int
    targetCamId: int
    transition: str = "cut"
    minDuration: int = 1500

state: Dict[str, Dict] = {}

def get_redis():
    url = os.getenv("REDIS_URL", "redis://127.0.0.1:6379")
    if redis is None:
        return None
    try:
        r = redis.Redis.from_url(url, decode_responses=True)
        r.ping()
        return r
    except Exception:
        return None

rds = get_redis()

@app.get("/health")
def health():
    return {"ok": True, "redis": bool(rds)}

@app.post("/preset/{session_id}")
def set_preset(session_id: str, w: Weights):
    if session_id not in state:
        state[session_id] = {"weights": w.model_dump(), "current": None, "last_switch": 0}
    else:
        state[session_id]["weights"] = w.model_dump()
    return {"ok": True}

def score(weights: Dict[str, float], ev: Dict) -> float:
    s = 0.0
    s += weights.get("motion", 0) * float(ev.get("motion_score", 0) or 0)
    s += weights.get("sound", 0) * float(ev.get("sound_score", 0) or 0)
    s += weights.get("gaze", 0) * float(ev.get("gaze", {}).get("score", 0) or 0)
    g = ev.get("gesture", {})
    s += weights.get("gesture", 0) * float(g.get("score", 0) or 0)
    s += weights.get("interval", 0) * 0.0
    return s

def process_events(session_id: str):
    weights = state.get(session_id, {}).get("weights", Weights().model_dump())
    if rds is None:
        return
    stream = f"events:{session_id}"
    last_id = state.get(session_id, {}).get("last_id", "0-0")
    res = rds.xread({stream: last_id}, count=50, block=10)
    if not res:
        return
    _, entries = res[0]
    best_cam = None
    best_score = -1.0
    for entry_id, fields in entries:
        state.setdefault(session_id, {})["last_id"] = entry_id
        data = json.loads(fields.get("data", "{}"))
        cam = data.get("camId")
        sc = score(weights, data)
        if sc > best_score:
            best_score = sc
            best_cam = cam
    if best_cam is None:
        return
    now = int(time.time() * 1000)
    cur = state.get(session_id, {}).get("current")
    last_switch = state.get(session_id, {}).get("last_switch", 0)
    if cur is not None and best_cam != cur:
        if now - last_switch < 1500:
            return
    state[session_id]["current"] = best_cam
    state[session_id]["last_switch"] = now
    cmd = SwitchCommand(timestamp=now, targetCamId=int(best_cam)).model_dump()
    rds.publish(f"control:{session_id}", json.dumps(cmd))

@app.post("/tick/{session_id}")
def tick(session_id: str):
    process_events(session_id)
    return {"ok": True}

