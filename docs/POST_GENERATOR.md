# Branded photo & video post generator

Admin → Post generator creates NightLight-branded still images and queued 9:16 MP4 videos without requiring a gig.

## Workflow

1. Select an existing media-library image or upload a fresh JPEG/PNG/WebP.
2. Choose an output preset:
   - 1:1 — 1080×1080
   - 4:5 — 1080×1350
   - 9:16 — 1080×1920
3. Choose Gradient, Poster or Minimal.
4. Choose a brand preset and edit headline, subline, date/location and brand text.
5. Adjust zoom, horizontal/vertical crop, overlay, text alignment and text position.
6. Use safe-area guides while editing.
7. Render & save.
8. Export the persisted PNG from generated history.

Safe-area guides only exist in preview and are deliberately excluded from the saved image.

## Rendering

Rendering is deterministic in the browser using Canvas. Preview and export use the same renderer. The final PNG is uploaded back to NightLight, where the server independently validates its file signature and exact dimensions before accepting it.

The server never trusts the client-provided preset dimensions.

## Storage

Generated PNG bytes live under `NUXT_STORAGE_GENERATED`, which maps to the persistent Unraid `${APP_DATA_ROOT}/generated` volume. Design metadata is stored in PostgreSQL in `generated_posts`.

Each output gets a stable `/api/generated-posts/<id>` URL and remains reusable after container rebuilds. Source images can be removed later without destroying already-rendered outputs.

## V1 boundaries

V1 is intentionally still-image only. It does not include video, Remotion, automatic Instagram publishing or AI copy generation.


## Remotion video generator

Admin → Post generator → Video generator creates a fixed 1080×1920, 30 fps, 10-second Reel/Story.

1. Select an existing image from the media library.
2. Pick Spotlight, Pulse or Slide.
3. Pick Smooth, Energy or Minimal motion.
4. Pick a NightLight, Mono or Warm brand preset and enter the copy.
5. Optionally upload MP3, M4A, WAV or OGG audio (max 12 MB).
6. Queue the render and follow its progress.
7. Open the persisted MP4 from render history.

The web application does not render MP4 frames itself. It inserts a row in `video_render_jobs`. The separate `render-worker` Compose service claims jobs with PostgreSQL `FOR UPDATE SKIP LOCKED`, renders them with Remotion, updates progress, and writes the MP4 into the persistent generated-storage volume.

Interrupted renders that have not updated for 30 minutes are returned to the queue when the worker starts. Failed jobs can be retried from the UI.

### Deployment

Both `docker-compose.yml` and `docker-compose.unraid.yml` include `render-worker`. The worker mounts uploads read-only and generated output read/write. It uses Chromium and FFmpeg from `Dockerfile.render-worker`.

The Remotion packages are deliberately pinned to exactly the same version. Review Remotion's current licensing terms before production use or if the team/automation usage changes.

Automatic Instagram publishing and AI copy generation remain out of scope.
