const styles = {
  success: 'los-badge los-badge-success',
  warning: 'los-badge los-badge-warning',
  muted: 'los-badge los-badge-muted',
  open: 'los-badge los-badge-open',
} as const

export function Badge({
  children,
  variant = 'muted',
}: {
  children: React.ReactNode
  variant?: keyof typeof styles
}) {
  return <span className={styles[variant]}>{children}</span>
}
