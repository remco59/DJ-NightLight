# Media library storage

The media library stores metadata in PostgreSQL and file bytes on persistent storage outside the Nuxt container.

## Unraid layout

The existing Unraid compose file mounts:

- `${APP_DATA_ROOT}/uploads:/app/storage/uploads`
- `${APP_DATA_ROOT}/generated:/app/storage/generated`

The application reads `NUXT_STORAGE_UPLOADS=/app/storage/uploads`. Rebuilding or replacing the web container therefore does not remove uploaded images.

## Portable ownership initialization

Both Docker Compose configurations include a one-shot `storage-init` service. Before the web app or render worker starts, it creates the writable uploads/generated directories and applies the same numeric UID/GID used inside both NightLight images.

The defaults are:

- `NIGHTLIGHT_UID=10001`
- `NIGHTLIGHT_GID=10001`

These values are build arguments for the web and render-worker images and are also passed to `storage-init`. This keeps container identity and host/named-volume ownership in sync.

On a normal fresh install, no manual `chown` is required. Existing installations are repaired on the next Compose start because `storage-init` reapplies ownership before the application services start.

If a host requires a specific numeric identity, set `NIGHTLIGHT_UID` and `NIGHTLIGHT_GID` in `.env` before building. The values must be numeric and should remain stable for that installation.

## File safety

Images are limited to 15 MB, audio to 50 MB and video to 250 MB. NightLight does not trust the browser MIME type or extension: it inspects file signatures before storing media. Images accept JPEG, PNG and WebP and oversized pixel dimensions are rejected. Video/audio accept the supported containers defined in `shared/media.ts`. Generated thumbnails are capped separately.

Uploads above 64 MB automatically use resumable 8 MB chunks. Chunk sessions live temporarily under `.chunk-uploads` inside the uploads volume, expire after 24 hours, and are removed after successful finalization. This keeps every HTTP request comfortably below common reverse-proxy/CDN body-size limits while preserving the 250 MB product limit for video.

Files receive random storage keys and are written atomically. User-supplied filenames are metadata only and never become filesystem paths.

## Thumbnails

Admin → Media creates a max-480px JPEG thumbnail in the browser and uploads it alongside the original. Both are persisted separately. The original remains untouched.

## Metadata and associations

Assets store title, alt text, tags, the original filename, optional gig/venue associations and a `source` (`upload`, `url`, `generated` or `derived`). Public assets are served through stable UUID URLs such as `/api/media/<asset-id>`; add `?download=1` to download the original under its filename.

## Collections

Collections (`media_collections` / `media_collection_items`) group references to existing assets for a purpose (Promo, Website, Recaps, …). They never copy files, and one asset can be in several collections. Deleting a collection keeps its assets.

## Originals and variants

`parent_asset_id` links a derived asset (crop, enhanced edit, social export) to its original, with a short `variant_label`. The API rejects cycles. Every Post generator render is also filed in the library as a `generated` variant of its source photo, inheriting its gig, venue and tags.

## Usage

The library computes where each asset is referenced: website content, landing pages, video projects, video renders and the Post generator. The inspector lists these, and the "Used / unused" filter relies on them.

## Deletion

Deletion is blocked while an asset appears in website content, a landing page, a video project or a video render. A generated post only remembers its source, so it does not block deletion. Gig and venue associations are metadata and do not block deletion either. Bulk delete removes what it can and reports the assets that are still in use.

Remove the reference first, then delete the asset.

## Bulk download

`/api/admin/media/download?ids=…` streams up to 200 originals (1 GB total) as an uncompressed ZIP.

## Future S3 migration

Filesystem access is isolated behind the `MediaStorage` interface in `server/utils/media-storage.ts`. A future S3-compatible backend only needs to implement `put`, `read` and `delete`; database asset IDs and public URLs can remain stable.
