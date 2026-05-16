import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrate: {
    async adapter(env: NodeJS.ProcessEnv) {
      const { PrismaLibSQL } = await import('@prisma/adapter-libsql')
      const { createClient } = await import('@libsql/client')
      const url = env['DATABASE_URL'] ?? 'file:./prisma/ana.db'
      const client = createClient({ url })
      return new PrismaLibSQL(client)
    },
  },
})
