import { Card } from './Card'

export function SupabaseConfigNotice() {
  return (
    <Card title="Supabase not configured" description="Development configuration required">
      <div className="grid gap-2 text-sm text-muted">
        <p>
          Set <code className="rounded bg-surface-2 px-1 py-0.5 text-text">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-text">VITE_SUPABASE_ANON_KEY</code> in a local{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-text">.env</code> file, then restart the dev server.
        </p>
        <p>Do not commit secret keys. Use the Supabase project anon key only.</p>
      </div>
    </Card>
  )
}
