import { readFileSync } from "fs"

const SURREALDB_URL = process.env.SURREALDB_URL ?? "http://127.0.0.1:8000"
const SURREALDB_USER = process.env.SURREALDB_USER ?? "root"
const SURREALDB_PASS = process.env.SURREALDB_PASS ?? "root"
const SURREALDB_NS = process.env.SURREALDB_NS ?? "clera"
const SURREALDB_DB = process.env.SURREALDB_DB ?? "matchmaking"

const authHeader = "Basic " + Buffer.from(`${SURREALDB_USER}:${SURREALDB_PASS}`).toString("base64")

const headers = {
  "Authorization": authHeader,
  "NS": SURREALDB_NS,
  "DB": SURREALDB_DB,
  "Accept": "application/json",
  "Content-Type": "text/plain",
}

async function query(sql: string) {
  const res = await fetch(`${SURREALDB_URL}/sql`, {
    method: "POST",
    headers,
    body: sql,
  })
  return res.json()
}

const VALID_TYPES = ["apple", "orange"]
const raw = JSON.parse(readFileSync("./data/raw_apples_and_oranges.json", "utf-8"))

let inserted = 0
let skipped = 0

for (const fruit of raw) {
  if (!VALID_TYPES.includes(fruit.type)) {
    console.warn(`Skipping unknown type: ${fruit.type}`)
    skipped++
    continue
  }

  try {
    const result = await query(
      `INSERT INTO ${fruit.type} (attributes, preferences, request_id) VALUES (${JSON.stringify(fruit.attributes)}, ${JSON.stringify(fruit.preferences)}, "${crypto.randomUUID()}")`
    )
    const last = result[result.length - 1]
    if (last?.status === "ERR") {
      console.warn(`Failed to insert ${fruit.type}: ${last.result}`)
      skipped++
    } else {
      inserted++
    }
  } catch (err) {
    console.warn(`Failed: ${err instanceof Error ? err.message : String(err)}`)
    skipped++
  }
}

console.log(`Seeded ${inserted} fruits (${skipped} skipped)`)
