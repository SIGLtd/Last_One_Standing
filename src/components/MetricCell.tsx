export function MetricCell({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`los-metric ${className}`}>
      <div className="los-metric-label">{label}</div>
      <div className="los-metric-value">{value}</div>
    </div>
  )
}

export function MetricStrip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`los-metric-strip ${className}`}>{children}</div>
}
