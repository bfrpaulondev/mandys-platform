# Restaurant media uploads

Mandy's uses Cloudinary for restaurant-owned images, but browser clients never receive the Cloudinary API secret.

## Upload flow

1. An authenticated owner or manager asks the same-origin Backoffice gateway for `/api/media/v1/signature` with a media kind (`logo`, `cover` or `menu-item`).
2. The `mandys-media` Edge Function derives the organization from the Better Auth session and membership, never from request data.
3. The server generates a short-lived signed Cloudinary upload request scoped to a hashed tenant folder.
4. The browser uploads the image directly to Cloudinary using the returned API key, timestamp, folder, signed upload preset and signature.
5. The resulting HTTPS delivery URL can then be saved through the existing tenant-scoped profile/menu APIs.

## Required server configuration

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_UPLOAD_PRESET`

The upload preset must be **signed** and should enforce the production image policy, including allowed image formats and a maximum file size. The application currently advertises JPEG, PNG, WebP and AVIF with a 10 MB client-side limit; the preset is the authoritative server-side enforcement.

If any required value is absent, the signing endpoint returns `503 MEDIA_NOT_CONFIGURED`. This is intentional: Mandy's does not fall back to a public unsigned upload path.

## Tenant isolation

The Cloudinary folder contains a SHA-256-derived tenant identifier rather than the raw Better Auth organization id. The server signs the folder, timestamp and preset together, so a client cannot switch the destination tenant folder without invalidating the signature.

Signature creation is recorded in the Mandy's audit log. No API secret, database credential or raw authentication token is returned to the browser.
