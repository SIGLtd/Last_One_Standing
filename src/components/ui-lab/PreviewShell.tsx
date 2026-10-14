import type { ReactNode } from 'react'
import { UI_LAB_SCREEN_LABELS, UI_LAB_SCREENS, type UiLabScreen } from '../../lib/uiLabPreview'

export function PreviewShell({
  screen,
  onScreenChange,
  children,
}: {
  screen: UiLabScreen
  onScreenChange: (screen: UiLabScreen) => void
  children: ReactNode
}) {
  return (
    <div className="grid gap-3">
      <header className="los-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-ink">UI Lab</p>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-ink">Preview new UI</h1>
        <p className="mt-1 text-sm text-muted-ink">
          Testing the next version of Last One Standing. This does not change the live player view.
        </p>
      </header>

      <nav className="los-card p-1" aria-label="UI Lab screens">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {UI_LAB_SCREENS.map((item) => {
            const selected = item === screen
            return (
              <button
                key={item}
                type="button"
                aria-current={selected ? 'page' : undefined}
                className={[
                  'los-tap-target rounded-lg px-2 py-2 text-left text-xs font-semibold',
                  selected ? 'bg-purple text-white' : 'text-muted-ink',
                ].join(' ')}
                onClick={() => onScreenChange(item)}
              >
                {UI_LAB_SCREEN_LABELS[item]}
              </button>
            )
          })}
        </div>
      </nav>

      {children}
    </div>
  )
}
