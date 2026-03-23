import { NextRequest, NextResponse } from "next/server"

const FN_URL = process.env.SUPABASE_FUNCTIONS_URL ?? "http://127.0.0.1:54321/functions/v1"

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "apple"
  const fn = type === "orange" ? "get-incoming-orange" : "get-incoming-apple"
  try {
    const res = await fetch(`${FN_URL}/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: "Edge function unreachable", details: String(err) },
      { status: 500 }
    )
  }
}
