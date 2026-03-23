import { Surreal } from "surrealdb"

let db: Surreal | null = null

export async function getDb(): Promise<Surreal> {
  if (db) {
    try {
      await db.query("SELECT 1")
      return db
    } catch {
      db = null
    }
  }

  const instance = new Surreal()

  try {
    await instance.connect(
      Deno.env.get("SURREALDB_URL") ?? "ws://127.0.0.1:8000/rpc"
    )

    await instance.signin({
      username: Deno.env.get("SURREALDB_USER") ?? "root",
      password: Deno.env.get("SURREALDB_PASS") ?? "root",
    })

    await instance.use({
      namespace: Deno.env.get("SURREALDB_NS") ?? "clera",
      database: Deno.env.get("SURREALDB_DB") ?? "matchmaking",
    })

    db = instance
    return db
  } catch (err) {
    throw new Error(
      `SurrealDB connection failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
