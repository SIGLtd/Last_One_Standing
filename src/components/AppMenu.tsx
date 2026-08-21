import { useEffect, useId, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { AppMenuItem } from '../lib/appNavigation'

type AppMenuProps = {
  open: boolean
  items: AppMenuItem[]
  signingOut: boolean
  onToggle: () => void
  onClose: () => void
  onSignOut: () => void
}

function menuItemClass(isActive: boolean) {
  return [
    'flex min-h-11 w-full items-center rounded px-3 text-base font-medium',
    isActive ? 'bg-white/15 text-white' : 'text-white/90',
  ].join(' ')
}

export function AppMenu({ open, items, signingOut, onToggle, onClose, onSignOut }: AppMenuProps) {
  const panelId = useId()
  const location = useLocation()
  const closeRef = useRef(onClose)

  closeRef.current = onClose

  useEffect(() => {
    closeRef.current()
  }, [location.pathname])

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeRef.current()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="menu"
        aria-label="Menu"
        onClick={onToggle}
        className="los-tap-target flex items-center gap-2 rounded px-2 text-sm font-semibold text-white"
      >
        <span className="los-menu-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        Menu
      </button>

      {open ? (
        <>
          <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
          <div
            id={panelId}
            role="menu"
            aria-label="App menu"
            className="absolute right-3 top-full z-50 mt-1 w-[min(100%-1.5rem,20rem)] rounded border border-white/15 bg-purple-dark p-2 shadow-lg"
          >
            <ul className="grid gap-1">
              {items.map((item) => {
                if (item.kind === 'link') {
                  return (
                    <li key={item.to} role="none">
                      <NavLink
                        to={item.to}
                        role="menuitem"
                        onClick={onClose}
                        className={({ isActive }) => menuItemClass(isActive)}
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  )
                }

                return (
                  <li key="logout" role="none">
                    <button
                      type="button"
                      role="menuitem"
                      disabled={signingOut}
                      onClick={() => {
                        onClose()
                        onSignOut()
                      }}
                      className={menuItemClass(false)}
                    >
                      {signingOut ? 'Logging out…' : item.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      ) : null}
    </>
  )
}
