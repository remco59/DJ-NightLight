# Branded photo & video post generator

Admin → Post generator creates NightLight-branded still images and queued 9:16 MP4 videos without requiring a gig.

## Workflow

1. **Media** — upload a JPEG/PNG/WebP or pick a photo from the library ("See all" opens the shared media picker). Position the photo by dragging it on the canvas, dragging a corner handle to scale, the arrow keys, or the precise Scale / Position X / Position Y controls; all stay in sync.
2. **Template** — pick Gradient, Poster, Minimal, Gig announcement, Recap or Upcoming gigs. Cards preview the current photo and copy; "See all" opens the template browser with category filters. Templates own the composition (campaign templates switch to 9:16 and centre their text); copy you wrote is kept, while empty fields and untouched sample copy take the new template's sample copy.
3. **Text** — the fields the template renders, each with a show/hide switch, plus the gig list for Upcoming gigs and text alignment/position for the flexible templates. Clicking text on the canvas opens this tool.
4. **Design** — brand style (NightLight, Mono, Warm) and the logo label.
5. **Effects** — overlay strength.
6. **Export post** renders and saves the PNG. **Recent exports** lists earlier exports to download, delete or load back into the editor ("Edit again").

The output format (1:1 — 1080×1080, 4:5 — 1080×1350, 9:16 — 1080×1920), safe-area guides and zoom/fit live with the canvas. Zoom only changes the preview. Undo/redo (Ctrl/⌘ Z, Ctrl/⌘ Shift Z) covers design and photo changes; a canvas drag is one step. Shift 1 or Ctrl/⌘ 0 fits the post to the screen, Ctrl/⌘ +/− zoom.

On desktop the editor fills the viewport: the inspector and the canvas stage scroll independently and the inspector can collapse to an icon rail. Below 720 px the phone editor (preview with a bottom sheet per tool) is used instead. Both layouts share one editor state (`app/composables/usePostEditor.ts`), so resizing across the breakpoint keeps every edit.

Safe-area guides only exist in preview and are deliberately excluded from the saved image; Preview shows the post exactly as it will be exported.

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
- **Template sounds**: templates play built-in sound effects (impact, punch, zap, whoosh, glitch) on their hit moments, such as a bolt strike or a letter slam. Whip, zoom and glitch entrances and exits add a whoosh or glitch. Cues are defined in `shared/template-sounds.ts` in template frames, the same fixed frame numbers the animations use, so they stay in sync at every fps. Each cue plays in its own sequence, so a sound rings out past the end of its graphic. New graphics have sound on; graphics saved before template sounds existed stay silent until it is switched on in the inspector. The Graphics track's mute button silences every template on it, and the timeline marks each hit with a tick that snaps like a clip edge, so a hit can be dragged onto a beat. The WAV files in `public/sfx/` are synthesised by `scripts/sfx/generate-sfx.ts` (CC0, no third-party samples); re-run it with `npx tsx scripts/sfx/generate-sfx.ts` after changing a voice or a length.
- **Inspector** follows the selection: transform, crop, opacity, speed, volume/mute for clips; volume and fades for audio; content, style and animation for graphics; output settings when nothing is selected.
- **Shortcuts**: Space play/pause, S split, Delete delete, Ctrl/⌘ D duplicate, Ctrl/⌘ Z undo (Shift to redo), arrows step a frame (Shift for a second).
- **Safe zones** for Reels/Stories are drawn over the 9:16 preview; templates keep text inside them.

### One composition for preview and export

`remotion/ProjectComposition.ts` renders a `VideoProject`. The editor mounts it through `@remotion/player`, and the render worker renders the same component (`NightLightProject`) with `@remotion/renderer`, so the preview is the export. The files the editor imports use `React.createElement` instead of JSX: Nuxt configures Vite for Vue JSX, so React JSX there would depend on build-tool settings that differ between Vite versions.

Timeline edits are pure functions in `shared/video-timeline.ts`, and project validation lives in `shared/video-project.ts`; both are unit tested.

### Rendering

Export saves the project, then queues a `video_render_jobs` row that stores a snapshot of the project, so later edits never change a queued or finished export. Jobs created by the old single-image generator still render through the legacy `NightLightVertical` composition.

The web application does not render MP4 frames itself. The separate `render-worker` Compose service claims jobs with PostgreSQL `FOR UPDATE SKIP LOCKED`, renders them with Remotion, updates progress, and writes the MP4 into the persistent generated-storage volume. Project media is served to the headless browser from a loopback-only HTTP server inside the worker, which streams files from the uploads volume with byte-range support instead of inlining them as data URIs.

Interrupted renders that have not updated for 30 minutes are returned to the queue when the worker starts. Failed and cancelled jobs can be retried from the UI.

Any job that has not produced a video (queued, rendering or failed, including legacy single-image videos) can be cancelled from the editor's Exports panel or the render history. The worker polls a rendering job's status every two seconds and aborts Remotion once it is no longer `rendering`, deleting the partial MP4; a job whose worker has died is simply marked `cancelled`. The worker never overwrites a cancelled job as completed or failed.

### Deployment

Both `docker-compose.yml` and `docker-compose.unraid.yml` include `render-worker`. The worker mounts uploads read-only and generated output read/write. It uses Chromium and FFmpeg from `Dockerfile.render-worker`, and has access to the host's Intel GPU when one exists (see below).

### Hardware-accelerated rendering (Intel GPU)

The render worker can encode exports on an Intel GPU with VAAPI. Choose the engine under **Settings → Video rendering**:

- **Automatic** (default) uses the Intel GPU when the worker detected a working one, otherwise the CPU.
- **CPU (software)** always works.
- **Intel GPU (VAAPI)** is only selectable when detected. If it later disappears, jobs fail with the reason instead of silently using the CPU.

Every job records the engine it used; the export lists show "Intel GPU" or "CPU".

How it works:

- Both Compose files bind-mount `/dev/dri` into `render-worker` and allow DRM devices (`device_cgroup_rules: c 226:* rmw`). A bind mount, unlike `devices:`, still starts on hosts without a GPU. On Docker Desktop (macOS/Windows), set `NIGHTLIGHT_DRI_PATH` to an empty folder because `/dev` cannot be shared there.
- The worker entrypoint starts as root, adds the group that owns `/dev/dri/renderD*`, then drops to the `nightlight` user. No GID configuration is needed.
- At startup and every minute the worker checks: render device present, accessible, system FFmpeg has `h264_vaapi`, Remotion VAAPI binaries present, and a short real test encode. The result is stored in `render_worker_status` and shown in Settings and on the System page.
- Remotion itself only supports NVENC/VideoToolbox. For Intel, the worker points Remotion's `binariesDirectory` at `/opt/nightlight-intel-ffmpeg` (Remotion's compositor with Debian's VAAPI-enabled `ffmpeg`/`ffprobe`) and rewrites the final encode to `h264_vaapi` with `format=nv12,hwupload`. VAAPI does not support CRF, so Intel exports use a fixed bitrate: `RENDER_VIDEO_BITRATE` (default `10M`).

The Unraid host needs the Intel GPU driver loaded (`/dev/dri` exists on the host). Troubleshooting:

```bash
docker exec <render-worker> ls -la /dev/dri
docker exec <render-worker> vainfo --display drm --device /dev/dri/renderD128
docker logs <render-worker> | grep "Render engine"
```

The Remotion packages are deliberately pinned to exactly the same version. Review Remotion's current licensing terms before production use or if the team/automation usage changes.

Automatic Instagram publishing and AI copy generation remain out of scope.
