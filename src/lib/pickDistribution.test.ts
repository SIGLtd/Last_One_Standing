import { describe, expect, it } from 'vitest'
import { buildPickDistribution, formatPickDistributionLine, formatTopPicksSummary } from './pickDistribution'

describe('pick distribution', () => {
  it('calculates counts and percentages from submitted picks only', () => {
    const rows = buildPickDistribution(['mun', 'mun', 'mun', 'liv', 'liv', 'ars'])
    expect(rows[0]).toMatchObject({ teamId: 'mun', teamName: 'Manchester United', count: 3, percent: 50 })
    expect(rows[1]).toMatchObject({ teamId: 'liv', teamName: 'Liverpool', count: 2, percent: 33 })
    expect(rows[2]).toMatchObject({ teamId: 'ars', teamName: 'Arsenal', count: 1, percent: 17 })
    expect(formatPickDistributionLine(rows[0])).toBe('Manchester United — 3 picks — 50%')
  })

  it('ignores null and superseded empty selections', () => {
    const rows = buildPickDistribution(['mun', null, undefined, '', 'mun'])
    expect(rows).toEqual([
      expect.objectContaining({ teamId: 'mun', count: 2, percent: 100 }),
    ])
  })

  it('returns an empty list when no picks have been submitted', () => {
    expect(buildPickDistribution([])).toEqual([])
    expect(buildPickDistribution([null, undefined])).toEqual([])
  })

  it('summarises the top picks with readable team names', () => {
    const rows = buildPickDistribution(['mun', 'mun', 'liv'])
    expect(formatTopPicksSummary(rows)).toContain('Most picked:')
    expect(formatTopPicksSummary(rows)).toContain('Man United')
    expect(formatTopPicksSummary([])).toBe('No picks yet')
  })
})
