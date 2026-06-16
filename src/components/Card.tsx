export function Card({
  title,
  description,
  children,
  right,
  accent = true,
}: {
  title?: string
  description?: string
  right?: React.ReactNode
  accent?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="los-card overflow-hidden">
      {(title || description || right) && (
        <header
          className={[
            'flex items-start justify-between gap-4 px-5 py-4',
            accent ? 'los-card-header' : 'border-b border-border',
          ].join(' ')}
        >
          <div className="min-w-0">
            {title && <h2 className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted-ink">{description}</p>}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}
