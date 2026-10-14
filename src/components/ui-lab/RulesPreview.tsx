import { UI_LAB_DEADLINE_RULE, rulesPreviewSections } from '../../lib/uiLabPreview'

export function RulesPreview() {
  const sections = rulesPreviewSections()

  return (
    <div className="grid gap-3">
      <section className="los-card p-4">
        <h2 className="text-sm font-semibold text-ink">Rules</h2>
        <p className="mt-1 text-sm text-muted-ink">{UI_LAB_DEADLINE_RULE}</p>
      </section>
      {sections.map((section) => (
        <article key={section.title} className="los-card p-4">
          <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
          <ul className="mt-2 grid gap-1.5">
            {section.items.map((item) => (
              <li key={item} className="text-sm text-ink">
                {item}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  )
}
