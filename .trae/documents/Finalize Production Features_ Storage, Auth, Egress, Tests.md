## Remaining Work Overview
We’ve delivered Phases 3–10 in the repo. To reach production completeness, we’ll finalize storage, authentication, LiveKit egress robustness, testing depth, and CI/CD hardening without increasing cloud costs beyond live/render windows.

## Storage Integration (S3/B2)
- Add storage client with server-side multipart upload and retries.
- Replace local `/upload` to stream to `sessions/{sessionId}/` bucket paths; store checksums.
- Add `GET /assets/:sessionId` to return signed URLs; configure lifecycle (ISOs 14 days, Program/Highlights 90 days).
- Migrate existing local files to storage on `session/stop`.

## Authentication & Security
- Implement JWT auth (user/workspace) in backend middleware; restrict session/asset operations by workspace.
- Add CSRF protection for state-changing requests; tighten CORS to known origins.
- Secrets via env/secret manager; remove any placeholder tokens.

## LiveKit Egress (Production-Ready)
- Confirm `RoomServiceClient` RTMP egress with env `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
- Add status polling and error handling; return `egressId` and persist `live_manifest.json`.
- Support per-destination configs (YouTube/Twitch/Custom RTMP) in `/live/start` payload.

## Observability & Cost Controls
- Metrics: session duration, egress runtime, storage sizes, render times, cost estimates.
- Alerts: render failures, egress errors, oversized sessions.
- Debounce/switch limits server-side to reduce cut churn; audit logs for moderation.

## CI/CD & Containers
- Split Dockerfiles per service (web/backend/renderer); add build matrix in CI.
- Add tests/jobs gates; push images to registry; deploy to staging/prod.

## Tests (Depth & Reliability)
- Unit tests: decision engine, cut-list edge cases (short bursts, overlapping segments).
- Integration tests: session start/stop, uploads to S3/B2, `/render` success.
- E2E smoke: start live egress to a test RTMP and confirm stream is reachable.

## UX Improvements (Console)
- Delivery tab listing assets with signed download links.
- Session history with status (recorded, rendered, live done).
- Error toasts and retry flows for uploads/renders.

## Acceptance Criteria
- All uploads use cloud storage with signed URLs; lifecycle active.
- Auth middleware enforces workspace isolation; secrets not committed.
- Live egress works with RTMP destinations; returns `egressId`; stop terminates cleanly.
- CI builds all services; tests pass; deploy scripts ready.
- Test suite covers session lifecycle, rendering, and egress basics.

## Request
If approved, I will implement these items immediately, verify end-to-end (including a real RTMP test), and update you once everything is completed.