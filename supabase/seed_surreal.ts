import { Surreal, Table } from "surrealdb"
import { readFileSync } from "fs"

const VALID_TYPES = ["apple", "orange"]
const raw = JSON.parse(
  readFileSync("./data/raw_apples_and_oranges.json", "utf-8")
)

function normaliseAttributes(attrs: Record<string, unknown>) {
  return {
    size: attrs.size ?? null,
    weight: attrs.weight ?? null,
    hasStem: attrs.hasStem ?? null,
    hasLeaf: attrs.hasLeaf ?? null,
    hasWorm: attrs.hasWorm ?? null,
    shineFactor: attrs.shineFactor ?? null,
    hasChemicals: attrs.hasChemicals ?? null,
  }
}

function normalisePreferences(prefs: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(prefs).filter(([, v]) => v !== undefined)
  )
}

const db = new Surreal()

try {
  await db.connect(
    process.env.SURREALDB_URL ?? "ws://127.0.0.1:8000/rpc"
  )
  await db.signin({
    username: process.env.SURREALDB_USER ?? "root",
    password: process.env.SURREALDB_PASS ?? "root",
  })
  await db.use({
    namespace: process.env.SURREALDB_NS ?? "clera",
    database: process.env.SURREALDB_DB ?? "matchmaking",
  })

  let inserted = 0
  let skipped = 0

  for (const fruit of raw) {
    if (!VALID_TYPES.includes(fruit.type)) {
      console.warn(`Skipping unknown fruit type: ${fruit.type}`)
      skipped++
      continue
    }
    try {
      await db.insert(new Table(fruit.type), {
        attributes: normaliseAttributes(fruit.attributes),
        preferences: normalisePreferences(fruit.preferences),
        request_id: crypto.randomUUID(),
      })
      inserted++
    } catch (err) {
      console.warn(
        `Failed to insert ${fruit.type}: ${err instanceof Error ? err.message : String(err)}`
      )
      skipped++
    }
  }

  console.log(`Seeded ${inserted} fruits (${skipped} skipped)`)
} catch (err) {
  console.error(
    `Seed failed: ${err instanceof Error ? err.message : String(err)}`
  )
  process.exit(1)
} finally {
  await db.close()
}
