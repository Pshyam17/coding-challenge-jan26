const SURREALDB_URL = process.env.SURREALDB_URL ?? "http://127.0.0.1:8000"
const SURREALDB_USER = process.env.SURREALDB_USER ?? "root"
const SURREALDB_PASS = process.env.SURREALDB_PASS ?? "root"
const SURREALDB_NS = process.env.SURREALDB_NS ?? "clera"
const SURREALDB_DB = process.env.SURREALDB_DB ?? "matchmaking"
const authHeader = "Basic " + Buffer.from(SURREALDB_USER + ":" + SURREALDB_PASS).toString("base64")
const dbHeaders: Record<string, string> = {
  "Authorization": authHeader,
  "Surreal-NS": SURREALDB_NS,
  "Surreal-DB": SURREALDB_DB,
  "Accept": "application/json",
  "Content-Type": "text/plain",
}
async function dbQuery<T>(sql: string): Promise<T[]> {
  const res = await fetch(SURREALDB_URL + "/sql", { method: "POST", headers: dbHeaders, body: sql, cache: "no-store" })
  const data = await res.json()
  const last = data[data.length - 1]
  if (last?.status === "ERR") throw new Error("SurrealDB query error: " + last.result)
  return last?.result ?? []
}
export interface MatchMetrics {
  totalApples: number
  totalOranges: number
  totalMatches: number
  avgMutualScore: number
  avgAppleScore: number
  avgOrangeScore: number
}
export interface RecentMatch {
  id: string
  appleId: string
  orangeId: string
  score: number
  appleScore: number
  orangeScore: number
  narrative: string | null
  createdAt: string
}
export interface ScoreDistribution {
  bucket: string
  count: number
}
export interface DashboardData {
  metrics: MatchMetrics
  recentMatches: RecentMatch[]
  scoreDistribution: ScoreDistribution[]
}
export async function getDashboardData(): Promise<DashboardData> {
  try {
    const [appleCount, orangeCount, matchCount, matchData] = await Promise.all([
      dbQuery<{ count: number }>("SELECT count() FROM apple GROUP ALL"),
      dbQuery<{ count: number }>("SELECT count() FROM orange GROUP ALL"),
      dbQuery<{ count: number }>("SELECT count() FROM matched_to GROUP ALL"),
      dbQuery<{ id: string; in: string; out: string; score: number; apple_score: number; orange_score: number; narrative: string | null; created_at: string }>(
        "SELECT id, in, out, score, apple_score, orange_score, narrative, created_at FROM matched_to ORDER BY created_at DESC LIMIT 50"
      ),
    ])
    const totalApples = appleCount[0]?.count ?? 0
    const totalOranges = orangeCount[0]?.count ?? 0
    const totalMatches = matchCount[0]?.count ?? 0
    const avgMutualScore = matchData.length > 0 ? Math.round((matchData.reduce((s, m) => s + (m.score ?? 0), 0) / matchData.length) * 100) / 100 : 0
    const avgAppleScore = matchData.length > 0 ? Math.round((matchData.reduce((s, m) => s + (m.apple_score ?? 0), 0) / matchData.length) * 100) / 100 : 0
    const avgOrangeScore = matchData.length > 0 ? Math.round((matchData.reduce((s, m) => s + (m.orange_score ?? 0), 0) / matchData.length) * 100) / 100 : 0
    const buckets: Record<string, number> = { "0.0-0.2": 0, "0.2-0.4": 0, "0.4-0.6": 0, "0.6-0.8": 0, "0.8-1.0": 0 }
    for (const m of matchData) {
      if (m.score < 0.2) buckets["0.0-0.2"]++
      else if (m.score < 0.4) buckets["0.2-0.4"]++
      else if (m.score < 0.6) buckets["0.4-0.6"]++
      else if (m.score < 0.8) buckets["0.6-0.8"]++
      else buckets["0.8-1.0"]++
    }
    return {
      metrics: { totalApples, totalOranges, totalMatches, avgMutualScore, avgAppleScore, avgOrangeScore },
      recentMatches: matchData.slice(0, 10).map(m => ({
        id: String(m.id), appleId: String(m.in), orangeId: String(m.out),
        score: m.score, appleScore: m.apple_score, orangeScore: m.orange_score,
        narrative: m.narrative ?? null, createdAt: m.created_at,
      })),
      scoreDistribution: Object.entries(buckets).map(([bucket, count]) => ({ bucket, count })),
    }
  } catch (err) {
    console.error("Dashboard loader error:", err)
    return {
      metrics: { totalApples: 0, totalOranges: 0, totalMatches: 0, avgMutualScore: 0, avgAppleScore: 0, avgOrangeScore: 0 },
      recentMatches: [], scoreDistribution: [],
    }
  }
}
