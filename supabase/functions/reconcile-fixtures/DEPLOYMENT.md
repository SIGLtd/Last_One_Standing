# reconcile-fixtures — secure deployment

## Authentication model

The function accepts **two** invocation routes only. A browser `manual` flag is never treated as authority.

### 1. Manual admin invocation

- Caller sends `Authorization: Bearer <user_access_token>` (standard Supabase session JWT).
- Function validates the JWT via `auth.getUser()`.
- Resolves `players` row and requires `is_admin = true`.
- Non-admin or missing JWT → `401` / `403`.

### 2. Scheduled invocation

- Caller sends header `x-los-scheduler-secret: <secret>`.
- Function compares to `LOS_SCHEDULER_SECRET` (Edge Function secret / Vault only).
- Comparison uses constant-time equality.
- Wrong or missing secret → `401 INVALID_SCHEDULER_SECRET`.
- Scheduled runs also require `API_FOOTBALL_KEY` and pass the Europe/London hour guard.

### Status endpoint (admin only)

`POST` body `{ "action": "status" }` with admin JWT returns:

```json
{ "providerConfigured": true, "schedulerConfigured": false }
```

No API keys are exposed to the client.

## Deploy command (when approved)

```bash
supabase secrets set LOS_SCHEDULER_SECRET="<generate-strong-secret>"
# Optional until recurring monitoring:
supabase secrets set API_FOOTBALL_KEY="<api-football-key>"

supabase functions deploy reconcile-fixtures --no-verify-jwt
```

`--no-verify-jwt` is safe because the function performs authentication internally.

## Cron activation (later)

See `supabase/scheduling/enable-fixture-cron.sql`. Cron SQL must read project URL and scheduler secret from **Supabase Vault**, not from committed files.

Do not enable cron until:

1. Migration `4_fixture_operations_core.sql` is applied.
2. Master fixtures are imported.
3. `API_FOOTBALL_KEY` is configured.
4. CEO approves recurring external monitoring.
