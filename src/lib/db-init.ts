import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

let initialized = false

export async function dbInit(): Promise<void> {
  if (initialized) return
  initialized = true

  const databaseUrl = process.env.DATABASE_URL ?? 'file:./ana.db'

  // Ignora bases de dados remotas (Turso, libsql remoto, etc.)
  if (!databaseUrl.startsWith('file:')) return

  const filePath = databaseUrl.replace(/^file:/, '')
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath)

  if (!existsSync(absolutePath)) {
    console.log('[db-init] Base de dados não encontrada. A criar...')
    try {
      execSync('npx prisma db push --skip-generate', {
        stdio: 'inherit',
        cwd: process.cwd(),
      })
      console.log('[db-init] Base de dados criada com sucesso.')
    } catch (e) {
      console.error('[db-init] Falha ao criar a base de dados:', e)
    }
  }
}
