## Overview
We will complete Phases 3–5 to deliver ISO recording, post‑processing render pipelines, and low‑latency cloud transport with RTMP egress — keeping analysis at the edge and cloud costs < $1.56/hr except during live/transcode windows.

## Current Repo Layout (Baseline)
- apps/web: Next.js console with Local VAD, MultiCam UI, ProgramMixer, recording + upload
- apps/backend: Express + Socket.io, decision engine, upload storage
- packages/decision-engine: Switch logic with hysteresis

## Phase 3: ISO Recording & Metadata Logging
- Client (web)
  - Add ISORecorders per camera using `MediaRecorder` (webm/vp9) parallel to ProgramMixer.
  - Introduce session controls: Start/Stop buttons that request `sessionId` from backend and tag all uploads.
  - Emit structured events over Socket.io for:
    - `speaking_start/stop`, `switch`, `manual_cut`, `record_start/stop` with timestamps.
  - Upload files to backend upon Stop:
    - `sessions/{sessionId}/program.webm`, `cam_1_iso.webm`, `cam_2_iso.webm`, `events.json`.
- Backend (node)
  - Endpoints:
    - `POST /session/start` → returns `{ sessionId }` (UUID).
    - `POST /session/stop` → finalizes session manifest.
    - `POST /upload` → store file under `storage/sessions/{sessionId}/` with name validation.
    - Socket event `event` → append JSONL to `events.log` and aggregate to `events.json` on stop.
  - Session manifest: `manifest.json` with device labels and durations.
- Verification
  - Start session, record program + ISOs, speak to trigger events, stop session.
  - Confirm files and events saved under `storage/sessions/{sessionId}/`.

## Phase 4: Post‑Processing Renderer (Batch/Spot)
- Renderer Service (containerized Node + FFmpeg)
  - Inputs: `program.webm`, ISO files, `events.json`, `manifest.json` from session storage.
  - Outputs:
    - Master Program `program.mp4` (H.264/AAC, 1080p),
    - Highlight Reel `highlights.mp4` (1–10 min total),
    - Optional per‑cam MP4 transcodes.
  - Highlight algorithm (cost‑light):
    - Compute VAD windows, prefer segments with high/consistent speech and minimal cut churn.
    - Enforce min/max segment durations, add 0.5–1.0s pre/post roll.
    - Rank segments by density; cap total duration.
  - FFmpeg pipelines:
    - `ffmpeg -i program.webm -c:v libx264 -preset veryfast -crf 22 -c:a aac program.mp4` (tuneable).
    - Highlights: `-ss/-to` concatenation list generated from events.
- Orchestration
  - Job runner triggers on `session/stop`.
  - Run on spot/preemptible instances or Cloud Run Jobs; auto‑terminate after render.
- Verification
  - Unit tests for cut‑list generation from `events.json`.
  - Render small samples locally; validate duration and transitions.

## Phase 5: Cloud Transport (SFU) & Live RTMP
- SFU Integration (LiveKit recommended)
  - Deploy LiveKit (managed or self‑hosted) to handle multi‑participant WebRTC.
  - Client joins LiveKit room; edge AI still runs locally; send metadata via Socket.io or LiveKit Data.
- Program Feed Strategy
  - For live: use LiveKit Egress to stream the selected program track (or composite) to RTMP destinations (YouTube/Twitch).
  - For MVP cost control: program track = active camera; avoid server‑side compositing unless necessary.
- Backend Coordination
  - Maintain room state and program selection via decision engine; publish program changes to LiveKit.
  - Live endpoints:
    - `POST /live/start` → start egress (RTMP url/key, sessionId).
    - `POST /live/stop` → stop egress and persist live manifest.
- Observability & Reliability
  - Health checks for SFU, egress status polling, auto‑retry on transient failures.
  - Rate‑limit metadata events; debounce switching to prevent cut spam.
- Verification
  - End‑to‑end: join room with two cams; trigger VAD; observe RTMP stream live.
  - Measure latency (<200ms SFU, RTMP ~5–10s).

## Cost Controls
- Edge‑first analysis; no server inference.
- Only transcode during live or post‑processing.
- Spot/preemptible render jobs; storage lifecycle rules for ISO/program.

## Deliverables
- Phase 3: ISO recording UI, session management, events logging, uploads.
- Phase 4: Renderer container, cut‑list generation, MP4 outputs, job trigger.
- Phase 5: LiveKit SFU integration, egress RTMP controls, live UX.

## Rollout & Commits
- Feature branches per phase with PRs to `main`.
- Environment configs stubbed (LiveKit URL/key via `.env` not committed).
- After each phase passes verification, merge to `main` and tag `v0.3`, `v0.4`, `v0.5`.

## Request for Confirmation
If approved, I will proceed immediately to implement Phases 3–5 as specified and notify you when Phase 5 is complete (live RTMP working end‑to‑end).