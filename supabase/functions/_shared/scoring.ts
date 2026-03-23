import type { Fruit, FruitAttributes, FruitPreferences } from "./generateFruit.ts"

const SHINE_ORDER: Record<string, number> = {
  dull: 0,
  neutral: 1,
  shiny: 2,
  extraShiny: 3,
}

function scoreNumericRange(
  value: number | null,
  pref: { min?: number; max?: number } | null | undefined
): number {
  if (pref == null) return 1
  if (value == null) return 0.5
  const { min, max } = pref
  if (min !== undefined && value < min) return 0
  if (max !== undefined && value > max) return 0
  return 1
}

function scoreBoolean(
  value: boolean | null,
  pref: boolean | null | undefined
): number {
  if (pref == null) return 1
  if (value == null) return 0.5
  return value === pref ? 1 : 0
}

function scoreShineFactor(
  value: string | null,
  pref: string | string[] | null | undefined
): number {
  if (pref == null) return 1
  if (value == null) return 0.5
  const acceptable = Array.isArray(pref) ? pref : [pref]
  if (acceptable.includes(value)) return 1
  const valueRank = SHINE_ORDER[value] ?? 0
  const closest = acceptable.reduce(
    (best, s) => {
      const dist = Math.abs((SHINE_ORDER[s] ?? 0) - valueRank)
      return dist < best.dist ? { dist, s } : best
    },
    { dist: Infinity, s: "" }
  )
  return Math.max(0, 1 - closest.dist * 0.25)
}

export function scoreOneWay(
  attributes: FruitAttributes,
  preferences: FruitPreferences
): number {
  const preferenceCount = Object.keys(preferences).filter(
    (k) => preferences[k as keyof FruitPreferences] != null
  ).length

  if (preferenceCount === 0) return 1

  const scores: number[] = []

  if (preferences.size != null)
    scores.push(scoreNumericRange(attributes.size, preferences.size))
  if (preferences.weight != null)
    scores.push(scoreNumericRange(attributes.weight, preferences.weight))
  if (preferences.hasStem != null)
    scores.push(scoreBoolean(attributes.hasStem, preferences.hasStem))
  if (preferences.hasLeaf != null)
    scores.push(scoreBoolean(attributes.hasLeaf, preferences.hasLeaf))
  if (preferences.hasWorm != null)
    scores.push(scoreBoolean(attributes.hasWorm, preferences.hasWorm))
  if (preferences.shineFactor != null)
    scores.push(scoreShineFactor(attributes.shineFactor, preferences.shineFactor))
  if (preferences.hasChemicals != null)
    scores.push(scoreBoolean(attributes.hasChemicals, preferences.hasChemicals))

  return scores.reduce((a, b) => a + b, 0) / scores.length
}

export function scoreBidirectional(
  apple: Fruit,
  orange: Fruit
): {
  appleScore: number
  orangeScore: number
  mutualScore: number
} {
  const appleScore = scoreOneWay(orange.attributes, apple.preferences)
  const orangeScore = scoreOneWay(apple.attributes, orange.preferences)
  const mutualScore =
    appleScore + orangeScore === 0
      ? 0
      : (2 * appleScore * orangeScore) / (appleScore + orangeScore)

  return {
    appleScore: Math.round(appleScore * 1000) / 1000,
    orangeScore: Math.round(orangeScore * 1000) / 1000,
    mutualScore: Math.round(mutualScore * 1000) / 1000,
  }
}
