import { Link } from 'react-router-dom'

export function ButtonLink({
  to,
  children,
  variant = 'primary',
  className = '',
}: {
  to: string
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  className?: string
}) {
  const styles = variant === 'primary' ? 'los-btn-primary' : 'los-btn-secondary'
  return (
    <Link className={`${styles} ${className}`.trim()} to={to}>
      {children}
    </Link>
  )
}
