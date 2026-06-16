import { NavLink } from 'react-router-dom'
import { APP_NAME, CURRENT_GAME, CURRENT_POT_GBP } from '../lib/constants'

const navItems: Array<{ to: string; label: string }> = [
  { to: '/', label: 'Home' },
  { to: '/rules', label: 'Rules' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/pick', label: 'Pick' },
  { to: '/current-picks', label: 'Current picks' },
  { to: '/history', label: 'History' },
  { to: '/admin', label: 'Admin' },
]

function formatGBP(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-text">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-bg/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl border border-border bg-surface grid place-items-center">
                  <span className="text-accent font-semibold tracking-tight">LOS</span>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold tracking-tight">{APP_NAME}</div>
                  <div className="text-xs text-muted">
                    Game {CURRENT_GAME} • Pot {formatGBP(CURRENT_POT_GBP)}
                  </div>
                </div>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      'px-3 py-2 text-sm rounded-lg border border-transparent',
                      isActive
                        ? 'bg-surface border-border text-text'
                        : 'text-muted hover:text-text hover:bg-surface/70',
                    ].join(' ')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>

      <footer className="border-t border-border/70 bg-bg">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="text-sm text-muted">
              Private survival pool app for a WhatsApp group. No Premier League branding.
            </div>

            <nav className="md:hidden grid grid-cols-2 gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      'px-3 py-2 text-sm rounded-lg border',
                      isActive
                        ? 'bg-surface border-border text-text'
                        : 'border-border/70 bg-surface/30 text-muted hover:text-text hover:bg-surface/60',
                    ].join(' ')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}

