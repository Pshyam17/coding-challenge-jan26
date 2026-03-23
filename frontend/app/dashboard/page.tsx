"use client"
import { useEffect, useState } from "react"
import { useMatchmakingStore } from "../../lib/store"
import { formatRelativeTime, runEffectOr, fetchJsonWithRetry } from "../../lib/utils"
import type { DashboardData, RecentMatch, AttributeStat } from "./loader"

type FruitType = "apple" | "orange"

interface Step {
  role: "system" | "fruit" | "agent"
  content: string
}

function stepBg(role: Step["role"]) {
  if (role === "system") return "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
  if (role === "fruit") return "bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
  return "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
}

function scoreColor(score: number) {
  if (score >= 0.8) return "text-pear"
  if (score >= 0.6) return "text-orange"
  return "text-apple"
}

function MatchGraph({ matches }: { matches: RecentMatch[] }) {
  if (matches.length === 0) {
    return <p className="text-sm text-muted py-4 text-center">No matches yet.</p>
  }
  const W = 340
  const H = 260
  const apples = [...new Set(matches.map(m => m.appleId))].slice(0, 7)
  const oranges = [...new Set(matches.map(m => m.orangeId))].slice(0, 7)
  const aStep = H / (apples.length + 1)
  const oStep = H / (oranges.length + 1)
  const aPos = (i: number) => ({ x: 44, y: aStep * (i + 1) })
  const oPos = (i: number) => ({ x: W - 44, y: oStep * (i + 1) })
  
  return (
    <div className="w-full h-full min-h-[260px]">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {matches.slice(0, 21).map((m, i) => {
          const ai = apples.indexOf(m.appleId)
          const oi = oranges.indexOf(m.orangeId)
          if (ai < 0 || oi < 0) return null
          const a = aPos(ai)
          const o = oPos(oi)
          return (
            <line key={i}
              x1={a.x + 14} y1={a.y} x2={o.x - 14} y2={o.y}
              stroke="#84cc16"
              strokeWidth={0.5 + m.score * 2.5}
              strokeOpacity={0.2 + m.score * 0.75}
            />
          )
        })}
        {apples.map((id, i) => {
          const p = aPos(i)
          return (
            <g key={id}>
              <circle cx={p.x} cy={p.y} r={13} fill="#fecaca" stroke="#ef4444" strokeWidth={1} />
              <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={12}>🍎</text>
              <text x={p.x + 18} y={p.y} textAnchor="start" dominantBaseline="central" fontSize={8} fill="gray" fontFamily="monospace">
                {id.split(":")[1]?.slice(0, 7) ?? id.slice(0, 7)}
              </text>
            </g>
          )
        })}
        {oranges.map((id, i) => {
          const p = oPos(i)
          return (
            <g key={id}>
              <circle cx={p.x} cy={p.y} r={13} fill="#fed7aa" stroke="#f97316" strokeWidth={1} />
              <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={12}>🍊</text>
              <text x={p.x - 18} y={p.y} textAnchor="end" dominantBaseline="central" fontSize={8} fill="gray" fontFamily="monospace">
                {id.split(":")[1]?.slice(0, 7) ?? id.slice(0, 7)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function DashboardPage() {
  const { isLoading, addMatch, addConversation, addMessageToConversation,
    setActiveConversation, setLoading, setError, error } = useMatchmakingStore()
  const [data, setData] = useState<DashboardData | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [activeFruit, setActiveFruit] = useState<FruitType>("apple")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function fetchDashboard() {
    const result = await runEffectOr(
      fetchJsonWithRetry<DashboardData>("/api/dashboard"),
      { 
        metrics: { totalApples: 0, totalOranges: 0, totalMatches: 0, avgMutualScore: 0, avgAppleScore: 0, avgOrangeScore: 0 }, 
        recentMatches: [], 
        scoreDistribution: [], 
        attributeStats: [] 
      }
    )
    setData(result)
  }

  useEffect(() => {
    fetchDashboard()
    const interval = setInterval(fetchDashboard, 30_000)
    return () => clearInterval(interval)
  }, [])

  async function startConversation(type: FruitType) {
    setLoading(true)
    setError(null)
    setSteps([])
    setActiveFruit(type)
    const convId = "conv-" + Date.now()
    addConversation({ id: convId, type, messages: [], status: "active", createdAt: new Date().toISOString() })
    setActiveConversation(convId)
    setSteps([{ role: "system", content: "A new " + type + " has arrived and is looking for a match..." }])
    try {
      const res = await runEffectOr(
        fetchJsonWithRetry<any>("/api/match?type=" + type),
        { error: "Request failed" }
      )
      if (res.error) {
        setSteps(s => [...s, { role: "system", content: "Error: " + String(res.error) }])
        setError(String(res.error))
        return
      }
      const comm = res.communication as { attributes: string; preferences: string }
      setSteps(s => [...s, { role: "fruit", content: comm.attributes }, { role: "fruit", content: comm.preferences }])
      
      const mArr = (res.matches as any[]) ?? []
      setSteps(s => [...s, { role: "system", content: `Found ${mArr.length} matches. Generating narrative...` }])
      setSteps(s => [...s, { role: "agent", content: String(res.narrative ?? "") }])
      
      mArr.forEach((m, i) => addMatch({
        id: convId + "-" + i,
        appleId: type === "apple" ? convId : (m.appleId ?? ""),
        orangeId: type === "orange" ? convId : (m.orangeId ?? ""),
        score: m.mutualScore,
        status: "confirmed",
        createdAt: new Date().toISOString(),
      }))
      
      addMessageToConversation(convId, { id: "attrs", role: "user", content: comm.attributes, timestamp: new Date().toISOString() })
      addMessageToConversation(convId, { id: "narr", role: "assistant", content: String(res.narrative ?? ""), timestamp: new Date().toISOString() })
      await fetchDashboard()
    } finally {
      setLoading(false)
    }
  }

  const dist = data?.scoreDistribution ?? []
  const maxBucket = Math.max(...dist.map(d => d.count), 1)
  const recentMatches = data?.recentMatches ?? []
  const attrStats = data?.attributeStats ?? []
  const metrics = data?.metrics

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80 sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Matchmaking Dashboard</h1>
            <p className="text-xs text-muted">Creating perfect pears since 2026</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => startConversation("apple")} disabled={isLoading} className="btn-primary">
              {isLoading && activeFruit === "apple" ? "🍎 ..." : "New Apple"}
            </button>
            <button onClick={() => startConversation("orange")} disabled={isLoading} className="btn-secondary">
              {isLoading && activeFruit === "orange" ? "🍊 ..." : "New Orange"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6 mb-8">
          {[
            { label: "Apples", value: metrics?.totalApples, icon: "🍎" },
            { label: "Oranges", value: metrics?.totalOranges, icon: "🍊" },
            { label: "Matches", value: metrics?.totalMatches, icon: "🍐" },
            { label: "Avg Score", value: metrics?.avgMutualScore, icon: "⭐" },
            { label: "Apple Sat.", value: `${metrics?.avgAppleScore}`, icon: "📊" },
            { label: "Orange Sat.", value: `${metrics?.avgOrangeScore}`, icon: "📈" },
          ].map(m => (
            <div key={m.label} className="metric-card p-4 rounded-xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
              <div className="flex items-center justify-between text-muted mb-2">
                <span className="text-lg">{m.icon}</span>
                <span className="text-[10px] uppercase font-bold">{m.label}</span>
              </div>
              <p className="text-2xl font-bold">{m.value ?? "—"}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-8">
            <section className="card p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-4">Live Narrative</h2>
              <div className="space-y-4 min-h-[300px]">
                {steps.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-muted border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-xl">
                    <p className="text-2xl mb-2">🍐</p>
                    <p className="text-sm">Click a button above to generate a match</p>
                  </div>
                ) : (
                  steps.map((step, i) => (
                    <div key={i} className={`flex gap-3 ${step.role === "agent" ? "flex-row-reverse" : ""}`}>
                      <div className={`p-3 rounded-2xl text-sm ${stepBg(step.role)} max-w-[80%]`}>
                        {step.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="card p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-4">Recent Matches</h2>
              <div className="space-y-2">
                {recentMatches.map(m => (
                  <div key={m.id} className="border dark:border-zinc-800 rounded-lg overflow-hidden">
                    <button onClick={() => toggleExpand(m.id)} className="w-full flex items-center justify-between p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <div className="flex items-center gap-2">
                        <span>🍎 {m.appleId.slice(-4)}</span>
                        <span className="text-zinc-300">×</span>
                        <span>🍊 {m.orangeId.slice(-4)}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`font-mono font-bold ${scoreColor(m.score)}`}>{m.score.toFixed(3)}</span>
                        <span className="text-[10px] text-muted">{formatRelativeTime(m.createdAt)}</span>
                      </div>
                    </button>
                    {expanded.has(m.id) && (
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-800/20 text-xs text-muted border-t dark:border-zinc-800">
                        {m.narrative}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar Analytics */}
          <div className="space-y-8">
            <section className="card p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-4">Match Graph</h2>
              <MatchGraph matches={recentMatches} />
            </section>

            <section className="card p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-4">Satisfaction</h2>
              <div className="space-y-4">
                {attrStats.map(s => (
                  <div key={s.attribute}>
                    <div className="flex justify-between text-[10px] font-bold mb-1 uppercase">
                      <span>{s.attribute}</span>
                      <span>{s.satisfactionRate}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${s.satisfactionRate > 80 ? 'bg-pear' : 'bg-orange'}`}
                        style={{ width: `${s.satisfactionRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-4">Score Spread</h2>
              <div className="space-y-2">
                {dist.map(d => (
                  <div key={d.bucket} className="flex items-center gap-2 text-[10px]">
                    <span className="w-12 font-mono">{d.bucket}</span>
                    <div className="flex-1 h-3 bg-zinc-50 dark:bg-zinc-800 rounded-sm overflow-hidden">
                      <div 
                        className="h-full bg-pear/40" 
                        style={{ width: `${(d.count / maxBucket) * 100}%` }}
                      />
                    </div>
                    <span className="w-4 text-right">{d.count}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {error && (
          <div className="fixed bottom-6 right-6 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-red-600 text-xs shadow-lg">
            {error}
          </div>
        )}
      </main>
    </div>
  )
}