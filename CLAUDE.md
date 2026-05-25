# Ana Assistant — CLAUDE.md

## Visão geral do projecto
Aplicação web de assistente pessoal de produtividade chamada "Ana".
Stack: Next.js 14 (App Router) + SQLite (Prisma + libsql).
Modelo de deploy BYOK — o utilizador faz o seu próprio deploy e configura as chaves em /setup.
A assistente é formal, profissional e fala sempre em português europeu.

## Stack actual
Next.js 14 (App Router) + TypeScript + TailwindCSS
Prisma ORM + SQLite (ficheiro local prisma/ana.db)
Anthropic SDK (Claude Sonnet) — chat e rebalanceamento de rotina
OpenAI SDK (Whisper) — transcrição de voz

## Deploy para utilizadores
Modelo BYOK — cada utilizador faz o seu próprio deploy.
Instruções: README.md → secção "Deploy em 1 clique"

## Estrutura de pastas
```
/
├── src/
│   ├── app/           # Next.js App Router (páginas e API routes)
│   ├── components/    # Componentes React reutilizáveis
│   │   └── pages/     # Componentes de página (ChatPage, RotinaPage, etc.)
│   ├── hooks/         # Custom hooks (useTasks, useEvents, useAuth...)
│   ├── services/      # Chamadas às API routes internas
│   ├── store/         # Estado global Zustand (authStore)
│   ├── types/         # Tipos TypeScript (Task, CalendarEvent...)
│   └── lib/           # Utilitários (prisma, api helpers, db-init)
├── prisma/
│   └── schema.prisma  # Schema da base de dados SQLite
└── middleware.ts       # Redireciona para /setup se chaves não configuradas
```

## Funcionalidades do sistema
1. Rotina diária com lista de tarefas por data
2. Calendário mensal com agendamentos
3. Visão semanal de eventos e tarefas
4. Gestão de tarefas com prioridades (alta/media/baixa)
5. Chat com a Ana (integração Claude Sonnet via Anthropic SDK)
6. Relatório diário com rebalanceamento de rotina via IA
7. Modo de conversa contínua por voz (Whisper + TTS)

## Padrões de API
- Next.js API Routes em src/app/api/
- Respostas sempre em JSON: `{ data, error: null }` ou `{ data: null, error: string }`
- Helpers: `ok(data)` e `err(message, status)` de `@/lib/api`
- Validação com Zod (v4) — usar `.issues` (não `.errors`)
- Datas sempre em ISO 8601 (YYYY-MM-DD)

## Variáveis de ambiente
```
DATABASE_URL="file:./ana.db"          # gerado automaticamente pelo db-init
ANTHROPIC_API_KEY=                     # inserido pelo utilizador em /setup
OPENAI_API_KEY=                        # inserido pelo utilizador em /setup
```

## Arquitetura de IA
- MODO TEXTO        → POST /api/ana/chat       → Claude Sonnet (Anthropic SDK)
- MODO VOZ COMANDO  → POST /api/ana/transcribe  → Whisper (OpenAI SDK) → /chat
- MODO VOZ CONTÍNUA → ConversationMode.tsx      → Whisper + Web Speech API

## Regras de desenvolvimento
- Sempre usar português nos comentários, commits e documentação
- Commits seguem Conventional Commits: feat:, fix:, chore:, docs:
- Nunca commitar ficheiros .env ou segredos
- Código limpo: funções pequenas, nomes descritivos, sem código morto
- Sem testes obrigatórios nesta fase (app pessoal em desenvolvimento activo)

## Tarefa fixa após cada alteração de código
Após concluir qualquer alteração de código, Claude DEVE obrigatoriamente:
1. Verificar todos os ficheiros modificados com `git status` e `git diff`
2. Adicionar os ficheiros alterados ao stage (`git add` — nunca usar `.env` ou segredos)
3. Criar um commit seguindo Conventional Commits com resumo claro das implementações
4. Confirmar o commit bem-sucedido com `git status`
5. Apagar a pasta de cache do Next.js: `Remove-Item -Recurse -Force C:\ana-assistant\ana-assistant\.next\cache`

Esta instrução aplica-se a TODA e QUALQUER modificação de código, sem excepção.

## Electron — Lições aprendidas

### appRoot em produção com asar:false
Quando o electron-builder empacota com `asar: false`, os ficheiros
ficam em `resources/app/` e NÃO em `resources/` (process.resourcesPath).

A variável appRoot deve ser sempre:
  isDev
    ? path.join(__dirname, '..')           // desenvolvimento
    : path.join(process.resourcesPath, 'app') // produção

NUNCA usar apenas `process.resourcesPath` como appRoot em produção.
Isto afecta todos os path.join(appRoot, ...) — prisma, .next, public, etc.

### app.getVersion() em vez de require('package.json')
Para ler a versão da app no processo main do Electron, usar sempre:
  app.getVersion()

NUNCA usar:
  require(path.join(appRoot, 'package.json')).version

O require falha silenciosamente em produção se o caminho estiver errado,
causando UnhandledPromiseRejection que cancela todo o arranque da app
sem mostrar nenhum erro visível ao utilizador — apenas splash infinito.

### Como diagnosticar loop infinito no Electron
Se a app fica em splash infinito após instalação:
1. Correr o .exe pelo terminal com:
   & "caminho\Ana Assistant.exe" 2>&1 | Tee-Object -FilePath "C:\debug.txt"
2. Verificar se aparecem logs [ana] no terminal
3. Se o primeiro log não aparecer — o crash é antes do whenReady()
4. Se aparecer "Electron iniciado" mas parar — problema no appRoot ou paths
5. Procurar qualquer require() ou path.join(appRoot,...) fora do whenReady()

## Quando alterar este ficheiro
Actualize o CLAUDE.md sempre que:
- Adicionar uma nova feature ao roadmap
- Mudar uma decisão de arquitectura
- Adicionar nova variável de ambiente
- Mudar padrões de código ou commits
