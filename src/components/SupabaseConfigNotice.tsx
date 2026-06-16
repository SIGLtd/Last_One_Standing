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
    <Card title="Supabase not configured" description="Development configuration required">
      <div className="grid gap-3 text-sm text-muted">
        <p>
          Vite reads <code className="rounded bg-surface-2 px-1 py-0.5 text-text">.env.local</code> from the project
          root. Only variables prefixed with{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-text">VITE_</code> are available to the app. Restart{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-text">npm run dev</code> after changes.
        </p>

        {failedStatus ? (
          <div className="grid gap-2 rounded-xl border border-border bg-surface-2 p-3">
            <div className="text-xs font-semibold text-text">Checks failed</div>
            <ul className="grid gap-2">
              {failedStatus.issues.map((issue) => (
                <li key={issue} className="text-sm text-muted">
                  {issueMessages[issue]}
                </li>
              ))}
            </ul>

            {failedStatus.url ? (
              <div className="text-xs text-muted">
                URL value: <code className="text-text">{failedStatus.url}</code>
              </div>
            ) : null}

            {failedStatus.maskedKey ? (
              <div className="text-xs text-muted">
                Key detected
                {failedStatus.usedKeyVar ? (
                  <>
                    {' '}
                    via <code className="text-text">{failedStatus.usedKeyVar}</code>
                  </>
                ) : null}
                : <code className="text-text">{failedStatus.maskedKey}</code>
              </div>
            ) : null}
          </div>
        ) : (
          <p>
            Set <code className="rounded bg-surface-2 px-1 py-0.5 text-text">VITE_SUPABASE_URL</code> and{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 text-text">VITE_SUPABASE_ANON_KEY</code> in{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 text-text">.env.local</code>.
          </p>
        )}

        <p>Do not commit secret keys. Use the Supabase project anon or publishable key only.</p>
      </div>
    </Card>
  )
}
