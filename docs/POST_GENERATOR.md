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


## Timeline video editor

Admin → Post generator → Video editor is a lightweight, template-first NLE for Reels, Stories and recaps.

- **Projects** (`video_projects`) persist a JSON `VideoProject`: output settings (9:16, 4:5, 1:1 or 16:9; 24/25/30/60 fps; background; fixed or timeline-driven duration) and ordered Video, Graphics and Audio tracks. Projects autosave with optimistic revision checks, and can be renamed, duplicated and deleted.
- **Media library** accepts images plus video (MP4, MOV, WebM, max 250 MB) and audio (MP3, M4A, WAV, OGG, max 50 MB). The browser probes duration, dimensions, a poster thumbnail and waveform peaks before upload; the server re-validates the container from its magic bytes. `/api/media/:id` streams video/audio with HTTP range support so players can seek. Existing image pickers keep receiving images only; the editor asks for `?kind=all`.
- **Timeline**: drag media or templates onto tracks, move and reorder clips, trim either edge (bounded by the source length), split at the playhead, duplicate, delete, snap to clip edges and the playhead, zoom, and scrub. Undo/redo covers every edit.
- **Motion templates** are timeline items, like Premiere MOGRTs: a locked animated layout with editable fields, an accent style, entrance/exit variants and timing. The library: Gig Announcement, Recap Intro, Upcoming Gigs, Logo Sting, Lower Third, Hype Title, Photo Drop and Clip Recap (3–5 clips). Definitions live in `shared/video-templates.ts`, React implementations in `remotion/motion-templates.ts`.
- **Inspector** follows the selection: transform, crop, opacity, speed, volume/mute for clips; volume and fades for audio; content, style and animation for graphics; output settings when nothing is selected.
- **Shortcuts**: Space play/pause, S split, Delete delete, Ctrl/⌘ D duplicate, Ctrl/⌘ Z undo (Shift to redo), arrows step a frame (Shift for a second).
- **Safe zones** for Reels/Stories are drawn over the 9:16 preview; templates keep text inside them.

### One composition for preview and export

`remotion/ProjectComposition.ts` renders a `VideoProject`. The editor mounts it through `@remotion/player`, and the render worker renders the same component (`NightLightProject`) with `@remotion/renderer`, so the preview is the export. The files the editor imports use `React.createElement` instead of JSX: Nuxt configures Vite for Vue JSX, so React JSX there would depend on build-tool settings that differ between Vite versions.

Timeline edits are pure functions in `shared/video-timeline.ts`, and project validation lives in `shared/video-project.ts`; both are unit tested.

### Rendering

Export saves the project, then queues a `video_render_jobs` row that stores a snapshot of the project, so later edits never change a queued or finished export. Jobs created by the old single-image generator still render through the legacy `NightLightVertical` composition.

The web application does not render MP4 frames itself. The separate `render-worker` Compose service claims jobs with PostgreSQL `FOR UPDATE SKIP LOCKED`, renders them with Remotion, updates progress, and writes the MP4 into the persistent generated-storage volume. Project media is served to the headless browser from a loopback-only HTTP server inside the worker, which streams files from the uploads volume with byte-range support instead of inlining them as data URIs.

Interrupted renders that have not updated for 30 minutes are returned to the queue when the worker starts. Failed jobs can be retried from the UI.

### Deployment

Both `docker-compose.yml` and `docker-compose.unraid.yml` include `render-worker`. The worker mounts uploads read-only and generated output read/write. It uses Chromium and FFmpeg from `Dockerfile.render-worker`.

The Remotion packages are deliberately pinned to exactly the same version. Review Remotion's current licensing terms before production use or if the team/automation usage changes.

Automatic Instagram publishing and AI copy generation remain out of scope.
