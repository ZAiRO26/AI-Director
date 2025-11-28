from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from enum import Enum

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SwitchingMode(str, Enum):
    auto = "auto"
    manual = "manual"
    round_robin = "round_robin"
    active_speaker = "active_speaker"
    motion = "motion"
    gesture = "gesture"

class Destination(BaseModel):
    platform: str
    url: str

class Camera(BaseModel):
    id: str
    name: str
    rtmp_url: Optional[str] = None
    srt_url: Optional[str] = None

class AddCameraRequest(BaseModel):
    id: str
    name: str
    rtmp_url: Optional[str] = None
    srt_url: Optional[str] = None

class SetModeRequest(BaseModel):
    mode: SwitchingMode

class OverrideRequest(BaseModel):
    camera_id: str

class SessionStartRequest(BaseModel):
    destinations: List[Destination] = Field(default_factory=list)

class Event(BaseModel):
    ts: float
    type: str
    camera_id: Optional[str] = None
    meta: Optional[Dict[str, str]] = None

class Recording(BaseModel):
    id: str
    camera_id: str
    url: str

state: Dict[str, any] = {
    "cameras": {},
    "mode": SwitchingMode.manual,
    "program_camera_id": None,
    "destinations": [],
    "events": [],
    "recordings": [],
    "session_active": False,
}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/cameras", response_model=List[Camera])
def list_cameras():
    return list(state["cameras"].values())

@app.post("/cameras", response_model=Camera)
def add_camera(req: AddCameraRequest):
    if req.id in state["cameras"]:
        raise HTTPException(status_code=409, detail="camera exists")
    cam = Camera(id=req.id, name=req.name, rtmp_url=req.rtmp_url, srt_url=req.srt_url)
    state["cameras"][req.id] = cam
    return cam

@app.delete("/cameras/{camera_id}")
def remove_camera(camera_id: str):
    if camera_id not in state["cameras"]:
        raise HTTPException(status_code=404, detail="camera not found")
    del state["cameras"][camera_id]
    if state["program_camera_id"] == camera_id:
        state["program_camera_id"] = None
    return {"ok": True}

@app.post("/switching/mode")
def set_mode(req: SetModeRequest):
    state["mode"] = req.mode
    return {"mode": state["mode"]}

@app.get("/switching/mode")
def get_mode():
    return {"mode": state["mode"]}

@app.post("/switching/override")
def override_program(req: OverrideRequest):
    if req.camera_id not in state["cameras"]:
        raise HTTPException(status_code=404, detail="camera not found")
    state["program_camera_id"] = req.camera_id
    return {"program_camera_id": state["program_camera_id"]}

@app.get("/program-feed")
def program_feed_status():
    return {
        "program_camera_id": state["program_camera_id"],
        "mode": state["mode"],
        "destinations": state["destinations"],
        "session_active": state["session_active"],
    }

@app.post("/session/start")
def session_start(req: SessionStartRequest):
    state["destinations"] = req.destinations
    state["session_active"] = True
    return {"ok": True, "destinations": state["destinations"]}

@app.post("/session/stop")
def session_stop():
    state["session_active"] = False
    state["destinations"] = []
    return {"ok": True}

@app.get("/events", response_model=List[Event])
def get_events():
    return state["events"]

@app.get("/recordings", response_model=List[Recording])
def get_recordings():
    return state["recordings"]

