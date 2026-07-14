import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import pg from 'pg'

const { Client } = pg

if (!process.env.DATABASE_URL) {
  console.log('DATABASE_URL is not set, skipping database migration.')
  process.exit(0)
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.PGSSLMODE === 'disable'
      ? undefined
      : { rejectUnauthorized: false },
})

try {
  const migrationPath = resolve('lovable/migrations/001_initial_schema.sql')
  const sql = await readFile(migrationPath, 'utf8')
  await client.connect()
  await client.query(sql)
  console.log('Database migration completed.')
} finally {
  await client.end()
}
