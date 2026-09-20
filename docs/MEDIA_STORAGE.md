# Media library storage

The media library stores metadata in PostgreSQL and file bytes on persistent storage outside the Nuxt container.

## Unraid layout

The existing Unraid compose file mounts:

- `${APP_DATA_ROOT}/uploads:/app/storage/uploads`
- `${APP_DATA_ROOT}/generated:/app/storage/generated`

The application reads `NUXT_STORAGE_UPLOADS=/app/storage/uploads`. Rebuilding or replacing the web container therefore does not remove uploaded images.

## File safety

Uploads are limited to 15 MB. NightLight does not trust the browser MIME type or extension: it inspects the file signature and dimensions and accepts JPEG, PNG and WebP only. Oversized pixel dimensions are rejected. Generated thumbnails are capped separately.

Files receive random storage keys and are written atomically. User-supplied filenames are metadata only and never become filesystem paths.

## Thumbnails

Admin → Media creates a max-480px JPEG thumbnail in the browser and uploads it alongside the original. Both are persisted separately. The original remains untouched.

## Metadata and associations

Assets can store title, alt text, tags and optional gig/venue associations. The library supports search over those fields. Public assets are served through stable UUID URLs such as `/api/media/<asset-id>`.

## Deletion

Deletion is blocked when an asset:
- is associated with a gig or venue;
- appears in website content; or
- appears in a landing page.

Remove the reference first, then delete the asset.

## Future S3 migration

Filesystem access is isolated behind the `MediaStorage` interface in `server/utils/media-storage.ts`. A future S3-compatible backend only needs to implement `put`, `read` and `delete`; database asset IDs and public URLs can remain stable.
