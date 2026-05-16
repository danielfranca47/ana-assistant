# Ana — Assistente Pessoal com IA

<!-- imagem ou GIF de demonstração -->
![Ana Assistant Demo](docs/demo.gif)

Ana é uma assistente pessoal que organiza a sua rotina, agenda
compromissos, gere tarefas e aprende as suas preferências.
Funciona com as suas próprias chaves de API — os seus dados
ficam apenas no seu servidor pessoal.

## Deploy em 1 clique

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/danielfranca47/ana-assistant)

Após o deploy:
1. Abra o URL gerado pelo Vercel
2. Insira a sua chave Anthropic em [console.anthropic.com](https://console.anthropic.com)
3. Insira a sua chave OpenAI em [platform.openai.com](https://platform.openai.com)
4. A Ana está pronta ✓

## O que a Ana faz

- Rotina diária com timeline de tarefas
- Calendário e visão semanal
- Chat por voz e texto
- Relatório diário com rebalanceamento de rotina por IA
- Metas e preferências personalizadas

## Desenvolvimento local

**Pré-requisitos:** Node.js 18+, npm

```bash
git clone https://github.com/danielfranca47/ana-assistant.git
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
