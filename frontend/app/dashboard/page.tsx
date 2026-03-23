"use client"
import { useEffect, useState } from "react"
import { useMatchmakingStore } from "../../lib/store"
import { formatRelativeTime, runEffectOr, fetchJsonWithRetry } from "../../lib/utils"
import type { DashboardData, RecentMatch } from "./loader"

type FruitType = "apple" | "orange"

interface Step {
  role: "system" | "fruit" | "agent"
  content: string
}

export default function DashboardPage() {
  const { matches, conversations, activeConversationId, isLoading, error,
    addMatch, addConversation, addMessageToConversation,
    setActiveConversation, setLoading, setError } = useMatchmakingStore()

  const [data, setData] = useState<DashboardData | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [activeFruit, setActiveFruit] = useState<FruitType>("apple")

  const activeConv = conversations.find(c => c.id === activeConversationId)

  function pushStep(step: Step) {
    setSteps(s => [...s, step])
  }

  async function fetchDashboard() {
    const result = await runEffectOr(
      fetchJsonWithRetry<DashboardData>("/api/dashboard"),
      { metrics: { totalApples: 0, totalOranges: 0, totalMatches: 0, avgMutualScore: 0, avgAppleScore: 0, avgOrangeScore: 0 }, recentMatches: [], scoreDistribution: [] }
    )
    setData(result)
  }

  useEffect(() => { fetchDashboard() }, [])

  async function startConversation(type: FruitType) {
    setLoading(true)
    setError(null)
    setSteps([])
    setActiveFruit(type)
    const convId = `conv-${Date.now()}`
    addConversation({ id: convId, type, fruitId: "", messages: [], status: "active", createdAt: new Date() })
    setActiveConversation(convId)
    pushStep({ role: "system", content: `A new ${type} has arrived and is looking for a match...` })
    try {
      const res = await runEffectOr(
        fetchJsonWithRetry<Record<string, unknown>>(`/api/match?type=${type}`),
        { error: "Request failed" }
      )
      if (res.error) {
        pushStep({ role: "system", content: `Error: ${String(res.error)}` })
        setError(String(res.error))
        return
      }
      const comm = res.communication as { attributes: string; preferences: string }
      pushStep({ role: "fruit", content: comm.attributes })
      pushStep({ role: "fruit", content: comm.preferences })
      const mArr = (res.matches as { orangeId?: string; appleId?: string; mutualScore: number }[]) ?? []
      pushStep({ role: "system", content: `Found ${mArr.length} match${mArr.length !== 1 ? "es" : ""}. Generating narrative...` })
      pushStep({ role: "agent", content: String(res.narrative ?? "") })
      mArr.forEach((m, i) => addMatch({
        id: `${convId}-${i}`,
        appleId: type === "apple" ? convId : (m.appleId ?? ""),
        orangeId: type === "orange" ? convId : (m.orangeId ?? ""),
        score: m.mutualScore,
        status: "confirmed",
        createdAt: new Date(),
      }))
      addMessageToConversation(convId, { id: "attrs", role: "user", content: comm.attributes, timestamp: new Date() })
      addMessageToConversation(convId, { id: "narr", role: "assistant", content: String(res.narrative ?? ""), timestamp: new Date() })
      await fetchDashboard()
    } finally {
      setLoading(false)
    }
  }

  const dist = data?.scoreDistribution ?? []
  const maxBucket = Math.max(...dist.map(d => d.count), 1)
  const recentMatches = data?.recentMatches ?? []
  const metrics = data?.metrics

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">🍎 Matchmaking Dashboard 🍊</h1>
            <p className="mt-1 text-sm text-muted">Creating perfect pears, one match at a time</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => startConversation("apple")} disabled={isLoading} className="btn-primary disabled:opacity-50">
              {isLoading && activeFruit === "apple" ? "Matching..." : "New Apple"}
            </button>
            <button onClick={() => startConversation("orange")} disabled={isLoading} className="btn-secondary disabled:opacity-50">
              {isLoading && activeFruit === "orange" ? "Matching..." : "New Orange"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">Overview</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Apples", value: metrics?.totalApples ?? 0, icon: "🍎" },
              { label: "Oranges", value: metrics?.totalOranges ?? 0, icon: "🍊" },
              { label: "Matches", value: metrics?.totalMatches ?? 0, icon: "🍐" },
              { label: "Avg Score", value: metrics?.avgMutualScore ?? 0, icon: "⭐" },
              { label: "Apple Sat.", value: metrics?.avgAppleScore ?? 0, icon: "📊" },
              { label: "Orange Sat.", value: metrics?.avgOrangeScore ?? 0, icon: "📈" },
            ].map(m => (
              <div key={m.label} className="metric-card">
                <div className="flex items-center justify-between">
                  <span className="text-xl">{m.icon}</span>
                  <span className="text-xs uppercase tracking-wide text-muted">{m.label}</span>
                </div>
                <p className="mt-4 text-3xl font-bold">{data ? String(m.value) : "—"}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">Conversation</h2>
          <div className="card min-h-[280px]">
            {steps.length === 0 ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center text-center text-muted">
                <p className="text-4xl">🎯</p>
                <p className="mt-3 font-medium">Start a new conversation</p>
                <p className="mt-1 text-sm">Click New Apple or New Orange to watch the matchmaking flow live.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className={`flex gap-3 ${step.role === "agent" ? "flex-row-reverse" : ""}`}>
                    <span className="mt-1 flex-shrink-0 text-lg">
                      {step.role === "system" ? "⚙️" : step.role === "fruit" ? (activeFruit === "apple" ? "🍎" : "🍊") : "🤖"}
                    </span>
                    <p className={`max-w-2xl rounded-xl px-4 py-3 text-sm leading-relaxed ${step.role === "system" ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" : step.role === "fruit" ? "bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200" : "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"}`}>
                      {step.content}
                    </p>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <span className="text-lg">⚙️</span>
                    <p className="animate-pulse rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-400 dark:bg-zinc-800">thinking...</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 text-lg font-semibold">Score Distribution</h2>
            <div className="card">
              {dist.every(d => d.count === 0) ? (
                <p className="text-sm text-muted">No matches yet — run a conversation to populate.</p>
              ) : (
                <div className="space-y-3">
                  {dist.map(d => (
                    <div key={d.bucket} className="flex items-center gap-3">
                      <span className="w-20 text-right font-mono text-xs text-muted">{d.bucket}</span>
                      <div className="flex-1 rounded-full bg-zinc-100 dark:bg-zinc-800" style={{ height: 18 }}>
                        <div
                          className="rounded-full bg-pear transition-all duration-500"
                          style={{ width: `${(d.count / maxBucket) * 100}%`, height: 18 }}
                        />
                      </div>
                      <span className="w-5 font-mono text-xs text-muted">{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold">Match Graph</h2>
            <div className="card">
              <MatchGraph matches={recentMatches} />
            </div>
          </section>
        </div>

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">Recent Matches</h2>
          <div className="card">
            {recentMatches.length === 0 ? (
              <p className="text-sm text-muted">No matches yet.</p>
            ) : (
              <div className="space-y-2">
                {recentMatches.map(m => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span>🍎</span>
                      <span className="font-mono text-xs text-muted">{m.appleId.split(":")[1]?.slice(0, 8) ?? "—"}</span>
                      <span className="text-muted">×</span>
                      <span>🍊</span>
                      <span className="font-mono text-xs text-muted">{m.orangeId.split(":")[1]?.slice(0, 8) ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-mono text-xs font-bold ${m.score >= 0.8 ? "text-pear" : m.score >= 0.6 ? "text-orange" : "text-apple"}`}>
                        {m.score.toFixed(3)}
                      </span>
                      <span className="text-xs text-muted">{formatRelativeTime(m.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

      </main>
    </div>
  )
}

function MatchGraph({ matches }: { matches: RecentMatch[] }) {
  if (matches.length === 0) {
    return <p className="text-sm text-muted">No matches to display yet.</p>
  }

  const W = 340
  const H = 240
  const cx = W / 2
  const cy = H / 2
  const apples = [...new Set(matches.map(m => m.appleId))].slice(0, 6)
  const oranges = [...new Set(matches.map(m => m.orangeId))].slice(0, 6)
  const aStep = H / (apples.length + 1)
  const oStep = H / (oranges.length + 1)
  const aPos = (i: number) => ({ x: 40, y: aStep * (i + 1) })
  const oPos = (i: number) => ({ x: W - 40, y: oStep * (i + 1) })

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      {matches.slice(0, 18).map((m, i) => {
        const ai = apples.indexOf(m.appleId)
        const oi = oranges.indexOf(m.orangeId)
        if (ai < 0 || oi < 0) return null
        const a = aPos(ai)
        const o = oPos(oi)
        const opacity = 0.2 + m.score * 0.8
        return (
          <line key={i}
            x1={a.x + 12} y1={a.y} x2={o.x - 12} y2={o.y}
            stroke="#84cc16" strokeWidth={1 + m.score * 2}
            strokeOpacity={opacity}
          />
        )
      })}
      {apples.map((id, i) => {
        const p = aPos(i)
        return (
          <g key={id}>
            <circle cx={p.x} cy={p.y} r={12} fill="#fecaca" stroke="#ef4444" strokeWidth={1} />
            <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={11}>🍎</text>
            <text x={p.x + 16} y={p.y} textAnchor="start" dominantBaseline="central" fontSize={9} fill="var(--color-muted)" fontFamily="monospace">
              {id.split(":")[1]?.slice(0, 6)}
            </text>
          </g>
        )
      })}
      {oranges.map((id, i) => {
        const p = oPos(i)
        return (
          <g key={id}>
            <circle cx={p.x} cy={p.y} r={12} fill="#fed7aa" stroke="#f97316" strokeWidth={1} />
            <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={11}>🍊</text>
            <text x={p.x - 16} y={p.y} textAnchor="end" dominantBaseline="central" fontSize={9} fill="var(--color-muted)" fontFamily="monospace">
              {id.split(":")[1]?.slice(0, 6)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
