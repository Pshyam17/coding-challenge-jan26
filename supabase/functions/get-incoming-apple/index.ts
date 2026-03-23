import "@supabase/functions-js/edge-runtime.d.ts"
import { generateApple, communicateAttributes, communicatePreferences } from "../_shared/generateFruit.ts"
import { getDb } from "../_shared/db.ts"
import { scoreBidirectional } from "../_shared/scoring.ts"
import { Table, RecordId } from "surrealdb"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const TOP_K = 3

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY")
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not set" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      )
    }

    const apple = generateApple()
    const appleAttrs = communicateAttributes(apple)
    const applePrefs = communicatePreferences(apple)

    const db = await getDb()

    const inserted = await db.insert(new Table("apple"), {
      attributes: apple.attributes,
      preferences: apple.preferences,
      request_id: crypto.randomUUID(),
    })
    const appleRecord = Array.isArray(inserted) ? inserted[0] : inserted
    const appleId = appleRecord.id as RecordId

    const oranges = await db.query<[{ id: RecordId; attributes: unknown; preferences: unknown }[]]>(
      "SELECT * FROM orange"
    )
    const orangePool = oranges[0] ?? []

    if (orangePool.length === 0) {
      return new Response(
        JSON.stringify({ error: "No oranges available for matching" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      )
    }

    const scored = orangePool
      .map((orange) => ({
        orange,
        ...scoreBidirectional(apple, {
          type: "orange",
          attributes: orange.attributes as never,
          preferences: orange.preferences as never,
        }),
      }))
      .sort((a, b) => b.mutualScore - a.mutualScore)
      .slice(0, TOP_K)

    const relationIds: RecordId[] = []

    for (const match of scored) {
      const relation = await db.query<[{ id: RecordId }[]]>(
        `RELATE $apple->matched_to->$orange SET score = $score, apple_score = $appleScore, orange_score = $orangeScore`,
        {
          apple: appleId,
          orange: match.orange.id,
          score: match.mutualScore,
          appleScore: match.appleScore,
          orangeScore: match.orangeScore,
        }
      )
      const rel = relation[0]?.[0]
      if (rel) relationIds.push(rel.id)
    }

    const matchSummary = scored
      .map((m, i) =>
        `Match ${i + 1}: mutual score ${m.mutualScore}, apple satisfaction ${m.appleScore}, orange satisfaction ${m.orangeScore}`
      )
      .join("\n")

    const openai = createOpenAI({ apiKey })

    const { text: narrative } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `You are Clera, a fruit matchmaking agent. An apple just arrived and found matches.

Apple says about itself: "${appleAttrs}"
Apple is looking for: "${applePrefs}"

Top ${TOP_K} orange matches:
${matchSummary}

Write a warm, concise message (3-4 sentences) to the apple about its matches. Be specific about why the top match is a good fit.`,
    })

    if (relationIds[0]) {
      await db.query(
        `UPDATE $id SET narrative = $narrative`,
        { id: relationIds[0], narrative }
      )
    }

    return new Response(
      JSON.stringify({
        apple: { attributes: apple.attributes, preferences: apple.preferences },
        communication: { attributes: appleAttrs, preferences: applePrefs },
        matches: scored.map((m) => ({
          orangeId: String(m.orange.id),
          mutualScore: m.mutualScore,
          appleScore: m.appleScore,
          orangeScore: m.orangeScore,
        })),
        narrative,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (error) {
    console.error("Error processing incoming apple:", error)
    return new Response(
      JSON.stringify({
        error: "Failed to process incoming apple",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
