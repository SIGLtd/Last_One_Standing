import { Card } from './Card'
import type { SupabaseConfigIssue, SupabaseConfigStatus } from '../lib/supabase'

const issueMessages: Record<SupabaseConfigIssue, string> = {
  missing_url:
    'VITE_SUPABASE_URL is not set. Add it to .env.local in the project root and restart the dev server.',
  invalid_url:
    'VITE_SUPABASE_URL is set but invalid. Use a single https:// prefix, e.g. https://your-project.supabase.co',
  missing_key:
    'No Supabase key found. Set VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) in .env.local and restart the dev server.',
  invalid_key:
    'Supabase key is set but not recognised. Use your full anon JWT (eyJ…) or publishable key (sb_publishable_…).',
  client_init_failed:
    'Environment values look valid but the Supabase client failed to start. Restart the dev server after saving .env.local.',
}

type SupabaseConfigNoticeProps = {
  status?: SupabaseConfigStatus
}

export function SupabaseConfigNotice({ status }: SupabaseConfigNoticeProps) {
  const failedStatus = status && !status.ok ? status : null

  return (
    <Card title="Supabase not configured" description="Dev setup required" compact>
      <div className="grid gap-2 text-xs text-muted-ink">
        <p>
          Vite reads <code className="rounded bg-surface-2 px-1 py-0.5 text-ink">.env.local</code> from the project
          root. Only variables prefixed with{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-ink">VITE_</code> are available to the app. Restart{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-ink">npm run dev</code> after changes.
        </p>

        {failedStatus ? (
          <div className="los-notice grid gap-1">
            <div className="los-section-title">Checks failed</div>
            <ul className="grid gap-2">
              {failedStatus.issues.map((issue) => (
                <li key={issue} className="text-sm text-muted-ink">
                  {issueMessages[issue]}
                </li>
              ))}
            </ul>

            {failedStatus.url ? (
              <div className="text-xs text-muted-ink">
                URL value: <code className="text-ink">{failedStatus.url}</code>
              </div>
            ) : null}

            {failedStatus.maskedKey ? (
              <div className="text-xs text-muted-ink">
                Key detected
                {failedStatus.usedKeyVar ? (
                  <>
                    {' '}
                    via <code className="text-ink">{failedStatus.usedKeyVar}</code>
                  </>
                ) : null}
                : <code className="text-ink">{failedStatus.maskedKey}</code>
              </div>
            ) : null}
          </div>
        ) : (
          <p>
            Set <code className="rounded bg-surface-2 px-1 py-0.5 text-ink">VITE_SUPABASE_URL</code> and{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 text-ink">VITE_SUPABASE_ANON_KEY</code> in{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 text-ink">.env.local</code>.
          </p>
        )}

        <p>Do not commit secret keys. Use the Supabase project anon or publishable key only.</p>
      </div>
    </Card>
  )
}
