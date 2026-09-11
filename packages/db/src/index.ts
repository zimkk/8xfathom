import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema/index.js'

export * from './schema/index.js'
export { schema }

let _db: ReturnType<typeof drizzle> | undefined

export function getDb() {
  if (!_db) {
    const connectionString = process.env['DATABASE_URL']
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required')
    }
    const client = postgres(connectionString, {
      max: 10,
      idle_timeout: 30,
    })
    _db = drizzle(client, { schema })
  }
  return _db
}

export type Db = ReturnType<typeof getDb>

export { drizzle }
