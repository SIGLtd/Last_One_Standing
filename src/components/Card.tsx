export function Card({
  title,
  description,
  children,
  right,
  accent = false,
  compact = false,
}: {
  title?: string
  description?: string
  right?: React.ReactNode
  accent?: boolean
  compact?: boolean
  children: React.ReactNode
}) {
  const bodyPad = compact ? 'p-3' : 'p-4'
  const headerPad = compact ? 'px-3 py-2.5' : 'px-4 py-3'

  return (
    <section className="los-card overflow-hidden">
      {(title || description || right) && (
        <header
          className={[
            'flex items-start justify-between gap-3',
            headerPad,
            accent ? 'los-card-header' : 'border-b border-border',
          ].join(' ')}
        >
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-ink">{description}</p>}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </header>
      )}
      <div className={bodyPad}>{children}</div>
    </section>
  )
}
