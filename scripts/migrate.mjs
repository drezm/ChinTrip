import { readdir, readFile } from 'node:fs/promises'
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
  const migrationsDir = resolve('lovable/migrations')
  const migrationFiles = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort()

  await client.connect()
  for (const file of migrationFiles) {
    const sql = await readFile(resolve(migrationsDir, file), 'utf8')
    await client.query(sql)
    console.log(`Applied migration: ${file}`)
  }
  console.log('Database migrations completed.')
} finally {
  await client.end()
}
