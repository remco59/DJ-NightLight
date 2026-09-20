# Branded photo post generator

Admin → Post generator creates NightLight-branded still images without requiring a gig.

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
