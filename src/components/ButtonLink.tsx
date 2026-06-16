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
  const styles = variant === 'primary' ? 'los-btn-primary' : 'los-btn-secondary'
  return (
    <Link className={styles} to={to}>
      {children}
    </Link>
  )
}
