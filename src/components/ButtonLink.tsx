import { Link } from 'react-router-dom'

export function ButtonLink({
  to,
  children,
  variant = 'primary',
}: {
  to: string
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
}) {
  const base =
    'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold tracking-tight border transition-colors'
  const styles =
    variant === 'primary'
      ? 'bg-accent text-bg border-accent hover:bg-accent/90'
      : 'bg-surface text-text border-border hover:bg-surface-2'
  return (
    <Link className={[base, styles].join(' ')} to={to}>
      {children}
    </Link>
  )
}

