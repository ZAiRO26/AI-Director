## Scope
Complete the remaining production features without increasing recurring cloud costs beyond live or render windows: storage integration, authentication, robust LiveKit egress, observability, CI/CD, UX, and tests.

## Storage Integration (S3/B2)
1. Add storage client (S3/B2) with multipart upload, retries, and checksums.
2. Replace local `/upload` to stream directly to `sessions/{sessionId}/` in storage.
3. Implement `GET /assets/:sessionId` returning signed URLs with lifecycle policies (ISOs: 14 days, Program/Highlights: 90 days).
4. On `session/stop`, migrate any local files to storage and update `manifest.json`.

## Authentication & Security
1. Implement JWT auth and workspace isolation in backend middleware.
2. Harden CORS to known origins; add CSRF protection on mutating endpoints.
3. Centralize secrets via env (local) and secret manager (prod); remove placeholders.

## LiveKit Egress (Production)
1. Implement `/live/start` to initiate RTMP egress via `RoomServiceClient` using env creds.
2. Persist `egressId`, poll status, handle errors; write `live_manifest.json`.
3. Support per-destination RTMP in payload (YouTube, Twitch, Custom).

## Observability & Cost Controls
1. Metrics: session durations, egress runtime, render times, storage sizes, cost estimates.
2. Alerts for render failures, egress errors, oversized sessions; log moderation.
3. Enforce server-side debounce and max cuts per minute.

## CI/CD & Containers
1. Dockerfiles per service (web/backend/renderer), compose for local.
2. CI build matrix for all services; tests gating; push images to registry.
3. Deploy to staging/prod (Cloud Run/ECS + LiveKit managed/self-hosted) with autoscaling.

## Tests (Depth)
1. Unit tests: decision engine and cut-list edge cases.
2. Integration tests: session lifecycle, cloud uploads (mocked), `/render` success.
3. E2E smoke: live egress to test RTMP, verify reachability and acceptable latency.

## UX Enhancements
1. Delivery tab: list signed URLs, statuses (recorded, rendered, live completed).
2. Error toasts and retry flows for uploads and rendering.
3. Session history with durations and asset sizes.

## Acceptance Criteria
- All uploads use cloud storage and return signed URLs; lifecycle enforced.
- Auth and workspace isolation active; secrets not committed.
- Live egress works with RTMP destinations; returns `egressId`; stop terminates cleanly and is persisted.
- CI builds, tests pass, images published; staging and prod deployments ready.
- Test suite covers session lifecycle, rendering, and egress.

## Cost Discipline
- Edge-only analysis remains; serverless scaling; spot jobs for rendering.
- Storage lifecycle reduces long-term costs; strict egress windowing.

## Deliverables
- Storage adapter + signed URLs
- Auth middleware + CORS/CSRF
- Robust `/live/start` and `/live/stop` with status tracking
- Metrics endpoints and alerts
- CI/CD and containerization finalized
- Tests and UX enhancements

## Next Step
On approval, I will implement all items above, verify end-to-end (including a real RTMP test destination), and notify you immediately upon completion.