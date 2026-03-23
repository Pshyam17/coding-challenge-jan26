const SURREALDB_URL = Deno.env.get("SURREALDB_URL") ?? "http://172.18.0.1:8000"
const SURREALDB_USER = Deno.env.get("SURREALDB_USER") ?? "root"
const SURREALDB_PASS = Deno.env.get("SURREALDB_PASS") ?? "root"
const SURREALDB_NS = Deno.env.get("SURREALDB_NS") ?? "clera"
const SURREALDB_DB = Deno.env.get("SURREALDB_DB") ?? "matchmaking"

const authHeader = "Basic " + btoa(`${SURREALDB_USER}:${SURREALDB_PASS}`)

const baseHeaders = {
  "Authorization": authHeader,
  "Surreal-NS": SURREALDB_NS,
  "Surreal-DB": SURREALDB_DB,
  "Accept": "application/json",
  "Content-Type": "text/plain",
}

export async function sql<T = unknown>(query: string): Promise<T[]> {
  const res = await fetch(`${SURREALDB_URL}/sql`, {
    method: "POST",
    headers: baseHeaders,
    body: query,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SurrealDB error ${res.status}: ${text}`)
  }

  const data = await res.json()
  const last = data[data.length - 1]

  if (last?.status === "ERR") {
    throw new Error(`SurrealDB query error: ${last.result}`)
  }

  return last?.result ?? []
}
