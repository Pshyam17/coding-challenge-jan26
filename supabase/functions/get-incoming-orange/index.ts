import "@supabase/functions-js/edge-runtime.d.ts"
import { generateOrange, communicateAttributes, communicatePreferences } from "../_shared/generateFruit.ts"
import { sql } from "../_shared/db.ts"
import { scoreBidirectional } from "../_shared/scoring.ts"
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

    const requestId = crypto.randomUUID()
    const inserted = await sql<{ id: string }>(
      `INSERT INTO orange (attributes, preferences, request_id) VALUES (${JSON.stringify(orange.attributes)}, ${JSON.stringify(orange.preferences)}, "${requestId}")`
    )
    const orangeId = inserted[0]?.id
    if (!orangeId) throw new Error("Failed to insert orange")

    const applePool = await sql<{ id: string; attributes: unknown; preferences: unknown }>(
      "SELECT * FROM apple"
    )

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

    const relationIds: string[] = []

    for (const match of scored) {
      const relation = await sql<{ id: string }>(
        `RELATE ${match.apple.id}->matched_to->${orangeId} SET score = ${match.mutualScore}, apple_score = ${match.appleScore}, orange_score = ${match.orangeScore}`
      )
      if (relation[0]?.id) relationIds.push(relation[0].id)
    }

    const matchSummary = scored
      .map((m, i) =>
        `Match ${i + 1}: mutual score ${m.mutualScore}, apple satisfaction ${m.appleScore}, orange satisfaction ${m.orangeScore}`
      )
      .join("\n")

    const openai = createOpenAI({
      apiKey,
      baseURL: "https://integrate.api.nvidia.com/v1",
    })

    const { text: narrative } = await generateText({
      model: openai("meta/llama-3.1-70b-instruct"),
      prompt: `You are Clera, a fruit matchmaking agent. An orange just arrived and found matches.

Orange says about itself: "${orangeAttrs}"
Orange is looking for: "${orangePrefs}"

Top ${TOP_K} apple matches:
${matchSummary}

Write a warm, concise message (3-4 sentences) to the orange about its matches. Be specific about why the top match is a good fit.`,
    })

    for (const rid of relationIds) {
      await sql(`UPDATE ${rid} SET narrative = ${JSON.stringify(narrative)}`)
    }

    return new Response(
      JSON.stringify({
        orange: { attributes: orange.attributes, preferences: orange.preferences },
        communication: { attributes: orangeAttrs, preferences: orangePrefs },
        matches: scored.map((m) => ({
          appleId: m.apple.id,
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
