export function AppLogo({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="los-shield" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF2882" />
          <stop offset="1" stopColor="#00FFEA" />
        </linearGradient>
      </defs>
      <path
        d="M32 4L52 14V32C52 44.15 43.5 54.5 32 60C20.5 54.5 12 44.15 12 32V14L32 4Z"
        fill="url(#los-shield)"
      />
      <path
        d="M32 10L46 17.5V31.5C46 40.4 40.1 48.4 32 52.8C23.9 48.4 18 40.4 18 31.5V17.5L32 10Z"
        fill="#1B1022"
        opacity="0.92"
      />
      <circle cx="32" cy="30" r="9" stroke="#D0FF00" strokeWidth="2.2" fill="none" />
      <path
        d="M32 21.5V38.5M23.5 30H40.5M26.2 24.2L37.8 35.8M37.8 24.2L26.2 35.8"
        stroke="#00FFEA"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}
