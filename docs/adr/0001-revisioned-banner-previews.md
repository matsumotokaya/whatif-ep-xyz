# ADR 0001: Revisioned Banner Previews

- Status: Accepted — Phase 0/1 implemented and verified
- Date: 2026-07-20
- Verified: 2026-07-21

## Context

Banner elements and canvas color are canonical document data. Thumbnail and
full-resolution JPEG files are derived assets rendered in the browser and
stored in R2. Previously, the database did not record which document snapshot
a preview represented. A delayed browser upload could therefore replace a
newer preview, and list screens could only infer `pending` or `ready` from the
presence of an asset key.

R2 uploads and a Postgres update cannot be one physical transaction. Browser
shutdown can also interrupt compensating cleanup.

## Decision

- `banners.document_revision` increases atomically for every canonical document
  save.
- A document save retains the last successful preview but marks it `pending`.
- Preview assets use immutable keys containing the document revision.
- `finalize_banner_preview` updates asset keys only when the requested revision
  still equals `banners.document_revision`.
- `preview_revision`, status, error, and timestamps are persisted and read by
  list screens. UI shows the previous image with an explicit updating/failed
  badge instead of treating both states as “no thumbnail”.
- Structured client events use a correlated `saveId`, revision, stage timings,
  and payload sizes. Base64 image data and user identifiers are never logged.
- A narrowly scoped legacy fallback remains while the migration and PostgREST
  schema cache roll out. Writes activate it only for a missing-function error;
  list reads retry their old projection only for missing preview columns.

The RPCs are a browser save path for user-owned documents, not a server
administration API. They run as `security invoker`, require the `authenticated`
role, and constrain writes to `user_id = auth.uid()`. `anon` and `service_role`
do not receive execute permission. A future server worker may use a service-role
credential only inside that server boundary and should have its own job-oriented
interface.

## Consequences

Out-of-order preview completion cannot overwrite a newer document. Document
saves remain durable when preview upload fails, and operators can distinguish
pending from failed work. Preview execution still depends on an open browser;
moving the renderer to a durable worker remains a later phase.

The legacy fallback must be removed after the revision RPCs are verified in all
environments so every save receives the revision guarantee.

## Rollout Status

The phase numbers below belong to the **banner preview reliability project**.
They are unrelated to the product phases in `PRODUCT_ROADMAP.md` and the
wallpaper pipeline phases in `WALLPAPER_PIPELINE_PLAN.md`.

### Phase 0 — Observability and failure visibility: complete

- Correlated `[banner-save]` events record `saveId`, revision, stage timings,
  element count, and encoded payload sizes without user IDs or base64 content.
- R2 uploads have a finite timeout and partial upload failures are surfaced.
- Query invalidation refreshes banner and Content Factory lists after every
  mutation outcome.
- List cards retain the last usable image and distinguish requested `pending`
  work from `failed` work. Legacy rows that never requested a preview do not
  display a permanent “updating” state.

### Phase 1 — Revision-safe browser previews: complete

- Migration: `supabase/migrations/20260720_revision_banner_previews.sql`
- BANALIST migration history: `20260720151259 revision_banner_previews`
- The migration creates the seven preview/revision columns, three RPCs, four
  check constraints, and the partial pending index.
- Existing template-thumbnail fallbacks are backfilled as `ready / template`;
  they are not active preview jobs and are not deleted as user data.
- Thumbnail and full-resolution uploads run in parallel with immutable,
  revision-bearing keys.
- A stale finalize returns no row, cannot replace the current preview, and its
  uploaded assets are removed.
- Content Factory validation for EPISODE 0449 confirmed Portrait, Landscape,
  and Feed saves on the revision path with `preview_revision =
  document_revision`, `ready / generated`, and no failed or out-of-sync rows.
- TypeScript, 11 test files / 133 tests, production build, changed-file ESLint,
  and `git diff --check` passed after the migration was applied.
- Supabase security and performance advisors reported no finding specific to
  the new RPCs, columns, or pending index.

### Phase 1 rollout cleanup — separate follow-up

Keep the narrowly scoped missing-RPC / missing-column fallback during the first
production rollout. Remove it in a separate change only after the committed app
has been deployed and normal production saves have been observed on the
revision path. Do not broaden the fallback to cover permission, validation, or
runtime errors.

### Phase 2 — Durable preview jobs: not started

Move preview execution out of the interactive save request:

- Commit the canonical document and enqueue a persistent job keyed by banner
  ID and document revision.
- Add leases, bounded retries, attempt/error metadata, stale-job cancellation,
  and dead-letter or operator retry handling.
- Make the worker idempotent so duplicate delivery cannot publish an old
  preview or leak duplicate assets.
- Add monitoring for queue age, stuck `pending` work, failure rate, render and
  upload duration, and cleanup failures.

Phase 2 removes the remaining dependency on the browser staying open, but it
may initially reuse the current renderer.

### Phase 3 — Deterministic server/worker rendering: not started

- Move Canvas rendering from the browser to a server or worker with pinned
  renderer and font versions.
- Fetch and validate source assets inside the worker and record enough render
  metadata to reproduce an output.
- Generate Production outputs directly from the canonical design document;
  do not upscale the editor's full-resolution JPEG.
- Add scheduled R2 orphan collection, retention rules, and operational alerts.

Phase 3 makes preview and Production output generation independent of client
hardware, browser lifecycle, and timing.
