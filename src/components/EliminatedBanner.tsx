import { ELIMINATED_BANNER_BODY, ELIMINATED_BANNER_TITLE, ELIMINATED_TICKER_TEXT } from '../lib/survivalStatus'

export function EliminatedBanner() {
  return (
    <section className="los-elim-banner" aria-label="Eliminated">
      <div className="los-elim-banner-copy">
        <p className="los-elim-banner-title">{ELIMINATED_BANNER_TITLE}</p>
        <p className="los-elim-banner-body">{ELIMINATED_BANNER_BODY}</p>
      </div>
      <div className="los-elim-ticker" aria-label={ELIMINATED_TICKER_TEXT}>
        <p className="los-elim-ticker-static">{ELIMINATED_TICKER_TEXT}</p>
        <div className="los-elim-ticker-track" aria-hidden="true">
          <span>{ELIMINATED_TICKER_TEXT}</span>
          <span>{ELIMINATED_TICKER_TEXT}</span>
          <span>{ELIMINATED_TICKER_TEXT}</span>
          <span>{ELIMINATED_TICKER_TEXT}</span>
        </div>
      </div>
    </section>
  )
}
