import { NextResponse } from "next/server"
import { getDashboardData } from "../../dashboard/loader"

export async function GET() {
  const data = await getDashboardData()
  return NextResponse.json(data)
}
