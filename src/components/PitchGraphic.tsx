export function PitchGraphic({ className = 'w-full h-full' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 320 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="8" y="12" width="304" height="156" rx="10" fill="#1B1022" stroke="#00FFEA" strokeOpacity="0.35" />
      <line x1="160" y1="12" x2="160" y2="168" stroke="#00FFEA" strokeOpacity="0.25" />
      <circle cx="160" cy="90" r="24" stroke="#FF2882" strokeOpacity="0.45" />
      <rect x="8" y="58" width="44" height="64" stroke="#D0FF00" strokeOpacity="0.35" />
      <rect x="268" y="58" width="44" height="64" stroke="#D0FF00" strokeOpacity="0.35" />
      <path d="M24 90H44M276 90H296" stroke="#FFFFFF" strokeOpacity="0.2" />
      <circle cx="52" cy="90" r="3" fill="#FF2882" />
      <circle cx="268" cy="90" r="3" fill="#00FFEA" />
    </svg>
  )
}
