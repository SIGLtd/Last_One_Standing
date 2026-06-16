export function Card({
  title,
  description,
  children,
  right,
}: {
  title?: string
  description?: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface/70 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
      {(title || description || right) && (
        <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

