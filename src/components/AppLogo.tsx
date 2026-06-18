import premierLeagueLogo from '../assets/Premier_League_Logo.svg'

export function AppLogo({
  className = 'h-8 w-auto',
  onDark = false,
}: {
  className?: string
  /** Adds a light panel so the purple wordmark reads on dark header backgrounds. */
  onDark?: boolean
}) {
  const image = (
    <img
      src={premierLeagueLogo}
      alt="Premier League"
      className={className}
      draggable={false}
    />
  )

  if (onDark) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
        {image}
      </span>
    )
  }

  return image
}
