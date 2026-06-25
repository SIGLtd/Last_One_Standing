import { useEffect, useId, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { MobileMenuItem } from '../lib/appNavigation'

type MobileNavMenuProps = {
  open: boolean
  items: MobileMenuItem[]
  menuActive: boolean
  signingOut: boolean
  onToggle: () => void
  onClose: () => void
  onSignOut: () => void
}

function menuItemClass(isActive: boolean) {
  return [
    'flex min-h-11 w-full items-center rounded px-3 text-sm font-medium transition-colors',
    isActive ? 'bg-white/15 text-white' : 'text-white/90 hover:bg-white/10',
  ].join(' ')
}

export function MobileNavMenu({
  open,
  items,
  menuActive,
  signingOut,
  onToggle,
  onClose,
  onSignOut,
}: MobileNavMenuProps) {
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
        onClick={onToggle}
        className={[
          'flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[0.625rem] font-semibold uppercase tracking-wide transition-colors',
          open || menuActive ? 'text-white border-t-2 border-cyan -mt-px' : 'text-white/65',
        ].join(' ')}
      >
        Menu
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={onClose}
          />
          <div
            id={panelId}
            role="menu"
            aria-label="More navigation"
            className="fixed inset-x-0 bottom-[4.5rem] z-50 border-t border-white/10 bg-purple-dark px-3 py-2 shadow-lg md:hidden"
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

                if (item.kind === 'account') {
                  return (
                    <li key={item.to} role="none">
                      <NavLink
                        to={item.to}
                        role="menuitem"
                        onClick={onClose}
                        className={({ isActive }) => menuItemClass(isActive)}
                      >
                        <span>{item.label}</span>
                        <span className="ml-2 truncate text-xs font-normal text-white/70">{item.displayName}</span>
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
