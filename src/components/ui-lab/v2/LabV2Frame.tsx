import type { ReactNode } from 'react'
import type { UiLabScreen } from '../../../lib/uiLabPreview'
import './uiLabV2.css'

const NAV: Array<{ screen: UiLabScreen; label: string }> = [
  { screen: 'player-home', label: 'Home' },
  { screen: 'make-pick', label: 'My Pick' },
  { screen: 'everyones-picks', label: 'All Picks' },
  { screen: 'admin-cockpit', label: 'Admin' },
]

export function LabV2Frame({
  screen,
  onScreenChange,
  gameLabel,
  potLabel,
  children,
}: {
  screen: UiLabScreen
  onScreenChange: (screen: UiLabScreen) => void
  gameLabel: string
  potLabel: string
  children: ReactNode
}) {
  return (
    <div className="ui-lab-v2" data-testid="ui-lab-v2">
      <header className="flex items-center justify-between gap-2 border-b border-[#381A54] bg-[#1B0C2A]/95 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e7b3ff]/30 bg-[#27123D]">
            <span className="lab-label text-[11px] text-[#caf300]">LOS</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold uppercase tracking-wider text-white">Last One Standing</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#cfc3d0]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00e5a3]" />
              {gameLabel} · Pot {potLabel}
            </p>
          </div>
        </div>
        <div className="rounded-full border border-[#381A54] bg-[#27123D] px-2.5 py-1 text-[11px] font-medium text-white">
          Preview
        </div>
      </header>

      <div className="min-h-[32rem] bg-[#14081F] px-3 py-3 pb-20">{children}</div>

      <nav className="grid grid-cols-4 border-t border-[#381A54] bg-[#14081F]/95 px-2 py-2" aria-label="UI Lab v2 mock navigation">
        {NAV.map((item) => {
          const active = item.screen === screen
          return (
            <button
              key={item.screen}
              type="button"
              className={[
                'lab-label flex min-h-11 flex-col items-center justify-center text-[11px]',
                active ? 'text-[#00e5a3]' : 'text-[#cfc3d0]',
              ].join(' ')}
              onClick={() => onScreenChange(item.screen)}
            >
              {item.label}
              {item.screen === 'admin-cockpit' ? (
                <span className="mt-0.5 rounded bg-[#caf300] px-1 text-[9px] font-extrabold text-[#14081F]">ADM</span>
              ) : null}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
