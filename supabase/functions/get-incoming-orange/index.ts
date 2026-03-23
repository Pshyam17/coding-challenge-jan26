import "@supabase/functions-js/edge-runtime.d.ts"
import { generateOrange, communicateAttributes, communicatePreferences } from "../_shared/generateFruit.ts"
import { getDb } from "../_shared/db.ts"
import { scoreBidirectional } from "../_shared/scoring.ts"
import { Table, RecordId } from "npm:surrealdb@^1.0.0"
import { generateText } from "npm:ai@^4.0.0"
import { createOpenAI } from "npm:@ai-sdk/openai@^1.0.0"

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
    const apiKey = Deno.env.get("NVIDIA_API_KEY")
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "NVIDIA_API_KEY is not set" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      )
    }

    const orange = generateOrange()
    const orangeAttrs = communicateAttributes(orange)
    const orangePrefs = communicatePreferences(orange)

    const db = await getDb()

    const inserted = await db.insert(new Table("orange"), {
      attributes: orange.attributes,
      preferences: orange.preferences,
      request_id: crypto.randomUUID(),
    })
    const orangeRecord = Array.isArray(inserted) ? inserted[0] : inserted
    const orangeId = orangeRecord.id as RecordId

    const apples = await db.query<[{ id: RecordId; attributes: unknown; preferences: unknown }[]]>(
      "SELECT * FROM apple"
    )
    const applePool = apples[0] ?? []

    if (applePool.length === 0) {
      return new Response(
        JSON.stringify({ error: "No apples available for matching" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      )
    }

    const scored = applePool
      .map((apple) => ({
        apple,
        ...scoreBidirectional(
          {
            type: "apple",
            attributes: apple.attributes as never,
            preferences: apple.preferences as never,
          },
          orange
        ),
      }))
      .sort((a, b) => b.mutualScore - a.mutualScore)
      .slice(0, TOP_K)

    const relationIds: RecordId[] = []

    for (const match of scored) {
      const relation = await db.query<[{ id: RecordId }[]]>(
        `RELATE $apple->matched_to->$orange SET score = $score, apple_score = $appleScore, orange_score = $orangeScore`,
        {
          apple: match.apple.id,
          orange: orangeId,
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

    const openai = createOpenAI({ apiKey, baseURL: "https://integrate.api.nvidia.com/v1" })

    const { text: narrative } = await generateText({
      model: openai("meta/llama-3.1-70b-instruct"),
      prompt: `You are Clera, a fruit matchmaking agent. An orange just arrived and found matches.

Orange says about itself: "${orangeAttrs}"
Orange is looking for: "${orangePrefs}"

Top ${TOP_K} apple matches:
${matchSummary}

Write a warm, concise message (3-4 sentences) to the orange about its matches. Be specific about why the top match is a good fit.`,
    })

    if (relationIds[0]) {
      await db.query(
        `UPDATE $id SET narrative = $narrative`,
        { id: relationIds[0], narrative }
      )
    }

    return new Response(
      JSON.stringify({
        orange: { attributes: orange.attributes, preferences: orange.preferences },
        communication: { attributes: orangeAttrs, preferences: orangePrefs },
        matches: scored.map((m) => ({
          appleId: String(m.apple.id),
          mutualScore: m.mutualScore,
          appleScore: m.appleScore,
          orangeScore: m.orangeScore,
        })),
        narrative,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (error) {
    console.error("Error processing incoming orange:", error)
    return new Response(
      JSON.stringify({
        error: "Failed to process incoming orange",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
