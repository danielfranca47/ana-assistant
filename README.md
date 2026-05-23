# Ana — Assistente Pessoal com IA

<!-- Substitua [SCREENSHOT] por um GIF ou imagem real após o primeiro deploy -->
[SCREENSHOT]

Ana é uma assistente pessoal que organiza a sua rotina, agenda compromissos,
gere tarefas e aprende as suas preferências. Funciona com as suas próprias
chaves de API — os seus dados ficam apenas no seu servidor pessoal.

---

## Deploy em 1 clique

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/SEU-USUARIO/ana-assistant)

### Primeiros passos

1. Clique no botão Deploy acima e crie uma conta gratuita no Vercel (se ainda não tiver).
2. Insira a sua chave Anthropic — obter em [console.anthropic.com](https://console.anthropic.com)
3. Insira a sua chave OpenAI — obter em [platform.openai.com](https://platform.openai.com)

---

## As suas chaves de API

A Ana precisa de duas chaves para funcionar. São gratuitas nos planos de entrada:

- **Chave Anthropic** (para o chat e análise de rotina) — obter em [console.anthropic.com](https://console.anthropic.com)
- **Chave OpenAI** (para transcrição de voz) — obter em [platform.openai.com](https://platform.openai.com)

Insira as chaves na página `/setup` que aparece automaticamente na primeira visita à aplicação.

---

## O que a Ana faz

- **Rotina diária** — criar, editar, reordenar (drag & drop) e filtrar tarefas por prioridade e categoria
- **Calendário mensal** — navegação por mês, eventos visíveis nos dias, painel lateral com detalhes
- **Visão semanal** — drag & drop de eventos, redimensionamento de duração e detecção de conflitos de horário
- **Recorrência de eventos** — padrões diário, semanal, dias úteis ou personalizado; edição com âmbito (este / seguintes / todos)
- **Tarefas vencidas** — marcação automática de atraso e painel de reagendamento
- **Chat com a Ana** — por texto ou voz (Whisper); cria tarefas e eventos pelo chat com confirmação
- **Relatório diário** — formulário de "fiz / não fiz", rebalanceamento de rotina por IA e histórico
- **Metas semanais** — barra de progresso, incremento manual e reset automático toda a segunda-feira
- **Sugestão inteligente de horário** — a Ana analisa os gaps do dia e recomenda o slot óptimo
- **Preferências** — horário de trabalho, almoço, dias de folga e período de foco profundo

---

## Desenvolvimento local

**Pré-requisitos:** Node.js 18+, npm

```bash
git clone https://github.com/SEU-USUARIO/ana-assistant.git
cd ana-assistant
npm install
```

Crie o ficheiro `.env.local` na raiz do projecto:

```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

Inicialize a base de dados e arranque o servidor:

```bash
npx prisma generate
npx prisma db push
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no browser.
