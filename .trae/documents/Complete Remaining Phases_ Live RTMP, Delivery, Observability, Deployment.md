## Overview
Finalize the AI Director SaaS with production-grade live transport (RTMP egress via LiveKit), ISO/program asset delivery, observability, security, and deployment. Maintain edge-first inference to keep costs within the $1.56/hr constraint, with cloud compute only during live or render windows.

## Current Status
- Phases 1–5 implemented locally: edge VAD, session recording, uploads, renderer + highlights, LiveKit client stubs, live start/stop backend endpoints.

## Phase 5 Completion (Production Live Egress)
- Backend LiveKit egress integration:
  - Implement `/live/start` to call LiveKit Server Egress API with `roomId`, `RTMPOutput` (rtmp url + key) and attach to program track.
  - Implement `/live/stop` to terminate egress and write `live_manifest.json` (start/end, destination). 
  - Env: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `RTMP_PRIMARY_URL`, `RTMP_STREAM_KEY` (use per-session payload).
- Web: provide `NEXT_PUBLIC_LIVEKIT_URL` and obtain token from backend `GET /live/token?roomId=...` (backend signs JWT). Replace current token placeholder.
- Verification: join LiveKit room with two cams, trigger VAD/manual cuts, confirm RTMP delivery to destination (YouTube/Twitch) with acceptable latency.

## Phase 6: Asset Delivery & Storage
- Storage abstraction: S3/Backblaze B2 `sessions/{sessionId}/` with lifecycle (ISO 7–14 days; program/highlights 30–90 days).
- Backend endpoints:
  - `POST /upload` streams directly to storage (multipart) with server-side checksum.
  - `GET /assets/:sessionId` returns manifest with signed URLs (expiring links).
  - `POST /session/finalize` moves local files to storage and updates manifest.
- Web Console: Delivery tab listing Program MP4, Highlights MP4, ISO files with download buttons.
- Verification: Upload, list, and download via signed URLs; confirm lifecycle policy.

## Phase 7: Observability & Unit Economics
- Metrics & logs:
  - Track session durations, file sizes, render times, egress runtime, and per-session cost estimates.
  - Emit metrics to Prometheus/Grafana or CloudWatch; alert when crossing cost thresholds.
- Rate limits & stability:
  - Debounce switch events server-side; max 1 cut per 1.5s; cap program changes per minute.
  - Backpressure for uploads; chunked uploads with retries and integrity checks.
- Verification: dashboards show live metrics; alerts tested with synthetic sessions.

## Phase 8: Security & Auth
- JWT auth for web and backend; workspace isolation.
- Secrets: `.env` for local only; production via secret manager (AWS Secrets Manager/GCP Secret Manager).
- CORS hardening and CSRF protection where applicable; input validation for uploads.
- Verification: auth flows working; access restricted to user’s sessions.

## Phase 9: Packaging & Deployment
- Containerize web/backend/renderer; add Dockerfiles and a compose for local.
- CI/CD (GitHub Actions): lint/test/build; push images to registry; deploy to staging/prod.
- Infra targets:
  - LiveKit: managed or self-hosted on a small VM with autoscaling.
  - Backend: Cloud Run or ECS Fargate (scale to zero when idle).
  - Renderer: Cloud Run Jobs/AWS Batch with spot; auto-delete after job.
- Verification: staging deploy passes smoke tests; production deploy green.

## Phase 10: QA & Documentation
- Automated tests:
  - Unit tests for decision engine, cut-list, egress start/stop.
  - Integration tests for session lifecycle and uploads.
- User docs (in-app help): recording workflow, delivery, going live.
- Verification: test suite passing; UX walkthrough validated.

## Environment & Config
- Web: `NEXT_PUBLIC_LIVEKIT_URL`, token via backend.
- Backend: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, storage credentials, RTMP destination.
- Renderer: FFmpeg availability; optional GPU flags for future upgrades.

## Cost Controls & Risks
- Strict edge-only analysis; serverless scaling for backend; spot instances for renderer.
- Storage lifecycle reduces long-term costs.
- Risk: RTMP egress complexity; mitigate by using LiveKit Egress SDK and robust retries.

## Deliverables
- Production live RTMP egress end-to-end
- Storage-backed delivery with signed URLs
- Observability dashboards and alerts
- Auth and secrets hardening
- CI/CD pipelines and containerized services

## Confirmation
On approval, I will implement Phases 5–10 as specified, verify end-to-end (including a real RTMP destination), and update you once everything is completed.