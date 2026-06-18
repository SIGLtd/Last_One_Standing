import losLogo from '../assets/LOS_Logo.png'
import premierLeagueLogo from '../assets/Premier_League_Logo.svg'

export function AppLogo({
  className = '',
  losClassName = 'h-10 w-10',
  plClassName = 'h-7 w-auto max-w-[9.5rem]',
  onDark = false,
}: {
  className?: string
  losClassName?: string
  plClassName?: string
  /** Light panel behind both marks for dark header backgrounds. */
  onDark?: boolean
}) {
  const brand = (
    <span className={['inline-flex items-center gap-2.5', className].join(' ')}>
      <img
        src={losLogo}
        alt="Last One Standing"
        className={`${losClassName} shrink-0 object-contain`}
        draggable={false}
      />
      <span className="h-8 w-px shrink-0 bg-black/10" aria-hidden="true" />
      <img
        src={premierLeagueLogo}
        alt="Premier League"
        className={`${plClassName} object-contain`}
        draggable={false}
      />
    </span>
  )

  if (onDark) {
    return (
      <span className="inline-flex shrink-0 items-center rounded bg-white px-2 py-1">
        {brand}
      </span>
    )
  }

  return brand
}
