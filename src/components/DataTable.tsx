export function DataTable({
  children,
  className = '',
  minWidth,
}: {
  children: React.ReactNode
  className?: string
  minWidth?: string
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="los-data-table" style={minWidth ? { minWidth } : undefined}>
        {children}
      </table>
    </div>
  )
}
