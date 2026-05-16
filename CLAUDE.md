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

Esta instrução aplica-se a TODA e QUALQUER modificação de código, sem excepção.

## Quando alterar este ficheiro
Actualize o CLAUDE.md sempre que:
- Adicionar uma nova feature ao roadmap
- Mudar uma decisão de arquitectura
- Adicionar nova variável de ambiente
- Mudar padrões de código ou commits
