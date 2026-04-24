# Harper Vision Cleanup

Daily retention janitor for the Harper Vision capture tables. Runs the SQL
functions defined in `backend-hono/migrations/030_harper_vision.sql`:

- `cleanup_harper_vision_frames()` — deletes frames older than 24 hours
- `cleanup_harper_vision_transcripts()` — deletes transcripts older than 7 days

## Schedule

- **Cadence**: daily at 03:00 ET (07:00 UTC during EDT, 08:00 UTC during EST)
- **Endpoint**: `POST https://fintheon.fly.dev/api/harper-ops/harper-vision-cleanup`
- **Auth header**: `x-routine-secret: ${ROUTINE_SECRET}`
- **Body**: none required
- **Expected response**: `200 { "ok": true, "ranAt": "...", "functions": [...] }`
- **Missing/invalid secret**: `401 { "error": "unauthorized" }` (verified in the
  acceptance criteria)

## Routine registration

Register this as a Routine (Harper-Ops scheduled agent) with:

```json
{
  "triggerId": "harper-vision-cleanup",
  "cadence": "0 7 * * *",
  "endpoint": "/api/harper-ops/harper-vision-cleanup",
  "method": "POST",
  "headers": { "x-routine-secret": "$ROUTINE_SECRET" }
}
```

## Rationale

Screen frames (and their Supabase Storage uploads) accumulate quickly — a
default 5 s capture interval produces up to 17 280 frames per day per user.
Without this sweep the `harper_vision_frames` table and the `harper-vision`
storage bucket will grow unbounded. Transcripts are smaller (text only) so
they get a longer 7-day window, sufficient for session replay.

## Failure handling

The route returns HTTP 500 with `{ ok: false, errors: [...] }` if either
`rpc()` call surfaces an error from Postgres. The Routines console will
record the run as `failed` and surface it in the ops feed; re-running the
endpoint is safe (the cleanup functions use simple `DELETE ... WHERE
timestamp < now() - interval ...` and are idempotent).

## Related

- Route: `backend-hono/src/routes/harper-ops/harper-vision-cleanup.ts`
- SQL functions: `backend-hono/migrations/030_harper_vision.sql`
- Storage bucket: `harper-vision` (created in `034_harper_vision_storage.sql`;
  objects are orphaned after row deletion and will need a follow-up bucket
  sweep once TP decides how strictly to enforce image retention)
