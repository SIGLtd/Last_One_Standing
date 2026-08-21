import { Card } from '../components/Card'
import { useGame } from '../contexts/GameContext'
import { APP_TAGLINE, CURRENT_GAME, formatGBP } from '../lib/constants'
import { buildRulesSections } from '../lib/rulesContent'

export function RulesPage() {
  const { currentPot } = useGame()
  const sections = buildRulesSections()
  const potLabel = currentPot == null ? '' : ` · ${formatGBP(currentPot)}`

  return (
    <Card title="Rules" description={`${APP_TAGLINE} Game ${CURRENT_GAME}${potLabel}`} compact>
      <div>
        {sections.map((section) => (
          <section key={section.title} className="los-rules-section">
            <h3 className="los-section-title text-purple">{section.title}</h3>
            <ul className="mt-2 grid gap-1.5 pl-4 text-sm text-ink list-disc leading-relaxed">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  )
}
