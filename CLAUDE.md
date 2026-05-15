# Ana Assistant — CLAUDE.md

## Visão geral do projeto
Aplicação web de assistente pessoal de produtividade chamada "Ana".
Stack: React (frontend) + Node.js/Express (backend) + PostgreSQL (banco).
A assistente é formal, profissional e fala sempre em português brasileiro.

## Regras de desenvolvimento
- Sempre usar português nos comentários, commits e documentação
- Commits seguem Conventional Commits: feat:, fix:, chore:, docs:
- Nunca commitar arquivos .env ou segredos
- Sempre criar testes para novas funcionalidades (Jest)
- Código limpo: funções pequenas, nomes descritivos, sem código morto

## Estrutura de pastas
ana-assistant/
├── frontend/          # React + Vite
│   ├── src/
│   │   ├── components/  # Componentes reutilizáveis
│   │   ├── pages/       # Páginas (Rotina, Calendário, etc.)
│   │   ├── hooks/       # Custom hooks
│   │   ├── services/    # Chamadas à API
│   │   └── store/       # Estado global (Zustand)
├── backend/           # Node.js + Express
│   ├── src/
│   │   ├── routes/      # Rotas da API REST
│   │   ├── controllers/ # Lógica dos endpoints
│   │   ├── models/      # Modelos do banco (Prisma)
│   │   ├── services/    # Lógica de negócio
│   │   └── middleware/  # Auth, validação, etc.
├── CLAUDE.md
├── .env.example
└── README.md

## Funcionalidades do sistema
1. Rotina diária com timeline de tarefas
2. Calendário mensal com agendamentos
3. Visão semanal de eventos e tarefas
4. Gestão de tarefas com prioridades
5. Chat com a Ana (integração Claude API)
6. Relatório diário com rebalanceamento de rotina via IA
7. Metas e preferências de trabalho

## Padrões de API
- REST com prefixo /api/v1
- Autenticação via JWT
- Respostas sempre em JSON: { data, error, meta }
- Datas sempre em ISO 8601

## Variáveis de ambiente — atualizado
ANTHROPIC_API_KEY=     # Claude Sonnet — chat, relatórios, rebalanceamento
OPENAI_API_KEY=        # Whisper (transcrição) + Realtime API (voz contínua)
DATABASE_URL=          # PostgreSQL connection string
JWT_SECRET=            # Segredo para tokens JWT
PORT=3001              # Porta do backend

## Arquitetura de IA — três modos
# MODO TEXTO       → POST /api/v1/ana/chat              → Claude Sonnet
# MODO VOZ COMANDO → POST /api/v1/ana/transcribe (Whisper) → /chat (Claude)
# MODO VOZ CONTÍNUA → WebSocket /api/v1/ana/realtime   → OpenAI Realtime API

## Quando alterar este arquivo
Atualize o CLAUDE.md sempre que:
- Adicionar uma nova feature ao roadmap
- Mudar uma decisão de arquitetura
- Adicionar nova variável de ambiente
- Mudar padrões de código ou commits