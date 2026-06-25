# reconcile-fixtures — secure deployment

## Authentication model

The function accepts **three** invocation routes only. A browser `manual` flag is never treated as authority.

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
- Scheduled runs also require `FOOTBALL_DATA_API_KEY` and pass the Europe/London hour guard.

### 3. Service-role maintenance (import scripts only)

- Caller sends `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.
- Permitted actions: `status`, `provider_check`, `map_provider_ids`.
- Never exposed to browsers or Netlify.

### Status endpoint (admin or service role)

`POST` body `{ "action": "status" }` returns:

```json
{ "providerConfigured": true, "provider": "football-data.org", "schedulerConfigured": false }
```

No API keys are exposed to the client.

## football-data.org provider

- Secret name: `FOOTBALL_DATA_API_KEY` (Supabase Edge Function secret only).
- Auth header: `X-Auth-Token`.
- Competition: `PL` (Premier League).
- Season filter: `?season=2026` for the 2026/27 LOS season.
- Primary endpoints:
  - `GET /v4/competitions/PL`
  - `GET /v4/competitions/PL/matches?season=2026`
  - Optional date window: `dateFrom` + `dateTo` on the matches subresource.

### Actions

| Action | Purpose |
| --- | --- |
| `provider_check` | Read-only readiness probe (no DB writes) |
| `map_provider_ids` | Map football-data match IDs onto existing `season_fixtures` rows |
| `provider_sync` | Provider reconciliation only (no candidate window creation) |
| `reconcile` | Provider sync + optional candidate window creation |

## Deploy command (when approved)

```bash
supabase secrets set FOOTBALL_DATA_API_KEY="<football-data-token>"

supabase functions deploy reconcile-fixtures --no-verify-jwt
```

`--no-verify-jwt` is safe because the function performs authentication internally.

Do **not** place `FOOTBALL_DATA_API_KEY` in Netlify, `.env.local`, frontend env, or Git.

## Cron activation (later)

See `supabase/scheduling/enable-fixture-cron.sql`. Cron SQL must read project URL and scheduler secret from **Supabase Vault**, not from committed files.

Do not enable cron until:

1. Migration `4_fixture_operations_core.sql` and `5_football_data_provider.sql` are applied.
2. Master fixtures are imported.
3. `FOOTBALL_DATA_API_KEY` is configured.
4. CEO approves recurring external monitoring.
